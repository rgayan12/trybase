provider "aws" {
  region = "eu-west-2"

  default_tags {
    tags = {
      Service     = "trybase"
      Environment = "Dev"
      Project     = "n8n-hosting-saas-backend"
      ManagedBy   = "Terraform"
    }
  }
}

# S3 bucket for storing Terraform state
resource "aws_s3_bucket" "tfstate" {
  bucket = "n8n-hosting-saas-tfstate"
}

# Enforce in-transit SSL (HTTPS) requests only (corresponds to AWS Security Hub S3.5)
resource "aws_s3_bucket_policy" "tfstate_ssl" {
  bucket = aws_s3_bucket.tfstate.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceTLSRequestsOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.tfstate.arn,
          "${aws_s3_bucket.tfstate.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# Enable versioning on the S3 bucket
resource "aws_s3_bucket_versioning" "tfstate_versioning" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable server-side encryption on the S3 bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate_sse" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block all public access to the state file bucket
resource "aws_s3_bucket_public_access_block" "tfstate_public_access" {
  bucket = aws_s3_bucket.tfstate.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB table for Terraform state locking
resource "aws_dynamodb_table" "tflocks" {
  name         = "n8n-hosting-saas-tf-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}
