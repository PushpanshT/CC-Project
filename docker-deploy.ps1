# ==============================================================================
# Automated Local Deployment on Docker (PowerShell)
# Project: Automated Website Availability Monitoring on AWS
# ==============================================================================

param (
    [switch]$WithLocalStack = $false,
    [switch]$Rebuild = $false,
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  DOCKER DEPLOYMENT: Website Availability Monitor" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify Docker CLI is available
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker CLI not found in PATH. Please install Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
}

# 2. Check if Docker Daemon is running
Write-Host "[1/4] Checking Docker Engine status..." -ForegroundColor Yellow
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Docker daemon is not running."
    Write-Host "Attempting to launch Docker Desktop..." -ForegroundColor Cyan
    $dockerPath = "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
    if (Test-Path $dockerPath) {
        Start-Process $dockerPath
        Write-Host "Please wait 15-30 seconds for Docker Desktop to finish booting, then rerun this script." -ForegroundColor Yellow
    } else {
        Write-Host "Please open Docker Desktop from your Start Menu and ensure the engine has started." -ForegroundColor Yellow
    }
    exit 1
}

Write-Host " Docker Engine is connected and operational." -ForegroundColor Green

# 3. Build & Deploy using Docker Compose
Write-Host "`n[2/4] Building and launching container..." -ForegroundColor Yellow
if ($WithLocalStack) {
    Write-Host " Deploying with LocalStack AWS Cloud Emulator profile..." -ForegroundColor Cyan
    docker compose --profile cloud up -d --build
} else {
    if ($Rebuild) {
        docker compose build --no-cache
    }
    docker compose up -d --build web-monitor
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker Compose deployment failed. Check logs above."
    exit 1
}

# 4. Verify Container Status
Write-Host "`n[3/4] Verifying running containers..." -ForegroundColor Yellow
docker compose ps

# 5. Output Access Information
Write-Host "`n[4/4] Deployment Successful!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Application Dashboard:  http://localhost:$Port" -ForegroundColor Green
Write-Host "  Health Status Endpoint: http://localhost:$Port/api/targets" -ForegroundColor White
Write-Host "  Simulate Failures:      http://localhost:$Port (Failure Sandbox tab)" -ForegroundColor White
if ($WithLocalStack) {
    Write-Host "  LocalStack AWS Endpoint: http://localhost:4566" -ForegroundColor Magenta
}
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "`nUseful commands:" -ForegroundColor DarkGray
Write-Host "  View live logs:   docker compose logs -f web-monitor" -ForegroundColor DarkGray
Write-Host "  Stop container:   docker compose down" -ForegroundColor DarkGray
Write-Host "  Restart:          docker compose restart" -ForegroundColor DarkGray
