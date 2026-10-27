# AWS Management Console Setup Guide: Automated Website Availability Monitoring

This guide provides step-by-step instructions to manually implement and configure the complete automated website availability monitoring architecture on AWS using the AWS Management Console.

---

## Architecture Overview
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
| Alarm Rules      |   | Notification |
+------------------+   +--------------+
```

---

## Step 1: Create Amazon SNS Topic & Email Subscription
1. Log in to the [AWS Management Console](https://console.aws.amazon.com/).
2. Navigate to **Amazon SNS** (Simple Notification Service).
3. In the left navigation pane, choose **Topics**, then click **Create topic**.
4. Configure Topic:
   - **Type**: Standard
   - **Name**: `WebsiteAvailabilityAlertsTopic`
   - **Display name**: `Website Alert`
5. Click **Create topic**.
6. Copy the generated **Topic ARN** (e.g., `arn:aws:sns:us-east-1:123456789012:WebsiteAvailabilityAlertsTopic`).
7. Under the **Subscriptions** tab, click **Create subscription**:
   - **Protocol**: Email
   - **Endpoint**: Enter your personal / student email address.
8. Click **Create subscription**.
9. **CRITICAL**: Check your email inbox for an email from *AWS Notifications* with subject *"AWS Notification - Subscription Confirmation"* and click **Confirm subscription**.

---

## Step 2: Create Amazon DynamoDB Table (Optional State Store)
1. Navigate to **DynamoDB**.
2. Click **Create table**:
   - **Table name**: `WebsiteHealthLogs`
   - **Partition key (Hash)**: `Url` (String)
   - **Sort key (Range)**: `RecordType` (String)
   - **Table settings**: Default settings (On-Demand / Pay per request).
3. Click **Create table**.

---

## Step 3: Create AWS IAM Role for Lambda
1. Navigate to **IAM** -> **Roles** -> **Create role**.
2. Select **Trusted entity type**: AWS service -> **Lambda**.
3. Under **Add permissions**, attach:
   - `AWSLambdaBasicExecutionRole` (AWS managed)
4. Add Inline Policy named `WebsiteMonitoringAccess`:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "cloudwatch:PutMetricData",
         "Resource": "*"
       },
       {
         "Effect": "Allow",
         "Action": "sns:Publish",
         "Resource": "<YOUR_SNS_TOPIC_ARN>"
       },
       {
         "Effect": "Allow",
         "Action": [
           "dynamodb:GetItem",
           "dynamodb:PutItem",
           "dynamodb:UpdateItem"
         ],
         "Resource": "arn:aws:dynamodb:*:*:table/WebsiteHealthLogs"
       }
     ]
   }
   ```
5. Name the role `WebsiteMonitoringLambdaRole` and click **Create role**.

---

## Step 4: Create AWS Lambda Function
1. Navigate to **AWS Lambda** -> **Create function**.
2. Choose **Author from scratch**:
   - **Function name**: `AutomatedWebsiteAvailabilityChecker`
   - **Runtime**: Python 3.12 (or Python 3.11)
   - **Architecture**: x86_64
   - **Execution role**: Use an existing role -> Select `WebsiteMonitoringLambdaRole`.
3. Click **Create function**.
4. Paste the Python code from `aws/lambda_function.py` into `lambda_function.py` in the code editor.
5. In **Configuration** -> **Environment variables**, click **Edit** and add:
   - `TARGET_URLS`: `https://www.google.com,https://httpstat.us/200`
   - `SNS_TOPIC_ARN`: `<YOUR_SNS_TOPIC_ARN>`
   - `METRIC_NAMESPACE`: `WebsiteMonitoring/Availability`
   - `REQUEST_TIMEOUT_SECONDS`: `5`
   - `CONSECUTIVE_FAILURE_THRESHOLD`: `2`
6. In **Configuration** -> **General configuration**, set:
   - **Timeout**: `30 sec`
   - **Memory**: `128 MB`
7. Click **Deploy**.

---

## Step 5: Schedule Website Checks using Amazon EventBridge
1. Navigate to **Amazon EventBridge** (or CloudWatch Events) -> **Rules** -> **Create rule**.
2. Configure Rule:
   - **Name**: `WebsiteCheckScheduleRule`
   - **Rule type**: Schedule
3. Set Schedule:
   - Choose **A schedule that runs at a regular rate**.
   - Rate expression: `rate(5 minutes)` or `rate(1 minute)` depending on frequency evaluation requirement.
4. Select Target:
   - **Target type**: AWS service
   - **Select a target**: Lambda function
   - **Function**: `AutomatedWebsiteAvailabilityChecker`
5. Click **Next** through tags and click **Create rule**.

---

## Step 6: Create Amazon CloudWatch Alarms
1. Navigate to **CloudWatch** -> **Alarms** -> **All alarms** -> **Create alarm**.
2. Click **Select metric**:
   - Browse to Custom namespace: `WebsiteMonitoring/Availability`
   - Select metric `Availability` for your monitored URL.
3. Metric configuration:
   - **Statistic**: Minimum
   - **Period**: 5 minutes (matching check interval)
4. Conditions:
   - **Threshold type**: Static
   - **Whenever Availability is...**: Lower than threshold (`< 1`)
5. Configure actions:
   - **Alarm state trigger**: In alarm
   - **Send notification to**: Select `WebsiteAvailabilityAlertsTopic`.
   - Add another action for **OK** state to send recovery alert.
6. Name Alarm: `WebsiteDownAlarm` and click **Create alarm**.

---

## Step 7: Verify and Test the Failure Detection
1. **Normal Test**: In Lambda console, click **Test** with empty `{}` event. Observe:
   - Lambda returns `statusCode: 200`.
   - CloudWatch metrics `Availability` = 1.0, `ResponseLatency` logged.
2. **Failure Simulation**:
   - Change `TARGET_URLS` in Lambda environment variables to `https://httpstat.us/500`.
   - Run the test or wait for EventBridge.
   - Lambda detects HTTP 500 error, marks site DOWN, pushes `Availability` = 0.0.
   - CloudWatch Alarm goes into `ALARM` state.
   - Check your email inbox: You receive the **CRITICAL: Website DOWN Alert**!
3. **Recovery Test**:
   - Switch `TARGET_URLS` back to `https://www.google.com`.
   - Next run detects 200 OK, pushes `Availability` = 1.0.
   - Alarm returns to `OK` state.
   - You receive the **RESOLVED: Website RECOVERED Alert**!
