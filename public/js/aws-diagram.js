/**
 * Interactive AWS Cloud Architecture Explorer
 * Cloud Computing Lab Practical Project
 */

const awsArchitectureNodes = {
  eventbridge: {
    title: 'Amazon EventBridge (CloudWatch Events)',
    category: 'Serverless Event Bus & Scheduler',
    description: 'Acts as the heartbeat chronometer for the monitoring system. Emits scheduled events at user-configured frequencies (e.g. rate(1 minute) or rate(5 minutes)) that trigger the health-check Lambda function.',
    specs: [
      'Rule Type: Scheduled Rule',
      'Expression: rate(5 minutes) or rate(1 minute)',
      'Target: AWS Lambda Function (AutomatedWebsiteAvailabilityChecker)',
      'Cost: Free Tier eligible ($0 on default event bus)'
    ],
    iamPolicy: `{
  "Effect": "Allow",
  "Action": "lambda:InvokeFunction",
  "Resource": "arn:aws:lambda:*:*:function:AutomatedWebsiteAvailabilityChecker",
  "Principal": "events.amazonaws.com"
}`,
    codeSnippet: `# AWS CloudFormation EventBridge Rule Snippet
MonitoringScheduleRule:
  Type: AWS::Events::Rule
  Properties:
    ScheduleExpression: 'rate(5 minutes)'
    Targets:
      - Arn: !GetAtt AvailabilityCheckerLambda.Arn
        Id: 'AvailabilityCheckerTarget'`
  },

  lambda: {
    title: 'AWS Lambda (Python 3.12 Runtime)',
    category: 'Serverless Compute Execution',
    description: 'Executes the core synthetic health-check logic. Performs HTTP/HTTPS GET requests, calculates round-trip latency, inspects status codes, publishes custom CloudWatch metrics, checks consecutive failure thresholds, and dispatches SNS alerts.',
    specs: [
      'Runtime: Python 3.12 (x86_64)',
      'Memory: 128 MB',
      'Timeout: 30 Seconds',
      'Execution Frequency: Triggered every 1-5 minutes by EventBridge',
      'Concurrency: On-Demand scaling'
    ],
    iamPolicy: `{
  "Effect": "Allow",
  "Action": [
    "logs:CreateLogStream",
    "logs:PutLogEvents",
    "cloudwatch:PutMetricData",
    "sns:Publish",
    "dynamodb:PutItem",
    "dynamodb:GetItem"
  ],
  "Resource": "*"
}`,
    codeSnippet: `# Core Availability Logic in Python Lambda
with urllib.request.urlopen(req, timeout=5, context=ssl_ctx) as response:
    latency_ms = (time.perf_counter() - start_time) * 1000.0
    status_code = response.getcode()
    is_available = 200 <= status_code < 400`
  },

  endpoints: {
    title: 'Monitored Web Endpoints (HTTP/HTTPS Targets)',
    category: 'External & Internal Web Applications',
    description: 'The target websites, APIs, or microservices being monitored for availability and latency. Tested across SSL certificates, TCP handshake, HTTP status response, and payload delivery.',
    specs: [
      'Protocols Supported: HTTP, HTTPS (TLS 1.2 / TLS 1.3)',
      'Health Criteria: Response Code 200-399 and Latency < 5000ms',
      'Failure Modes: 5xx Server Errors, 4xx Client Errors, Connection Refused, SSL Expiration, DNS Failures'
    ],
    iamPolicy: `N/A - Public or VPC Internal network endpoint.
Ensure Security Group egress rule on port 443/80 is open.`,
    codeSnippet: `GET /health HTTP/1.1
Host: www.target-app.com
User-Agent: AWS-CloudMonitoring-HealthChecker/2.0`
  },

  cloudwatch: {
    title: 'Amazon CloudWatch (Metrics & Alarms)',
    category: 'Cloud Telemetry & Alarm Engine',
    description: 'Ingests custom availability metrics (Availability = 1/0, ResponseLatency = ms) from Lambda. Evaluates CloudWatch Alarms with consecutive period rules (e.g. 2 evaluation periods < 1) to eliminate false alarms and trigger SNS notifications.',
    specs: [
      'Namespace: WebsiteMonitoring/Availability',
      'Custom Metrics: Availability (Count), ResponseLatency (Milliseconds)',
      'Alarm Condition: Availability < 1 for 2 consecutive evaluation periods',
      'Alarm Actions: Triggers Amazon SNS Outage Topic',
      'OK Actions: Triggers Amazon SNS Recovery Topic'
    ],
    iamPolicy: `{
  "Effect": "Allow",
  "Action": "cloudwatch:PutMetricData",
  "Resource": "*"
}`,
    codeSnippet: `# Publishing CloudWatch Custom Metrics via Boto3
cloudwatch.put_metric_data(
    Namespace='WebsiteMonitoring/Availability',
    MetricData=[
        {'MetricName': 'Availability', 'Value': 1.0, 'Unit': 'Count'},
        {'MetricName': 'ResponseLatency', 'Value': 84.5, 'Unit': 'Milliseconds'}
    ]
)`
  },

  sns: {
    title: 'Amazon SNS (Simple Notification Service)',
    category: 'Multi-Channel Alert Dispatcher',
    description: 'Provides pub/sub notification routing for immediate incident alerting. When an alarm triggers or resolves, SNS broadcasts formatted email, SMS, or webhook messages to incident responders.',
    specs: [
      'Topic Type: Standard SNS Topic',
      'Subscription Protocol: Email / SMS / HTTPS Webhook',
      'Alert Types: Critical Outage Alert & Restored Recovery Alert',
      'Delivery Guarantee: At-least-once real-time dispatch'
    ],
    iamPolicy: `{
  "Effect": "Allow",
  "Action": "sns:Publish",
  "Resource": "arn:aws:sns:*:*:WebsiteAvailabilityAlertsTopic"
}`,
    codeSnippet: `# Dispatching SNS Notification via Boto3
sns.publish(
    TopicArn=SNS_TOPIC_ARN,
    Subject='CRITICAL: Website DOWN Alert - https://target.com',
    Message='Status Code: 500\\nLatency: 420ms\\nConsecutive Failures: 2'
)`
  },

  dynamodb: {
    title: 'Amazon DynamoDB (Health Logs & State)',
    category: 'Serverless NoSQL State Store',
    description: 'Stores stateful health check records and historical audit logs. Tracks consecutive failure strikes and previous known state to identify recovery transitions.',
    specs: [
      'Table Name: WebsiteHealthLogs',
      'Partition Key: Url (String)',
      'Sort Key: RecordType (String)',
      'Billing Mode: On-Demand (Pay per request)',
      'Time to Live (TTL): Automatic 30-day log expiration'
    ],
    iamPolicy: `{
  "Effect": "Allow",
  "Action": [
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:UpdateItem"
  ],
  "Resource": "arn:aws:dynamodb:*:*:table/WebsiteHealthLogs"
}`,
    codeSnippet: `# DynamoDB State Retrieval & Update
table.put_item(
    Item={
        'Url': url,
        'RecordType': 'STATE',
        'LastStatus': 'UP',
        'ConsecutiveFailures': 0,
        'Timestamp': timestamp
    }
)`
  }
};

