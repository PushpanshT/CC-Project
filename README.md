# Automated Website Availability Monitoring on AWS

> **Cloud Computing Laboratory Practical Project**  
> **Project Title:** Implement Automated Website Availability Monitoring on AWS  
> **Practical Tasks:** Schedule website checks, detect failures, send alerts, and evaluate monitoring frequency.

---

## 🌟 Architecture Overview

```
+------------------------------------+
|   Amazon EventBridge (Scheduler)   |
|   Rate: rate(1 minute / 5 minutes) |
+------------------+-----------------+
                   | triggers
                   v
+------------------+-----------------+
|        AWS Lambda Function         |
|  (HTTP Check + Latency Measurement)|
+--------+------------------+--------+
         |                  |
         | puts metrics     | triggers if failure
         v                  v
+--------+---------+   +----+---------+
| Amazon CloudWatch|   |  Amazon SNS  |
| Custom Metrics & |   | Topic: Email |
| 2-Strike Alarms  |   | Notification |
+------------------+   +--------------+
         |
         v
+--------+---------+
| Amazon DynamoDB  |
| State & History  |
+------------------+
```

---

## 🚀 Key Features

1. **Automated Scheduled Health Checking (`Task 1: Schedule website checks`)**:
   - Continuous synthetic HTTP/HTTPS health checks driven by **Amazon EventBridge**.
   - Custom headers, round-trip latency measurement (ms), TLS/SSL validation, and response code verification.

2. **Intelligent Failure Detection (`Task 2: Detect failures`)**:
   - Ingests telemetry into **Amazon CloudWatch Custom Metrics** (`Availability`, `ResponseLatency`, `HTTPStatusCode`).
   - Evaluates a **2-consecutive evaluation period rule** to suppress transient false positives.
   - Categorizes failures: HTTP 5xx Server Errors, 4xx Routing Faults, 504 Timeouts, DNS Resolution Failures.

3. **Multi-Channel Alert Dispatching (`Task 3: Send alerts`)**:
   - Integrates with **Amazon Simple Notification Service (SNS)**.
   - Sends formatted **CRITICAL: Outage Incident Alerts** with failure reasons and latency details.
   - Dispatches **RESOLVED: Recovery Alerts** automatically when service is restored.

4. **In-Depth Frequency Evaluation (`Task 4: Evaluate monitoring frequency`)**:
   - Comprehensive comparative study across 8 intervals: **30s, 1m, 3m, 5m, 10m, 15m, 30m, 60m**.
   - Dynamic charts evaluating **Mean Time to Detect (MTTD)**, **Monthly AWS Serverless Costs**, **Target Server Load**, and **False Positive Sensitivity**.
   - Interactive **SLA & Frequency Recommender Calculator** based on desired uptime SLAs (99.0% to 99.99%).

5. **Full-Stack Interactive Dashboard**:
   - Beautiful, modern dark-mode user interface with glassmorphism and micro-animations.
   - Live terminal log stream, failure sandbox, and realistic AWS SNS email previewer.

---

## 📁 Repository Structure

```
Project/
├── README.md                          # Quickstart, setup, and architecture summary
├── PROJECT_REPORT.md                  # Comprehensive academic lab project report
├── aws/
│   ├── lambda_function.py             # Production AWS Lambda Python health-check function
│   ├── cloudformation_template.yaml   # AWS CloudFormation Infrastructure as Code (IaC)
│   ├── setup_guide_aws_console.md     # Step-by-step AWS Management Console manual tutorial
│   ├── test_payload.json              # Lambda test event payload
│   ├── terraform/                     # Terraform IaC alternative
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── setup_scripts/
│       ├── deploy_aws.ps1             # PowerShell automated deployment script
│       └── deploy_aws.sh              # Bash automated deployment script
├── server/
│   ├── package.json                   # Backend dependencies (Express, CORS)
│   ├── server.js                      # Express API server & simulation engine
│   └── checker.js                     # HTTP health checker & frequency math model
└── public/
    ├── index.html                     # Interactive dashboard single-page app
    ├── css/
    │   └── style.css                  # Responsive design system & glassmorphism
    └── js/
        ├── app.js                     # State controller, API hooks & terminal logging
        ├── charts.js                  # Chart.js visualization engine for frequency evaluation
        └── aws-diagram.js             # Interactive AWS cloud topology visualizer
```

---

## 💻 Running the Live Interactive Dashboard Locally

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Start the Server
```bash
node server.js
```

### 3. Open in Browser
Navigate to:
```
http://localhost:3000
```


---

## 🐳 Running with Docker (Containerized Deployment)

You can run the entire system in a standardized Docker container (Node.js 20 + Python 3 runtime):

### Quick Deploy (1-Step)
```powershell
# Windows PowerShell
.\docker-deploy.ps1

# Linux / macOS / WSL
chmod +x docker-deploy.sh && ./docker-deploy.sh
```

### Or using Docker Compose directly
```bash
docker compose up -d --build
```
Navigate to: **`http://localhost:3000`**

For comprehensive container documentation and LocalStack AWS cloud emulation, see [`DOCKER_GUIDE.md`](file:///c:/Users/ashee/OneDrive/Desktop/Lab%20Practicals/Cloud%20Computing/Project/DOCKER_GUIDE.md).

---

## ☁️ Deploying to Amazon Web Services (AWS)

### Option A: AWS CloudFormation (Recommended)
1. In the **AWS Management Console**, navigate to **CloudFormation** -> **Create stack**.
2. Upload `aws/cloudformation_template.yaml`.
3. Specify parameters:
   - `TargetWebsiteUrl`: URL to monitor (e.g. `https://example.com`)
   - `MonitoringFrequencyMinutes`: `5` (or `1`)
   - `NotificationEmail`: Your email to receive alerts
4. Acknowledge IAM role creation and click **Submit**.
5. Check your inbox and click **Confirm subscription** on the AWS SNS verification email.

### Option B: Terraform
```bash
cd aws/terraform
terraform init
terraform plan
terraform apply
```

### Option C: Manual AWS Console Setup
Follow the complete guide in [`aws/setup_guide_aws_console.md`](file:///c:/Users/ashee/OneDrive/Desktop/Lab%20Practicals/Cloud%20Computing/Project/aws/setup_guide_aws_console.md).

---

## 📊 Summary of Monitoring Frequency Evaluation

| Frequency | MTTD | Invocations/Mo | AWS Cost/Mo | False Positive Risk | Recommended Use Case |
|---|---|---|---|---|---|
| **30 Seconds** | 15s | 86,400 | ~$1.19 | High (Jitter sensitive) | Mission Critical (FinTech/Payments) |
| **1 Minute** | 30s | 43,200 | ~$1.11 | Moderate | High Availability SLA (99.99%) |
| **3 Minutes** | 1.5m | 14,400 | ~$1.10 | Low | SaaS APIs & Business Applications |
| **5 Minutes** | 2.5m | 8,640 | ~$1.10 | Negligible | **Optimal Standard Recommendation** |
| **15 Minutes** | 7.5m | 2,880 | ~$1.10 | Negligible | Cost-Optimized / Staging |
| **60 Minutes** | 30.0m | 720 | ~$1.10 | Negligible | Low Priority / Static Sites |

---

## 🎓 Academic Lab Submission
For full academic documentation, theoretical background, and experimental test cases, refer to [`PROJECT_REPORT.md`](file:///c:/Users/ashee/OneDrive/Desktop/Lab%20Practicals/Cloud%20Computing/Project/PROJECT_REPORT.md).
