# --- lambda.tf ---

# This file defines the Lambda function responsible for creating database schemas.

# IAM Role for the Lambda function
resource "aws_iam_role" "create_schema_lambda" {
  name = "n8n-create-schema-lambda-role"
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

# Grant the Lambda basic execution and VPC access permissions
resource "aws_iam_role_policy_attachment" "lambda_vpc_access" {
  role       = aws_iam_role.create_schema_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Grant the Lambda permission to read our specific database secret
resource "aws_iam_policy" "lambda_read_db_secret" {
  name = "n8n-lambda-read-db-secret-policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action   = "secretsmanager:GetSecretValue"
      Effect   = "Allow"
      Resource = aws_secretsmanager_secret.db_credentials.arn
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_read_db_secret" {
  role       = aws_iam_role.create_schema_lambda.name
  policy_arn = aws_iam_policy.lambda_read_db_secret.arn
}

# Security group for the Lambda function
resource "aws_security_group" "create_schema_lambda" {
  name   = "n8n-create-schema-lambda-sg"
  vpc_id = module.vpc.vpc_id

  # The Lambda only makes outbound connections to the RDS instance,
  # so no ingress rules are needed.
  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# The Lambda function resource, now configured for a container image
resource "aws_lambda_function" "create_schema" {
  function_name = "n8n-tenant-create-schema"
  role          = aws_iam_role.create_schema_lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.create_schema_lambda.repository_url}:latest"
  architectures = ["arm64"]

  timeout = 30 # seconds

  environment {
    variables = {
      DB_HOST                   = aws_db_instance.main.address
      DB_PORT                   = aws_db_instance.main.port
      DB_CREDENTIALS_SECRET_ARN = aws_secretsmanager_secret.db_credentials.arn
    }
  }

  # Configure the Lambda to run inside our VPC
  vpc_config {
    subnet_ids         = module.vpc.private_subnets
    security_group_ids = [aws_security_group.create_schema_lambda.id]
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_vpc_access,
    aws_iam_role_policy_attachment.lambda_read_db_secret,
    null_resource.build_create_schema_lambda
  ]
}

# ------------------------------------------------------------------------------
# Notification Lambda (Success Callback)
# ------------------------------------------------------------------------------

resource "aws_iam_role" "notify_success_lambda" {
  name = "n8n-notify-success-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "notify_success_logs" {
  role       = aws_iam_role.notify_success_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Store the Supabase service role key in Secrets Manager
# Value is managed manually via AWS CLI — NOT by Terraform
# Run once: aws secretsmanager put-secret-value \
#   --secret-id "n8n-hosting/supabase-service-role-key" \
#   --secret-string "your-service-role-key" \
#   --region eu-west-2
resource "aws_secretsmanager_secret" "supabase_service_role_key" {
  name                    = "n8n-hosting/supabase-service-role-key"
  description             = "Supabase service role key for the notify_success Lambda"
  recovery_window_in_days = 0
}

# Grant the Lambda permission to read the Supabase key secret
resource "aws_iam_policy" "notify_success_read_secret" {
  name = "n8n-notify-success-read-secret"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = aws_secretsmanager_secret.supabase_service_role_key.arn
    }]
  })
}

resource "aws_iam_role_policy_attachment" "notify_success_read_secret" {
  role       = aws_iam_role.notify_success_lambda.name
  policy_arn = aws_iam_policy.notify_success_read_secret.arn
}

data "archive_file" "notify_success_zip" {
  type        = "zip"
  output_path = "${path.module}/notify_success.zip"
  source {
    content  = <<-EOF
      import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

      const sm = new SecretsManagerClient({ region: process.env.AWS_REGION });

      export const handler = async (event) => {
        console.log("Notifying Supabase of success for tenant:", event.tenant_id);

        try {
          // Fetch the Supabase service role key at runtime from Secrets Manager
          const { SecretString } = await sm.send(
            new GetSecretValueCommand({ SecretId: process.env.SUPABASE_SERVICE_ROLE_KEY_ARN })
          );

          const res = await fetch(`${var.supabase_url}/functions/v1/on-provision-success`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer $${SecretString}`
            },
            body: JSON.stringify({ tenant_id: event.tenant_id, workload_type: event.workload_type })
          });

          if (!res.ok) {
            const errText = await res.text();
            console.warn("Supabase callback returned non-OK (" + res.status + "): " + errText);
            return { success: false, warning: errText };
          }
          return { success: true };
        } catch (err) {
          console.warn("Non-fatal notify_success warning:", err.message);
          return { success: false, warning: err.message };
        }
      };
    EOF
    filename = "index.mjs"
  }
}

resource "aws_lambda_function" "notify_success" {
  function_name    = "n8n-notify-provision-success"
  role             = aws_iam_role.notify_success_lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  filename         = data.archive_file.notify_success_zip.output_path
  source_code_hash = data.archive_file.notify_success_zip.output_base64sha256
  timeout          = 10

  environment {
    variables = {
      SUPABASE_SERVICE_ROLE_KEY_ARN = aws_secretsmanager_secret.supabase_service_role_key.arn
    }
  }
}