function selectArchNode(nodeKey) {
  const nodeData = awsArchitectureNodes[nodeKey];
  if (!nodeData) return;

  // Highlight selected node
  document.querySelectorAll('.arch-node').forEach(el => {
    el.classList.toggle('selected', el.getAttribute('data-node') === nodeKey);
  });

  const detailBox = document.getElementById('arch-detail-box');
  if (!detailBox) return;

  detailBox.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
      <div>
        <h3 style="font-size:1.25rem; font-weight:800; color:#f3f4f6;">${nodeData.title}</h3>
        <span style="font-size:0.8rem; color:#06b6d4; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">${nodeData.category}</span>
      </div>
      <span class="badge-rec">AWS Cloud Native</span>
    </div>
    <p style="color:#9ca3af; margin-bottom:1.25rem; line-height:1.7;">${nodeData.description}</p>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; margin-bottom:1.25rem;">
      <div style="background:#0a0a0c; padding:1rem; border-radius:8px; border:1px solid rgba(255,255,255,0.08);">
        <h4 style="font-size:0.85rem; color:#cbd5e1; margin-bottom:0.5rem;">Specifications & Parameters</h4>
        <ul style="list-style:none; padding:0; font-size:0.8rem; color:#9ca3af; line-height:1.7;">
          ${nodeData.specs.map(s => `<li>• ${s}</li>`).join('')}
        </ul>
      </div>
      <div style="background:#0a0a0c; padding:1rem; border-radius:8px; border:1px solid rgba(255,255,255,0.08);">
        <h4 style="font-size:0.85rem; color:#cbd5e1; margin-bottom:0.5rem;">IAM Policy Permission</h4>
        <pre style="font-family:'JetBrains Mono',monospace; font-size:0.75rem; color:#a5b4fc; overflow-x:auto;">${nodeData.iamPolicy}</pre>
      </div>
    </div>

    <div style="background:#000000; padding:1rem; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
      <h4 style="font-size:0.85rem; color:#cbd5e1; margin-bottom:0.5rem;">Code / IaC Implementation</h4>
      <pre style="font-family:'JetBrains Mono',monospace; font-size:0.8rem; color:#34d399; overflow-x:auto;">${nodeData.codeSnippet}</pre>
    </div>
  `;
}
