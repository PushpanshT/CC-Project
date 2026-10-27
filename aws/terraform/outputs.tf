output "lambda_arn" {
  description = "ARN of the availability checker Lambda"
  value       = aws_lambda_function.checker.arn
}

output "sns_topic_arn" {
  description = "ARN of the SNS alerts topic"
  value       = aws_sns_topic.alerts.arn
}

output "dynamodb_table" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.health_logs.name
}

output "eventbridge_schedule" {
  description = "Scheduled check frequency"
  value       = aws_cloudwatch_event_rule.schedule.schedule_expression
}
