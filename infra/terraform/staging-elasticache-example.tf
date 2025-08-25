// Example Terraform configuration for an AWS ElastiCache Redis replication group
// This is a small, opinionated example for staging. Adapt VPC/subnet/security group IDs to your environment.

variable "region" { default = "us-west-2" }
variable "cache_node_type" { default = "cache.t4g.micro" }
variable "replication_group_id" { default = "daylight-staging-redis" }
variable "num_cache_clusters" { default = 1 }

provider "aws" {
  region = var.region
}

resource "aws_elasticache_subnet_group" "daylight" {
  name       = "daylight-subnet-group"
  subnet_ids = ["<subnet-id-1>", "<subnet-id-2>"]
  description = "Subnet group for daylight staging ElastiCache"
}

resource "aws_elasticache_replication_group" "daylight" {
  replication_group_id          = var.replication_group_id
  replication_group_description = "Daylight staging Redis"
  node_type                     = var.cache_node_type
  number_cache_clusters         = var.num_cache_clusters
  automatic_failover_enabled    = false
  subnet_group_name             = aws_elasticache_subnet_group.daylight.name
  parameter_group_name          = "default.redis6.x"
  port                          = 6379
  engine_version                = "6.x"
}

output "redis_primary_endpoint_address" {
  value = aws_elasticache_replication_group.daylight.primary_endpoint_address
}
