# Docker Deployment Guide: Automated Website Availability Monitor

This guide explains how to build, run, and manage the **Automated Website Availability Monitoring** system locally inside Docker containers.

---

## 📋 Prerequisites
- **Docker Desktop** installed and running on your machine ([Download Docker Desktop](https://www.docker.com/products/docker-desktop/))
- **Docker Compose** (included by default in modern Docker Desktop)

---

## 🚀 Quick Start (1-Command Deploy)

### Option 1: Using PowerShell (Windows)
From the project root directory, run:
```powershell
.\docker-deploy.ps1
```

### Option 2: Using Docker Compose CLI directly
```bash
docker compose up -d --build
```

### Option 3: Using Bash (Linux / macOS / WSL)
```bash
chmod +x docker-deploy.sh
./docker-deploy.sh
```

Once the container finishes starting, open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🛠️ Docker Architecture & Components

The containerized setup uses a multi-runtime image combining:
1. **Node.js 20**: Powers the Express REST API, synthetic health checker scheduler, and static web dashboard.
2. **Python 3 & boto3**: Powers the local parity executor for `aws/lambda_function.py`, allowing testing of genuine AWS Lambda logic inside the container.
3. **Healthcheck integration**: Built-in container health check querying `http://localhost:3000/api/targets` every 30 seconds.

```
+-------------------------------------------------------------+
|               DOCKER CONTAINER (Port: 3000)                 |
|                                                             |
|  +---------------------------+   +-----------------------+  |
|  |     Frontend UI           |   |    Express REST API   |  |
|  |  (HTML5/CSS Glassmorphism)|<->|   (Synthetic Engine)  |  |
|  +---------------------------+   +-----------+-----------+  |
|                                              |              |
|                                              v              |
|                                  +-----------+-----------+  |
|                                  |   Python 3 + boto3    |  |
|                                  |  (Local Lambda Parity)|  |
|                                  +-----------------------+  |
+-------------------------------------------------------------+
```

---

## ☁️ Optional: Emulating Full AWS Cloud Locally (LocalStack)

If you wish to simulate AWS CloudWatch, SNS, EventBridge, and DynamoDB locally without creating an AWS account or incurring any cloud costs:

```bash
docker compose --profile cloud up -d --build
```

This starts:
- **`web-monitor`**: On `http://localhost:3000`
- **`aws-localstack-emulator`**: On `http://localhost:4566` (Mock AWS services)

---

## 🔧 Useful Docker Commands

| Action | Command |
|---|---|
| **View Live Container Logs** | `docker compose logs -f web-monitor` |
| **Check Container Status** | `docker compose ps` |
| **Stop Application** | `docker compose down` |
| **Restart Application** | `docker compose restart` |
| **Rebuild Image From Scratch** | `docker compose build --no-cache` |
| **Execute Shell in Container** | `docker exec -it aws-website-availability-monitor sh` |

---

## 🐛 Troubleshooting

### Issue 1: "failed to connect to the docker API" / "Docker daemon is not running"
- **Cause**: Docker Desktop is installed but the application/engine has not finished starting.
- **Fix**: Open **Docker Desktop** from your Windows Start Menu, wait until the bottom-left status icon turns green ("Engine running"), and then re-run `.\docker-deploy.ps1`.

### Issue 2: Port 3000 already in use
- **Cause**: A local instance of `node server.js` is already running on port 3000.
- **Fix**: Either stop the local process or change the port mapping in `docker-compose.yml` (e.g. `"3001:3000"`).
