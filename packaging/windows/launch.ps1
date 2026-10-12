# MUNE Splits (installed copy): starts the bundled server if it isn't running, then opens the app window.
# Run hidden by "MUNE Splits.vbs". Your data lives in %APPDATA%\MUNE Splits, never in the install folder.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 5174
$url = "http://127.0.0.1:$port"
$data = Join-Path $env:APPDATA "MUNE Splits"
New-Item -ItemType Directory -Force $data | Out-Null
$log = Join-Path $data "server.log"

function Test-Running {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "$url/manifest.webmanifest"
        $body = $r.Content
        if ($body -is [byte[]]) { $body = [Text.Encoding]::UTF8.GetString($body) }
        return $body -match "MUNE Splits"
    } catch {
        return $false
    }
}

if (-not (Test-Running)) {
    $env:PORT = "$port"
    $env:HOSTNAME = "127.0.0.1"
    $env:NODE_ENV = "production"
    $env:MUNE_SPLITS_AUTO_EXIT = "1"          # server stops when the last app window closes
    $env:MUNE_SPLITS_DATA_DIR = $data
    Start-Process -FilePath (Join-Path $root "node\node.exe") -ArgumentList "server.js" `
        -WorkingDirectory (Join-Path $root "app") -WindowStyle Hidden `
        -RedirectStandardOutput $log -RedirectStandardError (Join-Path $data "server-error.log")
}

# Wait for the server, then open it as a Chrome/Edge app window (default browser as a fallback).
$ready = $false
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
    if (Test-Running) { $ready = $true; break }
    Start-Sleep -Milliseconds 400
}
if (-not $ready) {
    (New-Object -ComObject WScript.Shell).Popup(
        "MUNE Splits didn't start.`n`nIs something else using port $port? Details are in:`n$data",
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
    Start-Process -FilePath $browser -ArgumentList "--app=$url", "--window-size=1440,920"
} else {
    Start-Process $url
}
