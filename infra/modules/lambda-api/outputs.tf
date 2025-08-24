# Lambda + API Gateway Module Outputs

output "api_id" {
  description = "ID of the API Gateway"
  value       = aws_apigatewayv2_api.api.id
}

output "api_endpoint" {
  description = "Endpoint URL of the API Gateway"
  value       = aws_apigatewayv2_api.api.api_endpoint
}

output "api_execution_arn" {
  description = "Execution ARN of the API Gateway"
  value       = aws_apigatewayv2_api.api.execution_arn
}

output "lambda_function_names" {
  description = "Names of the created Lambda functions"
  value       = { for k, v in aws_lambda_function.functions : k => v.function_name }
}

output "lambda_function_arns" {
  description = "ARNs of the created Lambda functions"
  value       = { for k, v in aws_lambda_function.functions : k => v.arn }
}

output "lambda_function_invoke_arns" {
  description = "Invoke ARNs of the created Lambda functions"
  value       = { for k, v in aws_lambda_function.functions : k => v.invoke_arn }
}

output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_execution_role.arn
}

output "lambda_execution_role_name" {
  description = "Name of the Lambda execution role"
  value       = aws_iam_role.lambda_execution_role.name
}

output "api_stage_name" {
  description = "Name of the API Gateway stage"
  value       = aws_apigatewayv2_stage.api_stage.name
}

output "cloudwatch_log_groups" {
  description = "CloudWatch log groups for Lambda functions"
  value = {
    api      = aws_cloudwatch_log_group.api_logs.name
    lambdas  = { for k, v in aws_cloudwatch_log_group.lambda_logs : k => v.name }
  }
}

# WAF outputs
output "waf_web_acl_id" {
  description = "ID of the WAF Web ACL (if enabled)"
  value       = var.enable_waf ? aws_wafv2_web_acl.api_protection[0].id : null
}

output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL (if enabled)"
  value       = var.enable_waf ? aws_wafv2_web_acl.api_protection[0].arn : null
}
