' Starts MUNE Splits without any console window (the Start menu and desktop shortcuts point here).
Option Explicit
Dim sh, fso, root
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & root & "\launch.ps1""", 0, False
