# Removes MUNE Splits (app files, shortcuts, Settings > Apps entry). Asks before deleting your data.
$dest = Join-Path $env:LOCALAPPDATA "Programs\MUNE Splits"
$data = Join-Path $env:APPDATA "MUNE Splits"
$shell = New-Object -ComObject WScript.Shell

if ($shell.Popup("Uninstall MUNE Splits?", 0, "MUNE Splits", 4 + 32) -ne 6) { exit 0 }

Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($dest, "OrdinalIgnoreCase") } | Stop-Process -Force
Start-Sleep -Milliseconds 500

Remove-Item (Join-Path ([Environment]::GetFolderPath("Desktop")) "MUNE Splits.lnk") -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath("Programs")) "MUNE Splits.lnk") -ErrorAction SilentlyContinue
Remove-Item "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\MUNESplits" -Recurse -ErrorAction SilentlyContinue

if (Test-Path $data) {
    $msg = "Also delete your MUNE Splits data (events, people, receipts)?`n`n$data`n`nChoose No to keep it for a future install. Tip: export a backup from Settings first."
    if ($shell.Popup($msg, 0, "MUNE Splits", 4 + 48 + 256) -eq 6) { Remove-Item $data -Recurse -Force -ErrorAction SilentlyContinue }
}

Set-Location $env:TEMP
Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue
$shell.Popup("MUNE Splits has been uninstalled.", 0, "MUNE Splits", 64) | Out-Null
