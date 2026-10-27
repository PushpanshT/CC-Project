#!/usr/bin/env bash
# Shell Deployment Script for Automated Website Availability Monitoring on AWS
STACK_NAME="${1:-WebsiteAvailabilityMonitoringStack}"
TARGET_URL="${2:-https://www.google.com}"
FREQUENCY_MIN="${3:-5}"
ALERT_EMAIL="${4:-student.cloudlab@example.com}"
REGION="${5:-us-east-1}"

echo "=========================================================="
echo " AWS CLOUD DEPLOYMENT: Website Availability Monitor"
echo "=========================================================="
echo "Target URL:        $TARGET_URL"
echo "Check Frequency:   Every $FREQUENCY_MIN minute(s)"
echo "Notification Email:$ALERT_EMAIL"
echo "Region:            $REGION"
echo "Stack Name:        $STACK_NAME"
echo "=========================================================="

if ! command -v aws &> /dev/null; then
    echo "Warning: AWS CLI is not found. Use the AWS Console or CloudFormation template."
    exit 1
fi

aws cloudformation deploy \
    --template-file "../cloudformation_template.yaml" \
    --stack-name "$STACK_NAME" \
    --parameter-overrides TargetWebsiteUrl="$TARGET_URL" MonitoringFrequencyMinutes="$FREQUENCY_MIN" NotificationEmail="$ALERT_EMAIL" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$REGION"

echo "Deployment finished."
