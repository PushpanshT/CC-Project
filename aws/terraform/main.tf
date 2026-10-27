terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# 1. SNS Topic & Email Subscription
resource "aws_sns_topic" "alerts" {
  name         = "website-availability-alerts"
  display_name = "Website Outage & Recovery Alerts"
}

resource "aws_sns_topic_subscription" "email_sub" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# 2. DynamoDB Table for History & Consecutive Failure State
resource "aws_dynamodb_table" "health_logs" {
  name         = "WebsiteHealthLogs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "Url"
  range_key    = "RecordType"

  attribute {
    name = "Url"
    type = "S"
  }

  attribute {
    name = "RecordType"
    type = "S"
  }

  ttl {
    attribute_name = "TimeToLive"
    enabled        = true
  }

  tags = {
    Project     = "WebsiteAvailabilityMonitoring"
    Environment = "LabPractical"
  }
}

# 3. IAM Role for Lambda
resource "aws_iam_role" "lambda_exec" {
  name = "website_monitoring_lambda_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "website_monitoring_policy"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect   = "Allow"
        Action   = "cloudwatch:PutMetricData"
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = "sns:Publish"
        Resource = aws_sns_topic.alerts.arn
      },
      {
        Effect   = "Allow"
        Action   = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]
        Resource = aws_dynamodb_table.health_logs.arn
      }
    ]
  })
}

# 4. Lambda Function Archive
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda_function.py"
  output_path = "${path.module}/lambda_function.zip"
}

resource "aws_lambda_function" "checker" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "AutomatedWebsiteAvailabilityChecker"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 128
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      TARGET_URLS                    = var.target_url
      SNS_TOPIC_ARN                  = aws_sns_topic.alerts.arn
      DYNAMODB_TABLE                 = aws_dynamodb_table.health_logs.name
      METRIC_NAMESPACE               = "WebsiteMonitoring/Availability"
      REQUEST_TIMEOUT_SECONDS        = tostring(var.request_timeout)
      CONSECUTIVE_FAILURE_THRESHOLD  = tostring(var.consecutive_failure_threshold)
    }
  }
}

# 5. Amazon EventBridge (CloudWatch Events) Rule
resource "aws_cloudwatch_event_rule" "schedule" {
  name                = "website-check-schedule"
  description         = "Triggers Lambda website availability check based on evaluation frequency"
  schedule_expression = "rate(${var.monitoring_frequency_minutes} minute${var.monitoring_frequency_minutes > 1 ? "s" : ""})"
}

resource "aws_cloudwatch_event_target" "lambda_target" {
  rule      = aws_cloudwatch_event_rule.schedule.name
  target_id = "TriggerLambdaCheck"
  arn       = aws_lambda_function.checker.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.checker.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.schedule.arn
}

# 6. CloudWatch Metric Alarm for Availability Failure
resource "aws_cloudwatch_metric_alarm" "availability_alarm" {
  alarm_name          = "WebsiteDownAlarm"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = var.consecutive_failure_threshold
  metric_name         = "Availability"
  namespace           = "WebsiteMonitoring/Availability"
  period              = var.monitoring_frequency_minutes * 60
  statistic           = "Minimum"
  threshold           = 1
  alarm_description   = "Triggers alert when website availability drops to 0."
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "breaching"

  dimensions = {
    WebsiteUrl = var.target_url
  }
}
