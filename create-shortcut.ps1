# Puts a "MUNE Splits" shortcut on your desktop. It starts the app without a console window
# (launch-mune-splits.vbs); closing the MUNE Splits window stops it again.
# Run once:  powershell -ExecutionPolicy Bypass -File .\create-shortcut.ps1
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktop = [Environment]::GetFolderPath("Desktop")
$link = Join-Path $desktop "MUNE Splits.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($link)
$shortcut.TargetPath = Join-Path $env:WINDIR "System32\wscript.exe"
$shortcut.Arguments = '"' + (Join-Path $root "launch-mune-splits.vbs") + '"'
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation = (Join-Path $root "public\icons\mune-splits.ico") + ",0"
$shortcut.Description = "MUNE Splits - split trip and event expenses"
$shortcut.Save()

Write-Host "Shortcut created: $link"
