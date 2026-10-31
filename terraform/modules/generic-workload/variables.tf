# --- /modules/generic-workload/variables.tf ---

variable "service_name" {
  description = "A unique identifier for the service / tenant workload (e.g. 'hello-world')."
  type        = string
}

variable "subdomain" {
  description = "The subdomain to route traffic to this service (e.g. 'hello' -> hello.yourdomain.com)."
  type        = string
}

variable "domain_name" {
  description = "Base domain for the service (e.g. trybase.io or yourdomain.com)."
  type        = string
  default     = "trybase.io"
}

variable "container_image" {
  description = "Docker image to run (e.g. 'nginxdemos/hello:plain-text' or 'traefik/whoami')."
  type        = string
  default     = "nginxdemos/hello:plain-text"
}

variable "container_port" {
  description = "Internal port the container listens on (e.g. 80, 3000, 8080)."
  type        = number
  default     = 80
}

variable "health_check_path" {
  description = "HTTP path used by the Application Load Balancer for health checks."
  type        = string
  default     = "/"
}

variable "cpu" {
  description = "CPU units allocated to the container (256 = 0.25 vCPU, 512 = 0.5 vCPU)."
  type        = number
  default     = 256
}

variable "memory" {
  description = "Memory in MiB allocated to the container (512, 1024, etc.)."
  type        = number
  default     = 512
}

variable "cpu_architecture" {
  description = "Target CPU architecture: 'ARM64' (cheaper Graviton) or 'X86_64'."
  type        = string
  default     = "ARM64"
}

variable "environment_variables" {
  description = "Key-value environment variables passed to the container."
  type        = map(string)
  default     = {}
}

# --- Shared Infrastructure Bindings ---

variable "vpc_id" {
  description = "The ID of the shared VPC."
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs where the container will run."
  type        = list(string)
}

variable "ecs_cluster_name" {
  description = "Name of the shared ECS cluster."
  type        = string
}

variable "alb_listener_arn" {
  description = "ARN of the shared ALB HTTPS listener."
  type        = string
}

variable "alb_security_group_id" {
  description = "Security group ID of the ALB to allow ingress."
  type        = string
}

variable "alb_listener_rule_priority" {
  description = "Unique priority for the ALB listener rule (1-50000)."
  type        = number
}

# --- AI & Bedrock Gateway Bindings ---

variable "enable_bedrock" {
  description = "Attach an IAM policy allowing the container to invoke Amazon Bedrock foundation models keylessly."
  type        = bool
  default     = true
}

variable "bedrock_model_arns" {
  description = "List of Bedrock foundation model ARNs the container is permitted to invoke. Defaults to all models."
  type        = list(string)
  default     = ["*"]
}

variable "bedrock_guardrail_arn" {
  description = "Optional ARN or identifier for an Amazon Bedrock Guardrail to enforce content filtering and PII masking."
  type        = string
  default     = ""
}

# --- Caching & Sidecars ---

variable "enable_redis" {
  description = "Inject an in-task redis:alpine sidecar container sharing localhost:6379 for Celery and streaming cache."
  type        = bool
  default     = false
}

