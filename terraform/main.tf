terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.2"
    }
  }

  backend "s3" {
    bucket         = "n8n-hosting-saas-tfstate" # This bucket must exist
    key            = "shared/terraform.tfstate"
    region         = "eu-west-2"
    dynamodb_table = "n8n-hosting-saas-tf-locks" # This table must exist
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Service     = "trybase"
      Environment = title(var.environment) # Ensures "Prod", "Dev", or "Stage"
      Project     = var.project_name
      ManagedBy   = "Terraform"
    }
  }
}

# Account and Region helpers
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ------------------------------------------------------------------------------
# SHARED INFRASTRUCTURE
# All resources that are shared across all tenants will be defined here.
# (VPC, ECS Cluster, ALB, RDS, etc.)
# ------------------------------------------------------------------------------
