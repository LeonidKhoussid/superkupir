param(
    [string]$BindHost = "0.0.0.0",
    [int]$Port = 8000,
    [string]$XtunnelKey = "",
    [string]$XtunnelDownloadUrl = "https://dl.xtunnel.ru/v2.3.0/xtunnel-v2.3.0-win-x64.zip",
    [switch]$InstallOnly,
    [switch]$SkipTunnel
)

$ErrorActionPreference = "Stop"

function Ensure-Xtunnel {
    param(
        [string]$XtunnelExePath,
        [string]$XtunnelZipPath,
        [string]$DownloadUrl
    )

    if (Test-Path $XtunnelExePath) {
        return
    }

    $xtunnelDir = Split-Path -Parent $XtunnelExePath
    if (!(Test-Path $xtunnelDir)) {
        New-Item -ItemType Directory -Path $xtunnelDir | Out-Null
    }

    Write-Host "[xtunnel] Downloading xTunnel..."
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $XtunnelZipPath
    Expand-Archive -Path $XtunnelZipPath -DestinationPath $xtunnelDir -Force

    if (!(Test-Path $XtunnelExePath)) {
        throw "xtunnel.exe was not found after extraction."
    }
}

function Wait-ApiReady {
    param(
        [string]$HealthUrl,
        [int]$Attempts = 30
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $response = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2
            if ($response.status -eq "ok") {
                return $true
            }
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }

    return $false
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$runtimeDir = Join-Path $projectRoot "runtime"
$xtunnelDir = Join-Path $runtimeDir "xtunnel"
$xtunnelZipPath = Join-Path $xtunnelDir "xtunnel-win-x64.zip"
$xtunnelExePath = Join-Path $xtunnelDir "xtunnel.exe"
$apiStdoutPath = Join-Path $runtimeDir "api.stdout.log"
$apiStderrPath = Join-Path $runtimeDir "api.stderr.log"
$healthUrl = "http://127.0.0.1:$Port/health"

if (!(Test-Path $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir | Out-Null
}

Ensure-Xtunnel -XtunnelExePath $xtunnelExePath -XtunnelZipPath $xtunnelZipPath -DownloadUrl $XtunnelDownloadUrl

if ($InstallOnly) {
    Write-Host "[xtunnel] Installed: $xtunnelExePath"
    & $xtunnelExePath version
    exit 0
}

if (-not $XtunnelKey) {
    $XtunnelKey = $env:XTUNNEL_KEY
}

if ($XtunnelKey) {
    Write-Host "[xtunnel] Registering key..."
    & $xtunnelExePath register $XtunnelKey
    if ($LASTEXITCODE -ne 0) {
        throw "xTunnel could not register the key."
    }
}
else {
    Write-Host "[xtunnel] XTUNNEL_KEY is not set. If xTunnel was registered before, the tunnel may still work."
}

$uvCommand = (Get-Command uv -ErrorAction Stop).Source
$apiArgs = @(
    "run",
    "uvicorn",
    "app.api.main:app",
    "--host",
    $BindHost,
    "--port",
    $Port.ToString()
)

Write-Host "[api] Starting mini-backend on $BindHost`:$Port ..."
$apiProcess = Start-Process `
    -FilePath $uvCommand `
    -ArgumentList $apiArgs `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $apiStdoutPath `
    -RedirectStandardError $apiStderrPath `
    -PassThru

try {
    $isReady = Wait-ApiReady -HealthUrl $healthUrl
    if (-not $isReady) {
        throw "API did not start. Logs: $apiStdoutPath and $apiStderrPath"
    }

    Write-Host "[api] Ready."
    Write-Host "[api] Test:   http://127.0.0.1:$Port/api/v1/test/ping"
    Write-Host "[api] Health: http://127.0.0.1:$Port/health"
    Write-Host "[api] Base:   http://127.0.0.1:$Port/api/v1/recommendations/base"
    Write-Host "[api] Detail: http://127.0.0.1:$Port/api/v1/recommendations/detail"

    if ($SkipTunnel) {
        Write-Host "[xtunnel] Skipped because -SkipTunnel was used."
        Write-Host "[api] PID: $($apiProcess.Id)"
        return
    }

    Write-Host "[xtunnel] Opening public HTTP tunnel to local port $Port ..."
    Write-Host "[xtunnel] The public URL will be printed by xtunnel below."
    & $xtunnelExePath http $Port
}
finally {
    if ($apiProcess -and -not $apiProcess.HasExited) {
        Stop-Process -Id $apiProcess.Id -Force
        Write-Host "[api] Mini-backend process stopped."
    }
}
