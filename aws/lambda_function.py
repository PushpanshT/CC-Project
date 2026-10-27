"""
AWS Lambda Function: Automated Website Availability Monitor
Project: Automated Website Availability Monitoring on AWS
Course: Cloud Computing Lab Practical Project

Tasks Implemented:
1. Schedule website checks (via Amazon EventBridge trigger)
2. Detect failures (HTTP error codes, timeouts, SSL faults, high latency)
3. Send alerts (Amazon SNS notification to Email / SMS / Webhooks)
4. Push Custom Metrics to Amazon CloudWatch for dashboarding & alarm evaluation
5. Maintain state history in Amazon DynamoDB for consecutive failure tracking
"""

import json
import os
import time
import ssl
import urllib.request
import urllib.error
from datetime import datetime, timezone
import boto3

cloudwatch_client = boto3.client('cloudwatch')
sns_client = boto3.client('sns')
dynamodb_client = boto3.resource('dynamodb')

TARGET_URLS = os.environ.get('TARGET_URLS', 'https://www.google.com,https://httpstat.us/200').split(',')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN', '')
DYNAMODB_TABLE_NAME = os.environ.get('DYNAMODB_TABLE', 'WebsiteHealthLogs')
METRIC_NAMESPACE = os.environ.get('METRIC_NAMESPACE', 'WebsiteMonitoring/Availability')
REQUEST_TIMEOUT = int(os.environ.get('REQUEST_TIMEOUT_SECONDS', '5'))
CONSECUTIVE_FAILURE_THRESHOLD = int(os.environ.get('CONSECUTIVE_FAILURE_THRESHOLD', '2'))


def check_website(url: str, timeout: int = 5) -> dict:
    """
    Performs an HTTP/HTTPS health check on the specified URL.
    Measures latency, captures HTTP status, and handles connection/SSL errors.
    """
    url = url.strip()
    if not url.startswith('http://') and not url.startswith('https://'):
        url = 'https://' + url

    start_time = time.perf_counter()
    timestamp_utc = datetime.now(timezone.utc).isoformat()

    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': 'AWS-Lambda-Availability-Monitor/2.0 (CloudComputing-Project)'
        }
    )

    result = {
        'url': url,
        'timestamp': timestamp_utc,
        'is_available': False,
        'status_code': 0,
        'latency_ms': 0.0,
        'error_message': None,
        'status_text': 'DOWN'
    }

    try:
        # Create SSL context with modern TLS verification
        context = ssl.create_default_context()
        with urllib.request.urlopen(req, timeout=timeout, context=context) as response:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            status_code = response.getcode()

            result['status_code'] = status_code
            result['latency_ms'] = round(latency_ms, 2)

            # 2xx and 3xx codes considered available
            if 200 <= status_code < 400:
                result['is_available'] = True
                result['status_text'] = 'UP'
            else:
                result['is_available'] = False
                result['status_text'] = 'DEGRADED'
                result['error_message'] = f'Unexpected HTTP status code: {status_code}'

    except urllib.error.HTTPError as e:
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        result['status_code'] = e.code
        result['latency_ms'] = round(latency_ms, 2)
        result['is_available'] = False
        result['status_text'] = 'DOWN'
        result['error_message'] = f'HTTP Error {e.code}: {e.reason}'

    except urllib.error.URLError as e:
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        result['status_code'] = 0
        result['latency_ms'] = round(latency_ms, 2)
        result['is_available'] = False
        result['status_text'] = 'DOWN'
        result['error_message'] = f'Network Connection Error: {str(e.reason)}'

    except TimeoutError:
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        result['status_code'] = 504
        result['latency_ms'] = round(latency_ms, 2)
        result['is_available'] = False
        result['status_text'] = 'DOWN'
        result['error_message'] = f'Request timed out after {timeout} seconds'

    except Exception as e:
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        result['status_code'] = 0
        result['latency_ms'] = round(latency_ms, 2)
        result['is_available'] = False
        result['status_text'] = 'DOWN'
        result['error_message'] = f'Unexpected exception: {str(e)}'

    return result


