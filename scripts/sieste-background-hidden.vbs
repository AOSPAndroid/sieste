Option Explicit

' Start the outbound-only bridge without showing a terminal window.
' Optional arguments: absolute node.exe path, absolute private config.json path.
' The Windows scheduled task should use MultipleInstances=IgnoreNew.
Dim shell, files, nodePath, configPath, workerPath, command, exitCode
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")

nodePath = "C:\Program Files\nodejs\node.exe"
configPath = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%\SiesteBackground\config.json")
If WScript.Arguments.Count > 0 Then nodePath = WScript.Arguments(0)
If WScript.Arguments.Count > 1 Then configPath = WScript.Arguments(1)
workerPath = files.BuildPath(files.GetParentFolderName(WScript.ScriptFullName), "sieste-background-worker.mjs")

' Quotes are rejected because the arguments become a Windows command line.
If InStr(nodePath, Chr(34)) > 0 Or InStr(configPath, Chr(34)) > 0 Then WScript.Quit 1
If Not files.FileExists(nodePath) Then WScript.Quit 1
If Not files.FileExists(configPath) Then WScript.Quit 1
If Not files.FileExists(workerPath) Then WScript.Quit 1
command = Chr(34) & nodePath & Chr(34) & " " & Chr(34) & workerPath & Chr(34) & " --config " & Chr(34) & configPath & Chr(34)

On Error Resume Next
exitCode = shell.Run(command, 0, True)
If Err.Number <> 0 Then WScript.Quit 1
WScript.Quit exitCode
