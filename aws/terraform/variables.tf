variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS deployment region"
}

variable "target_url" {
  type        = string
  default     = "https://www.google.com"
  description = "Target website URL to monitor"
}

variable "alert_email" {
  type        = string
  default     = "student.cloudlab@example.com"
  description = "Email address for Amazon SNS alerts"
}

variable "monitoring_frequency_minutes" {
  type        = number
  default     = 5
  description = "Monitoring check frequency in minutes (e.g. 1, 5, 15)"
}

variable "request_timeout" {
  type        = number
  default     = 5
  description = "HTTP timeout in seconds"
}

variable "consecutive_failure_threshold" {
  type        = number
  default     = 2
  description = "Consecutive failures before alerting"
}
