# PowerShell Deployment Script for Automated Website Availability Monitoring on AWS
param (
    [string]$StackName = "WebsiteAvailabilityMonitoringStack",
    [string]$TargetUrl = "https://www.google.com",
    [int]$FrequencyMinutes = 5,
    [string]$AlertEmail = "student.cloudlab@example.com",
    [string]$Region = "us-east-1"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " AWS CLOUD DEPLOYMENT: Website Availability Monitor" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Target URL:        $TargetUrl"
Write-Host "Check Frequency:   Every $FrequencyMinutes minute(s)"
Write-Host "Notification Email:$AlertEmail"
Write-Host "Region:            $Region"
Write-Host "Stack Name:        $StackName"
Write-Host "=========================================================="

# Check AWS CLI availability
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Warning "AWS CLI is not installed or not in system PATH."
    Write-Host "You can deploy directly via the AWS Management Console using aws/cloudformation_template.yaml or aws/setup_guide_aws_console.md." -ForegroundColor Yellow
    exit 1
}

Write-Host "Deploying CloudFormation Stack..." -ForegroundColor Cyan
aws cloudformation deploy `
    --template-file "../cloudformation_template.yaml" `
    --stack-name $StackName `
    --parameter-overrides TargetWebsiteUrl=$TargetUrl MonitoringFrequencyMinutes=$FrequencyMinutes NotificationEmail=$AlertEmail `
    --capabilities CAPABILITY_NAMED_IAM `
    --region $Region

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nStack deployed successfully!" -ForegroundColor Green
    Write-Host "Please check your inbox at $AlertEmail to confirm the SNS subscription!" -ForegroundColor Yellow
    aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs" --output table
} else {
    Write-Error "Deployment failed. Check CloudFormation logs."
}
