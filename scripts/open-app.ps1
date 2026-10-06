# Waits for the MUNE Splits server, then opens it as a standalone app window
# (Chrome or Edge with --app=), falling back to the default browser.
param([string]$Url = "http://127.0.0.1:5174")

$ready = $false
$deadline = (Get-Date).AddSeconds(120)
while ((Get-Date) -lt $deadline) {
    try {
        Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "$Url/manifest.webmanifest" | Out-Null
        $ready = $true
        break
    } catch {
        Start-Sleep -Milliseconds 500
    }
}

# The server usually runs hidden, so report a failed start here instead of opening a dead page.
if (-not $ready) {
    $log = Join-Path (Split-Path -Parent $PSScriptRoot) "logs\server.log"
    (New-Object -ComObject WScript.Shell).Popup(
        "MUNE Splits didn't start within 2 minutes.`n`nDetails: $log`nTry running Start MUNE Splits.bat to see the console.",
        0, "MUNE Splits", 48) | Out-Null
    exit 1
}

$candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$browser = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if ($browser) {
    Start-Process -FilePath $browser -ArgumentList "--app=$Url", "--window-size=1440,920"
} else {
    Start-Process $Url
}
