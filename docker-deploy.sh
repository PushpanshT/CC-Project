#!/bin/bash
# ==============================================================================
# Automated Local Deployment on Docker (Bash)
# Project: Automated Website Availability Monitoring on AWS
# ==============================================================================

set -e

echo "=========================================================="
echo "  DOCKER DEPLOYMENT: Website Availability Monitor"
echo "=========================================================="

# Check Docker CLI
if ! command -v docker &> /dev/null; then
    echo "Error: Docker CLI not found. Please install Docker." >&2
    exit 1
fi

# Check Docker Daemon
echo "[1/4] Checking Docker Engine status..."
if ! docker info &> /dev/null; then
    echo "Warning: Docker daemon is not running."
    echo "Please start Docker Desktop or systemctl start docker, then re-run."
    exit 1
fi
echo "✓ Docker Engine is active."

# Check optional argument
PROFILE_ARG=""
if [ "$1" == "--cloud" ] || [ "$1" == "-c" ]; then
    echo "Enabling LocalStack AWS cloud emulation profile..."
    PROFILE_ARG="--profile cloud"
fi

echo "[2/4] Building and launching containers..."
docker compose $PROFILE_ARG up -d --build

echo "[3/4] Checking container status..."
docker compose ps

echo ""
echo "[4/4] Deployment Successful!"
echo "=========================================================="
echo "  Application Dashboard:  http://localhost:3000"
echo "  Health API Endpoint:    http://localhost:3000/api/targets"
echo "=========================================================="
echo "To view live logs: docker compose logs -f web-monitor"
echo "To stop:           docker compose down"
