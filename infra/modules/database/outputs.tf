# Database Module Outputs

output "trips_table_id" {
  description = "ID of the trips table"
  value       = aws_dynamodb_table.trips.id
}

output "trips_table_name" {
  description = "Name of the trips table"
  value       = aws_dynamodb_table.trips.name
}

output "trips_table_arn" {
  description = "ARN of the trips table"
  value       = aws_dynamodb_table.trips.arn
}

output "trips_table_stream_arn" {
  description = "Stream ARN of the trips table"
  value       = aws_dynamodb_table.trips.stream_arn
}

output "trips_table_stream_label" {
  description = "Stream label of the trips table"
  value       = aws_dynamodb_table.trips.stream_label
}

output "cache_table_id" {
  description = "ID of the cache table"
  value       = var.enable_cache_table ? aws_dynamodb_table.cache[0].id : null
}

output "cache_table_name" {
  description = "Name of the cache table"
  value       = var.enable_cache_table ? aws_dynamodb_table.cache[0].name : null
}

output "cache_table_arn" {
  description = "ARN of the cache table"
  value       = var.enable_cache_table ? aws_dynamodb_table.cache[0].arn : null
}

output "table_names" {
  description = "Map of all table names"
  value = {
    trips = aws_dynamodb_table.trips.name
    cache = var.enable_cache_table ? aws_dynamodb_table.cache[0].name : null
  }
}

output "table_arns" {
  description = "Map of all table ARNs"
  value = {
    trips = aws_dynamodb_table.trips.arn
    cache = var.enable_cache_table ? aws_dynamodb_table.cache[0].arn : null
  }
}