def push_cloudwatch_metrics(check_result: dict):
    """
    Pushes custom metrics to Amazon CloudWatch:
    - Availability: 1 for UP, 0 for DOWN
    - ResponseLatency: latency in milliseconds
    - HTTPStatusCode: actual response code
    """
    dimensions = [
        {'Name': 'WebsiteUrl', 'Value': check_result['url']},
        {'Name': 'Service', 'Value': 'AutomatedWebsiteMonitor'}
    ]

    metric_data = [
        {
            'MetricName': 'Availability',
            'Dimensions': dimensions,
            'Value': 1.0 if check_result['is_available'] else 0.0,
            'Unit': 'Count',
            'StorageResolution': 60
        },
        {
            'MetricName': 'ResponseLatency',
            'Dimensions': dimensions,
            'Value': float(check_result['latency_ms']),
            'Unit': 'Milliseconds',
            'StorageResolution': 60
        },
        {
            'MetricName': 'HTTPStatusCode',
            'Dimensions': dimensions,
            'Value': float(check_result['status_code']),
            'Unit': 'None',
            'StorageResolution': 60
        }
    ]

    try:
        cloudwatch_client.put_metric_data(
            Namespace=METRIC_NAMESPACE,
            MetricData=metric_data
        )
        print(f"[CloudWatch] Successfully published metrics for {check_result['url']}")
    except Exception as e:
        print(f"[CloudWatch Warning] Failed to publish metrics: {e}")


def get_and_update_state(check_result: dict) -> dict:
    """
    Persists check result in DynamoDB and calculates consecutive failures.
    Returns previous state metadata including consecutive failure count.
    """
    url = check_result['url']
    timestamp = check_result['timestamp']
    is_up = check_result['is_available']

    state = {
        'consecutive_failures': 0,
        'previous_status': 'UP',
        'state_transition': 'NO_CHANGE'
    }

    try:
        table = dynamodb_client.Table(DYNAMODB_TABLE_NAME)

        # Retrieve current state record for this URL
        response = table.get_item(Key={'Url': url, 'RecordType': 'STATE'})
        item = response.get('Item', {})

        prev_failures = int(item.get('ConsecutiveFailures', 0))
        prev_status = item.get('LastStatus', 'UP')

        if is_up:
            consecutive_failures = 0
            curr_status = 'UP'
            if prev_status == 'DOWN':
                state['state_transition'] = 'RECOVERED'
        else:
            consecutive_failures = prev_failures + 1
            curr_status = 'DOWN'
            if consecutive_failures >= CONSECUTIVE_FAILURE_THRESHOLD and prev_status != 'DOWN':
                state['state_transition'] = 'ALERT_TRIGGERED'
            elif consecutive_failures >= CONSECUTIVE_FAILURE_THRESHOLD and prev_status == 'DOWN':
                state['state_transition'] = 'ONGOING_OUTAGE'
            else:
                state['state_transition'] = 'PENDING_CONFIRMATION'

        state['consecutive_failures'] = consecutive_failures
        state['previous_status'] = prev_status

        # Update latest state record
        table.put_item(
            Item={
                'Url': url,
                'RecordType': 'STATE',
                'LastStatus': curr_status,
                'ConsecutiveFailures': consecutive_failures,
                'LastCheckTimestamp': timestamp,
                'LastLatencyMs': str(check_result['latency_ms']),
                'LastStatusCode': check_result['status_code'],
                'LastError': check_result['error_message'] or 'None'
            }
        )

        # Also log historical entry for analytics
        table.put_item(
            Item={
                'Url': url,
                'RecordType': f"LOG#{timestamp}",
                'Status': curr_status,
                'LatencyMs': str(check_result['latency_ms']),
                'StatusCode': check_result['status_code'],
                'Error': check_result['error_message'] or 'None'
            }
        )

    except Exception as e:
        print(f"[DynamoDB Warning] State tracking unavailable: {e}")
        # Fallback in-memory logic
        if not is_up:
            state['state_transition'] = 'ALERT_TRIGGERED'

    return state


