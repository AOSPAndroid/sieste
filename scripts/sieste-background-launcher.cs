// Compile with the Windows .NET Framework compiler using /target:winexe.
// The GUI subsystem and CreateNoWindow keep both launcher and Node invisible.
using System;
using System.Diagnostics;
using System.IO;

internal static class SiesteBackgroundLauncher
{
    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            if (args.Length != 3) return 10;
            for (int i = 0; i < args.Length; i++)
                if (!Path.IsPathRooted(args[i]) || args[i].Contains("\"") || !File.Exists(args[i])) return 20 + i;
            var start = new ProcessStartInfo
            {
                FileName = args[0],
                Arguments = "\"" + args[1] + "\" --config \"" + args[2] + "\"",
                WorkingDirectory = Path.GetDirectoryName(args[1]),
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            using (Process worker = Process.Start(start))
            {
                if (worker == null) return 3;
                worker.WaitForExit();
                return worker.ExitCode;
            }
        }
        catch { return 1; }
    }
}
