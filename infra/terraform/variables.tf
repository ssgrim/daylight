variable "region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "us-west-1"  # N. California
}

variable "mapbox_token" {
  description = "(optional) Mapbox API token for reverse geocoding"
  type        = string
  default     = ""
}

variable "geocode_provider" {
  description = "Geocode provider to use (nominatim|mapbox)"
  type        = string
  default     = "nominatim"
}

variable "weather_provider" {
  description = "Weather provider to use (open-meteo|openweathermap)"
  type        = string
  default     = "open-meteo"
}

variable "google_maps_key" {
  description = "(optional) Google Maps API key for Maps/Places usage. Set via secure CI secrets; do not commit keys here."
  type        = string
  default     = ""
}

variable "season_mode" {
  description = "Season mode for the service: 'meteorological' or 'astronomical'"
  type        = string
  default     = "meteorological"
}

variable "mapbox_secret_arn" {
  description = "(optional) ARN of a Secrets Manager secret containing the Mapbox token. If provided, Lambda will be granted permission to read it at runtime."
  type        = string
  default     = ""
}

variable "google_maps_secret_arn" {
  description = "(optional) ARN of a Secrets Manager secret containing the Google Maps API key. If provided, Lambda will be granted permission to read it at runtime."
  type        = string
  default     = ""
}

variable "events_secret_arn" {
  description = "(optional) ARN for events provider API key (e.g., Ticketmaster)."
  type = string
  default = ""
}

variable "traffic_secret_arn" {
  description = "(optional) ARN for traffic provider API key (e.g., HERE)."
  type = string
  default = ""
}

variable "mapbox_token_value" {
  description = "(optional) plaintext Mapbox token to create as a secret via Terraform (not recommended for production)."
  type = string
  default = ""
}

variable "events_api_key_value" {
  description = "(optional) plaintext events API key to create as a secret via Terraform (not recommended)."
  type = string
  default = ""
}

variable "traffic_api_key_value" {
  description = "(optional) plaintext traffic API key to create as a secret via Terraform (not recommended)."
  type = string
  default = ""
}

variable "events_ssm_parameter" {
  description = "(optional) SSM parameter name to read events API key from (SecureString). If set, code will read from SSM instead of Secrets Manager."
  type = string
  default = ""
}

variable "traffic_ssm_parameter" {
  description = "(optional) SSM parameter name to read traffic API key from (SecureString)."
  type = string
  default = ""
}

# Health monitoring and alerting configuration
variable "alert_email" {
  description = "(optional) Email address to receive health check alerts. If provided, SNS subscription will be created."
  type        = string
  default     = ""
  sensitive   = true
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 14
}

variable "app_version" {
  description = "Application version for health checks and monitoring"
  type        = string
  default     = "1.0.0"
}

variable "environment_name" {
  description = "Environment name (dev, staging, production) for tagging and monitoring"
  type        = string
  default     = "development"
}

# --- Monitoring Variables ---

variable "alert_email" {
  description = "Email address to receive CloudWatch alerts (optional)"
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 14
}

variable "app_version" {
  description = "Application version for monitoring and tagging"
  type        = string
  default     = "1.0.0"
}

variable "environment_name" {
  description = "Environment name (dev, staging, production)"
  type        = string
  default     = "development"
}