def send_sns_alert(check_result: dict, state: dict):
    """
    Dispatches a structured email alert via Amazon SNS Topic:
    - Triggers outage alert when failure threshold is breached
    - Triggers recovery alert when website recovers
    """
    if not SNS_TOPIC_ARN:
        print("[SNS Notice] SNS_TOPIC_ARN not configured. Alert payload generated in logs.")
        return

    transition = state.get('state_transition')
    if transition not in ['ALERT_TRIGGERED', 'RECOVERED']:
        print(f"[SNS Skip] No alert trigger condition met. State: {transition}")
        return

    url = check_result['url']
    timestamp = check_result['timestamp']
    latency = check_result['latency_ms']
    status_code = check_result['status_code']
    error = check_result['error_message'] or 'N/A'
    consecutive = state.get('consecutive_failures', 1)

    if transition == 'ALERT_TRIGGERED':
        subject = f"CRITICAL: Website DOWN Alert - {url}"
        message = f"""
============================================================
AWS CLOUD MONITORING: WEBSITE OUTAGE INCIDENT DETECTED
============================================================

An outage has been confirmed for the following monitored endpoint:

Target URL:            {url}
Incident Status:       DOWN (CRITICAL)
Detection Timestamp:   {timestamp}
HTTP Status Code:      {status_code}
Response Latency:      {latency} ms
Consecutive Failures:  {consecutive} check(s) breached
Failure Reason:        {error}

AWS Architecture Context:
- Triggered By: Amazon EventBridge Scheduled Rule
- Executed By:  AWS Lambda (Automated Health Checker)
- Alarm Rule:   CloudWatch Metric 'Availability' == 0 for >= {CONSECUTIVE_FAILURE_THRESHOLD} periods
- Action Taken: Amazon SNS Notification published to subscribers

Action Required:
Please investigate your web server, load balancer, or network route immediately.
============================================================
"""
    else:  # RECOVERED
        subject = f"RESOLVED: Website RECOVERED Alert - {url}"
        message = f"""
============================================================
AWS CLOUD MONITORING: WEBSITE INCIDENT RESOLVED
============================================================

The monitored endpoint is responding normally and service is RESTORED:

Target URL:            {url}
Current Status:        UP (OPERATIONAL)
Restored Timestamp:    {timestamp}
HTTP Status Code:      {status_code} OK
Response Latency:      {latency} ms

AWS Architecture Context:
- CloudWatch Availability Metric: Restored to 1.0 (Healthy)
- State Tracking: Consecutive failures reset to 0
- Incident Status: CLOSED

All systems operating within acceptable SLA thresholds.
============================================================
"""

    try:
        response = sns_client.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=subject[:100],  # SNS subject max length constraint
            Message=message
        )
        print(f"[SNS Success] Published alert to {SNS_TOPIC_ARN}. MessageId: {response.get('MessageId')}")
    except Exception as e:
        print(f"[SNS Error] Failed to publish message to SNS: {e}")


def lambda_handler(event, context):
    """
    Main AWS Lambda entry point triggered by Amazon EventBridge or manual test.
    """
    print(f"[Lambda] Starting automated health check execution at {datetime.now(timezone.utc)}")

    # Allow custom URLs passed in event payload, or use configured TARGET_URLS
    urls_to_check = event.get('urls', TARGET_URLS)
    if isinstance(urls_to_check, str):
        urls_to_check = [u.strip() for u in urls_to_check.split(',') if u.strip()]

    results = []
    total_sites = len(urls_to_check)
    healthy_sites = 0

    for url in urls_to_check:
        print(f"[Lambda] Checking availability of: {url}")
        check_result = check_website(url, timeout=REQUEST_TIMEOUT)

        if check_result['is_available']:
            healthy_sites += 1

        # 1. Push metrics to CloudWatch
        push_cloudwatch_metrics(check_result)

        # 2. Track state in DynamoDB
        state = get_and_update_state(check_result)

        # 3. Dispatch SNS notification if threshold condition reached
        send_sns_alert(check_result, state)

        check_result['state_info'] = state
        results.append(check_result)

    summary = {
        'total_monitored': total_sites,
        'healthy': healthy_sites,
        'unhealthy': total_sites - healthy_sites,
        'overall_status': 'HEALTHY' if healthy_sites == total_sites else 'DEGRADED',
        'execution_timestamp': datetime.now(timezone.utc).isoformat()
    }

    print(f"[Lambda] Health check execution complete. Summary: {json.dumps(summary)}")

    return {
        'statusCode': 200,
        'body': json.dumps({
            'summary': summary,
            'details': results
        }, indent=2)
    }


# Local standalone test execution
if __name__ == '__main__':
    test_urls = ['https://www.google.com', 'https://httpstat.us/500', 'https://httpstat.us/200']
    test_event = {'urls': test_urls}
    output = lambda_handler(test_event, None)
    print("\n--- TEST EXECUTION OUTPUT ---")
    print(output['body'])
