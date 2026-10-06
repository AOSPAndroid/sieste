# Background sync and notifications

Sieste can refresh connected Tredict and COROS accounts while the app is closed.
The website keeps each account's schedule and saved data. An outbound-only worker
on the Windows sync PC asks the website for due work and delivers Web Push
notifications after new data is saved. The PC does not need an incoming port or
a public IP address. The worker does not run Athena or another AI model.

The PC must be powered on, signed in, and online. This initial setup does not wake
the PC or prevent sleep. Checks resume after it reconnects. Windows battery
settings pause the worker when the PC is running on battery.

## Enable or disable in Sieste

1. Connect and sync a Tredict or COROS account.
2. Open **Background sync** in the account's connection settings.
3. Turn on **Enable background sync** and choose **15 min**, **30 min**, or
   **1 hour**. The default interval is 30 minutes.
4. Choose **Enable on this device** under **Sync notifications** and allow the
   browser's permission request.
5. Choose **Send test** to queue a notification for linked devices. The sync PC
   delivers it on an upcoming check.

Each device needs its own notification permission. **Disable on this device**
removes that device's subscription. Turning off **Background sync** stops that
account's automatic checks and cancels its pending sync alerts. A test notification
can still be requested independently of the account's sync setting.

Alerts announce newly saved data. Repeated checks with unchanged data stay quiet.
A partially completed sync can produce an alert if it saved new data; the app
also displays the partial result. Notification contents include only the sync
outcome and completion time, with no health readings or activity details.

## iPhone and iPad

