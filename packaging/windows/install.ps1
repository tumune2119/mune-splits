# Installs MUNE Splits for the current user (no admin rights needed):
#   - copies the app to %LOCALAPPDATA%\Programs\MUNE Splits (replacing an older version; your data is kept)
#   - adds Start menu and desktop shortcuts, and an entry in Settings > Apps for uninstalling
#   - starts the app
$ErrorActionPreference = "Stop"
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $env:LOCALAPPDATA "Programs\MUNE Splits"
$version = (Get-Content (Join-Path $src "version.txt") -ErrorAction SilentlyContinue | Select-Object -First 1)
Write-Host ""
Write-Host "  Installing MUNE Splits $version" -ForegroundColor Yellow
Write-Host "  to $dest"
Write-Host ""

# Stop a running copy so its files can be replaced.
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($dest, "OrdinalIgnoreCase") } | Stop-Process -Force
Start-Sleep -Milliseconds 300

if ($src.TrimEnd("\") -ne $dest.TrimEnd("\")) {
    New-Item -ItemType Directory -Force $dest | Out-Null
    robocopy $src $dest /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:1 /XF "Install MUNE Splits.cmd" | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Copying files failed (robocopy exit code $LASTEXITCODE)." }
}
# Files from a downloaded zip are marked as "from the internet"; clear that so Windows doesn't nag on every start.
Get-ChildItem $dest -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue

$vbs = Join-Path $dest "MUNE Splits.vbs"
$icon = Join-Path $dest "mune-splits.ico"
$ws = New-Object -ComObject WScript.Shell
$links = @(
    (Join-Path ([Environment]::GetFolderPath("Desktop")) "MUNE Splits.lnk"),
    (Join-Path ([Environment]::GetFolderPath("Programs")) "MUNE Splits.lnk")
)
foreach ($l in $links) {
    $s = $ws.CreateShortcut($l)
    $s.TargetPath = Join-Path $env:WINDIR "System32\wscript.exe"
    $s.Arguments = '"' + $vbs + '"'
    $s.WorkingDirectory = $dest
    $s.IconLocation = "$icon,0"
    $s.Description = "MUNE Splits - split trip and event expenses"
    $s.Save()
}

# Settings > Apps entry (per user).
$key = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\MUNESplits"
New-Item -Force $key | Out-Null
$props = @{
    DisplayName     = "MUNE Splits"
    DisplayVersion  = "$version"
    Publisher       = "MUNE"
    DisplayIcon     = $icon
    InstallLocation = $dest
    UninstallString = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$dest\uninstall.ps1`""
    URLInfoAbout    = "https://github.com/tumune2119/mune-splits"
}
foreach ($p in $props.GetEnumerator()) { Set-ItemProperty $key $p.Key $p.Value }
Set-ItemProperty $key NoModify 1 -Type DWord
Set-ItemProperty $key NoRepair 1 -Type DWord

Write-Host "  Done! Shortcuts added to your desktop and Start menu." -ForegroundColor Green
Write-Host "  Starting MUNE Splits..."
Start-Process (Join-Path $env:WINDIR "System32\wscript.exe") -ArgumentList ('"' + $vbs + '"')
Start-Sleep -Seconds 2
exit 0