Web Push requires iOS or iPadOS 16.4 or later and a Home Screen web app. Open Sieste
in Safari, use **Share → Add to Home Screen**, and then open Sieste from its Home
Screen icon. Enable notifications inside that installed app. If permission was
denied, allow notifications in the device's settings before trying again.
Focus and notification settings can affect when alerts appear. See
[Apple's Web Push documentation](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).

## Private PC configuration

The default private directory is `C:\ProgramData\Sieste\private`. Keep its Windows
permissions restricted to the worker account and SYSTEM. Do not put this directory
or its configuration in the repository. ProgramData provides the same physical
path to the packaged desktop app and Windows Task Scheduler; AppData can be
virtualized inside the desktop app and unavailable to a scheduled process.

The local layout is:

```text
C:\ProgramData\Sieste\
  sieste-background-launcher.exe
  private\
    config.json
    runtime\node_modules\web-push\
    status.json
    delivery-receipts.json
```

`config.json` contains these fields, without any provider credentials:

| Field | Purpose |
| --- | --- |
| `base` | `https://sieste.daaalil.chatgpt.site` |
| `token` | Private bearer token matching the website's worker secret |
| `vapidPublicKey` | Web Push public key matching the website's public key |
| `vapidPrivateKey` | Private key used only to sign push delivery requests |
| `runtimePath` | `C:\ProgramData\Sieste\private\runtime`, containing `node_modules/web-push`, or its absolute `package.json` path |

The worker uses `createRequire` to load `web-push` from that private runtime. It
reads the config on every check, so a changed token or key is picked up without
putting secrets on a command line. Changing the Web Push key pair requires devices
to enable notifications again. Keep the private key for an existing installation
when recreating the PC configuration.

The same private directory contains `status.json` and `delivery-receipts.json`.
Status records only online/connection flags, dates, counts, and sanitized error
codes. Receipts retain random job identifiers and numeric delivery results for
up to 30 days to avoid duplicate alerts after a lost server acknowledgement.
Neither file contains subscriptions, push keys, provider results, or health data.

## Windows scheduled task

The background sync task is separate from `sieste Athena Bridge`. Its
name is `sieste Background Sync`. Register it only after the website, database
tables, worker secret, public push key, private config, and runtime are ready.

The default launcher is `scripts/sieste-background-launcher.cs`, compiled into
`C:\ProgramData\Sieste\sieste-background-launcher.exe` with the Windows
.NET Framework compiler at
`C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`. Compile with `/target:winexe`
to use the GUI subsystem. The launcher starts Node using `CreateNoWindow` and
waits for it to exit, so neither process opens a terminal window. Its three
arguments are absolute paths to Node, the worker script, and private config;
secrets stay in the config file. The scheduled action needs no working directory:
the launcher sets Node's working directory to the worker script's directory.

The following command compiles the launcher and registers the task for the
current signed-in Windows account without storing a password. It creates a
login trigger and an indefinite five-minute watchdog.
The launcher stays active while Node runs, and **IgnoreNew** prevents watchdog
triggers from starting another worker. It has no execution time limit. The
settings keep Windows' defaults of refusing a battery start and stopping on a
switch to battery; **WakeToRun** remains off.

```powershell
$siesteTaskName = 'sieste Background Sync'
$siesteRepo = 'C:\Users\adell\Projects\apex-athlete'
$siesteRoot = 'C:\ProgramData\Sieste'
$siestePrivateDir = Join-Path $siesteRoot 'private'
$siesteLauncherSource = Join-Path $siesteRepo 'scripts\sieste-background-launcher.cs'
$siesteLauncher = Join-Path $siesteRoot 'sieste-background-launcher.exe'
$siesteCompiler = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$siesteWorker = Join-Path $siesteRepo 'scripts\sieste-background-worker.mjs'
$siesteNode = 'C:\Program Files\nodejs\node.exe'
$siesteConfig = Join-Path $siestePrivateDir 'config.json'
$siesteUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

foreach ($siesteFile in @($siesteLauncherSource, $siesteCompiler, $siesteWorker, $siesteNode, $siesteConfig)) {
    if (-not (Test-Path -LiteralPath $siesteFile -PathType Leaf)) {
        throw 'A required Sieste source, compiler, worker, Node executable, or private config is missing.'
    }
    if ($siesteFile.Contains('"')) { throw 'A Sieste path contains an invalid quote.' }
}
if (Get-ScheduledTask -TaskPath '\' -TaskName $siesteTaskName -ErrorAction SilentlyContinue) {
    throw 'The Sieste background task already exists. Inspect it before changing it.'
}

& $siesteCompiler /nologo /target:winexe ('/out:{0}' -f $siesteLauncher) $siesteLauncherSource
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $siesteLauncher -PathType Leaf)) {
    throw 'The Sieste GUI launcher could not be compiled.'
}

$siesteAction = New-ScheduledTaskAction `
    -Execute $siesteLauncher `
    -Argument ('"{0}" "{1}" "{2}"' -f $siesteNode, $siesteWorker, $siesteConfig)
$siesteLogin = New-ScheduledTaskTrigger -AtLogOn -User $siesteUser
$siesteWatchdog = New-ScheduledTaskTrigger `
    -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 5)
$siesteSettings = New-ScheduledTaskSettingsSet `
    -Hidden -StartWhenAvailable -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)
$siestePrincipal = New-ScheduledTaskPrincipal `
    -UserId $siesteUser -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskPath '\' -TaskName $siesteTaskName `
    -Action $siesteAction -Trigger @($siesteLogin, $siesteWatchdog) `
    -Settings $siesteSettings -Principal $siestePrincipal `
    -Description 'Refresh Sieste in the background and deliver sync notifications.' | Out-Null
```

`scripts/sieste-background-hidden.vbs` is an optional fallback on a host where
Windows Script Host works under Task Scheduler. It accepts Node and config paths,
locates the worker beside itself, and uses `WshShell.Run` with window style zero
and waits for Node. The default scheduled task uses the compiled GUI launcher.
If using the fallback, substitute this action before registering the task:

```powershell
$siesteVbs = Join-Path $siesteRepo 'scripts\sieste-background-hidden.vbs'
$siesteAction = New-ScheduledTaskAction `
    -Execute (Join-Path $env:WINDIR 'System32\wscript.exe') `
    -Argument ('//B //NoLogo "{0}" "{1}" "{2}"' -f $siesteVbs, $siesteNode, $siesteConfig)
```

Start or resume the task after configuration is ready:

```powershell
Enable-ScheduledTask -TaskPath '\' -TaskName 'sieste Background Sync' | Out-Null
Start-ScheduledTask -TaskPath '\' -TaskName 'sieste Background Sync'
```

Pause the PC worker without deleting its task or private config:

```powershell
Disable-ScheduledTask -TaskPath '\' -TaskName 'sieste Background Sync' | Out-Null
Stop-ScheduledTask -TaskPath '\' -TaskName 'sieste Background Sync'
```

## Verify and operate

Before starting the scheduled task, check syntax and run one complete worker
check. The `--once` command can refresh one due account and send already queued
notifications, so run it only against a prepared deployment. Avoid running it
alongside the scheduled worker.

```powershell
& 'C:\Program Files\nodejs\node.exe' --check `
    'C:\Users\adell\Projects\apex-athlete\scripts\sieste-background-worker.mjs'
& 'C:\Program Files\nodejs\node.exe' `
    'C:\Users\adell\Projects\apex-athlete\scripts\sieste-background-worker.mjs' `
    --config 'C:\ProgramData\Sieste\private\config.json' --once
```

The one-check result is sanitized JSON. A clean result has `connected: true` and
`error: null`. `workerOnline: false` is expected after `--once` exits. The persistent
worker checks the website every 60 seconds, with exponential failure backoff up
to 15 minutes. Each request can wait up to 210 seconds for a due sync; push
delivery uses a 20-second socket timeout and acknowledgements use 30 seconds.

Inspect task state and the sanitized status without reading the private config:

```powershell
Get-ScheduledTask -TaskPath '\' -TaskName 'sieste Background Sync' |
    Select-Object TaskName, State
Get-ScheduledTaskInfo -TaskPath '\' -TaskName 'sieste Background Sync' |
    Select-Object LastRunTime, LastTaskResult, NextRunTime
Get-Content -LiteralPath 'C:\ProgramData\Sieste\private\status.json' |
    ConvertFrom-Json
```

A persistent task normally stays **Running**, with `LastTaskResult` equal to
`267009` (`0x41301`, task currently running). A forced stop, power loss, or
Windows termination can leave the status file's online flag stale; check
`updatedAt` and `lastSuccessAt` as well. Sieste's **Sync PC online** indicator uses
the website's latest worker heartbeat and becomes offline after four minutes.
The five-minute watchdog restarts a stopped worker when conditions allow.
If Task Scheduler returns `0x80070002`, check that the action's executable is
the compiled GUI launcher at its current absolute path. Launcher exit code `10`
means it did not receive exactly three arguments. Codes `20`, `21`, and `22`
mean the Node, worker, or config path is missing or invalid, respectively. Code
`3` means Node could not start; `1` is a contained launcher failure or a worker
failure. These codes contain no secrets. Rebuild the launcher after changing its
source while the task is paused.

| Status error | Check |
| --- | --- |
| `CONFIG_UNAVAILABLE` | Private config exists and this Windows account can read it |
| `CONFIG_INVALID` | Field names, production origin, token, key formats, and absolute runtime path |
| `PUSH_RUNTIME_UNAVAILABLE` | `web-push` is installed in the configured private runtime |
| `WORKER_UNAUTHORIZED` | PC token matches the deployed worker secret |
| `WORKER_NETWORK` | PC internet connection and website availability |
| `WORKER_RESPONSE` | Website route, deployment, and database readiness |
| `WORKER_UNAVAILABLE` | Private directory write permissions and local runtime availability |

The website leases due account syncs to avoid overlapping refreshes and retries
notification delivery with a bounded attempt count. HTTP 404 or 410 from a push
service removes the expired subscription; enable notifications again on that
device. The PC only sends push requests to approved HTTPS Apple, Google, Mozilla,
or Windows push-service hosts. It refuses arbitrary destinations and redirects
from the website worker endpoint.

To move the worker later, prepare the same private runtime/config on the new
always-on host, keep the existing push key pair, compile its GUI launcher, and
stop the old PC task before starting the new worker. Per-account schedules and
subscriptions remain on the website.
