# --- codebuild.tf ---
#
# Defines the AWS CodeBuild project that is invoked by the Step Function
# to run `terraform apply` for a new tenant.
#
# The build runs in the terraform/ directory, writes a new tenant .tf file,
# and applies it — all using the shared S3 backend for state.

# ------------------------------------------------------------------------------
# IAM Role for CodeBuild
# ------------------------------------------------------------------------------

resource "aws_iam_role" "codebuild_terraform" {
  name = "n8n-codebuild-terraform-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "codebuild.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Allow CodeBuild to write logs to CloudWatch
resource "aws_iam_role_policy" "codebuild_logs" {
  name = "n8n-codebuild-logs-policy"
  role = aws_iam_role.codebuild_terraform.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:TagResource",
        "logs:ListTagsForResource",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ]
      Resource = "*"
    }]
  })
}

# Allow CodeBuild to read/write the Terraform state S3 bucket
resource "aws_iam_role_policy" "codebuild_tfstate" {
  name = "n8n-codebuild-tfstate-policy"
  role = aws_iam_role.codebuild_terraform.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::n8n-hosting-saas-tfstate",
          "arn:aws:s3:::n8n-hosting-saas-tfstate/*"
        ]
      }
    ]
  })
}

# Allow CodeBuild to use the DynamoDB state lock table
resource "aws_iam_role_policy" "codebuild_tflock" {
  name = "n8n-codebuild-tflock-policy"
  role = aws_iam_role.codebuild_terraform.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem"
      ]
      Resource = "arn:aws:dynamodb:eu-west-2:*:table/n8n-hosting-saas-tf-locks"
    }]
  })
}

# Allow CodeBuild to create/manage all AWS resources that the tenant module needs.
# This is intentionally broad — it's acting as a Terraform operator.
resource "aws_iam_role_policy" "codebuild_terraform_permissions" {
  name = "n8n-codebuild-terraform-permissions"
  role = aws_iam_role.codebuild_terraform.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          # ECS
          "ecs:CreateService",
          "ecs:UpdateService",
          "ecs:DeleteService",
          "ecs:DescribeServices",
          "ecs:DescribeClusters",
          "ecs:RegisterTaskDefinition",
          "ecs:DeregisterTaskDefinition",
          "ecs:DescribeTaskDefinition",
          "ecs:ListTaskDefinitions",
          "ecs:TagResource",
          "ecs:UntagResource",
          # IAM
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:GetRole",
          "iam:GetRolePolicy",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:CreatePolicy",
          "iam:DeletePolicy",
          "iam:GetPolicy",
          "iam:GetPolicyVersion",
          "iam:ListPolicyVersions",
          "iam:ListAttachedRolePolicies",
          "iam:ListRolePolicies",
          "iam:PassRole",
          "iam:TagRole",
          "iam:TagPolicy",
          "iam:UntagRole",
          # EC2 / Networking
          "ec2:CreateSecurityGroup",
          "ec2:DeleteSecurityGroup",
          "ec2:DescribeSecurityGroups",
          "ec2:AuthorizeSecurityGroupIngress",
          "ec2:AuthorizeSecurityGroupEgress",
          "ec2:RevokeSecurityGroupIngress",
          "ec2:RevokeSecurityGroupEgress",
          "ec2:DescribeVpcs",
          "ec2:DescribeSubnets",
          "ec2:DescribeAvailabilityZones",
          "ec2:DescribeVpcAttribute",
          "ec2:CreateTags",
          "ec2:DescribeTags",
          # ALB
          "elasticloadbalancing:CreateTargetGroup",
          "elasticloadbalancing:DeleteTargetGroup",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:ModifyTargetGroup",
          "elasticloadbalancing:ModifyTargetGroupAttributes",
          "elasticloadbalancing:DescribeTargetGroupAttributes",
          "elasticloadbalancing:CreateRule",
          "elasticloadbalancing:DeleteRule",
          "elasticloadbalancing:DescribeRules",
          "elasticloadbalancing:ModifyRule",
          "elasticloadbalancing:AddTags",
          "elasticloadbalancing:DescribeTags",
          "elasticloadbalancing:DescribeLoadBalancers",
          "elasticloadbalancing:DescribeLoadBalancerAttributes",
          "elasticloadbalancing:DescribeListeners",
          "elasticloadbalancing:DescribeListenerAttributes",
          # RDS 
          "rds:DescribeDBInstances",
          "rds:DescribeDBSubnetGroups",
          "rds:ListTagsForResource",
          "rds:ModifyDBInstance",
          "rds:DescribeDBParameterGroups",
          "rds:DescribeDBParameters",
          "rds:CreateDBParameterGroup",
          "rds:ModifyDBParameterGroup",
          "rds:DeleteDBParameterGroup",
          "rds:AddTagsToResource",
          # Secrets Manager (full access — Terraform may create/delete secrets during state reconciliation)
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetResourcePolicy",
          "secretsmanager:CreateSecret",
          "secretsmanager:DeleteSecret",
          "secretsmanager:PutSecretValue",
          "secretsmanager:TagResource",
          "secretsmanager:UntagResource",
          "secretsmanager:RestoreSecret",
          # CloudWatch Logs (Log Groups, retention, tagging for ECS tasks)
          "logs:CreateLogGroup",
          "logs:DeleteLogGroup",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:PutRetentionPolicy",
          "logs:DeleteRetentionPolicy",
          "logs:TagResource",
          "logs:UntagResource",
          "logs:ListTagsForResource",
          "logs:ListTagsLogGroup",
          # S3 (Tenant Registry Persistence & Source Archive)
          "s3:ListBucket",
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow",
        Action = ["s3:ListBucket", "s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = [
          "arn:aws:s3:::${var.state_bucket_name}",
          "arn:aws:s3:::${var.state_bucket_name}/*"
        ]
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# Package and Upload Terraform Source to S3 for CodeBuild
# ------------------------------------------------------------------------------

data "archive_file" "codebuild_source" {
  type        = "zip"
  source_dir  = path.module
  output_path = "${path.module}/codebuild_source.zip"
  excludes = [
    ".terraform",
    ".terraform.lock.hcl",
    "*.zip",
    "*.tfstate",
    "*.tfstate.*",
    "terraform.tfvars"
  ]
}

resource "aws_s3_object" "codebuild_source" {
  bucket = var.state_bucket_name
  key    = "source/infra.zip"
  source = data.archive_file.codebuild_source.output_path
  etag   = data.archive_file.codebuild_source.output_md5
}

# ------------------------------------------------------------------------------
# CodeBuild Project
# ------------------------------------------------------------------------------

resource "aws_codebuild_project" "provision_tenant" {
  name          = "n8n-provision-tenant"
  description   = "Runs terraform apply to provision a new n8n tenant"
  service_role  = aws_iam_role.codebuild_terraform.arn
  build_timeout = 20 # minutes

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"
    type                        = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"

    # These are overridden at runtime by the Step Function
    environment_variable {
      name  = "TENANT_ID"
      value = "PLACEHOLDER"
    }

    environment_variable {
      name  = "ALB_LISTENER_RULE_PRIORITY"
      value = "PLACEHOLDER"
    }

    environment_variable {
      name  = "WORKLOAD_TYPE"
      value = "n8n"
    }
  }

  source {
    type      = "S3"
    location  = "${var.state_bucket_name}/source/infra.zip"
    buildspec = <<-BUILDSPEC
      version: 0.2
      phases:
        install:
          commands:
            - echo "Installing Terraform 1.8.0..."
            - sudo yum install -y yum-utils
            - sudo yum-config-manager --add-repo https://rpm.releases.hashicorp.com/AmazonLinux/hashicorp.repo
            - sudo yum -y install terraform-1.8.0
            - terraform version
        pre_build:
          commands:
            - echo "Provisioning tenant $TENANT_ID with workload type $WORKLOAD_TYPE"
            # Pull existing tenants from S3 to ensure Terraform knows about the full fleet
            - aws s3 sync s3://${var.state_bucket_name}/tenants/ . || echo "No existing tenants found."
            # Write a new tenant module file dynamically based on WORKLOAD_TYPE
            - |
              DB_SCHEMA=$(echo "$TENANT_ID" | tr "-" "_")
              WORKLOAD=$(echo "$WORKLOAD_TYPE" | tr '[:upper:]' '[:lower:]')
              echo "Generating Terraform config for workload: $WORKLOAD"

              if [ "$WORKLOAD" = "hello" ]; then
                printf 'module "%s" {\n  source = "./modules/generic-workload"\n\n  service_name    = "%s"\n  subdomain       = "%s"\n  container_image = "nginxdemos/hello:plain-text"\n  container_port  = 80\n  health_check_path = "/"\n  cpu             = 256\n  memory          = 512\n\n  environment_variables = {\n    WELCOME_MESSAGE = "Hello from TryBase Generic Container!"\n    ENVIRONMENT     = "production"\n  }\n\n  vpc_id                     = module.vpc.vpc_id\n  private_subnet_ids         = module.vpc.private_subnets\n  ecs_cluster_name           = aws_ecs_cluster.main.name\n  alb_listener_arn           = aws_lb_listener.https.arn\n  alb_security_group_id      = aws_security_group.alb.id\n  alb_listener_rule_priority = %s\n  domain_name                = var.base_domain\n}\n' \
                  "$TENANT_ID" "$TENANT_ID" "$TENANT_ID" "$ALB_LISTENER_RULE_PRIORITY" \
                  > "tenant_$TENANT_ID.tf"

              elif [ "$WORKLOAD" = "agent" ] || [ "$WORKLOAD" = "bedrock" ] || [ "$WORKLOAD" = "generic" ]; then
                printf 'module "%s" {\n  source = "./modules/generic-workload"\n\n  service_name    = "%s"\n  subdomain       = "%s"\n  container_image = "nginxdemos/hello:plain-text"\n  container_port  = 80\n  health_check_path = "/"\n  cpu             = 256\n  memory          = 512\n  enable_bedrock  = true\n\n  environment_variables = {\n    AWS_DEFAULT_REGION = "eu-west-2"\n    ENVIRONMENT        = "production"\n  }\n\n  vpc_id                     = module.vpc.vpc_id\n  private_subnet_ids         = module.vpc.private_subnets\n  ecs_cluster_name           = aws_ecs_cluster.main.name\n  alb_listener_arn           = aws_lb_listener.https.arn\n  alb_security_group_id      = aws_security_group.alb.id\n  alb_listener_rule_priority = %s\n  domain_name                = var.base_domain\n}\n' \
                  "$TENANT_ID" "$TENANT_ID" "$TENANT_ID" "$ALB_LISTENER_RULE_PRIORITY" \
                  > "tenant_$TENANT_ID.tf"

              elif [ "$WORKLOAD" = "dify" ]; then
                printf 'module "%s" {\n  source = "./modules/generic-workload"\n\n  service_name      = "%s"\n  subdomain         = "%s"\n  container_image   = "langgenius/dify-api:latest"\n  container_port    = 5001\n  health_check_path = "/health"\n  cpu               = 1024\n  memory            = 2048\n  enable_redis      = true\n\n  environment_variables = {\n    MODE              = "api"\n    MIGRATION_ENABLED = "true"\n    LOG_LEVEL         = "INFO"\n    SECRET_KEY        = "trybase-dify-secret-key-change-in-production"\n    DB_USERNAME       = "usr_%s"\n    DB_PASSWORD       = "TryBaseDifySecurePass2026!"\n    DB_HOST           = aws_db_instance.main.address\n    DB_PORT           = "5432"\n    DB_DATABASE       = "db_%s"\n    VECTOR_STORE      = "pgvector"\n    PGVECTOR_HOST     = aws_db_instance.main.address\n    PGVECTOR_PORT     = "5432"\n    PGVECTOR_USER     = "usr_%s"\n    PGVECTOR_PASSWORD = "TryBaseDifySecurePass2026!"\n    PGVECTOR_DATABASE = "db_%s"\n    REDIS_HOST        = "127.0.0.1"\n    REDIS_PORT        = "6379"\n    REDIS_DB          = "0"\n    CELERY_BROKER_URL = "redis://127.0.0.1:6379/1"\n  }\n\n  vpc_id                     = module.vpc.vpc_id\n  private_subnet_ids         = module.vpc.private_subnets\n  ecs_cluster_name           = aws_ecs_cluster.main.name\n  alb_listener_arn           = aws_lb_listener.https.arn\n  alb_security_group_id      = aws_security_group.alb.id\n  alb_listener_rule_priority = %s\n  domain_name                = var.base_domain\n}\n' \
                  "$TENANT_ID" "$TENANT_ID" "$TENANT_ID" "$DB_SCHEMA" "$DB_SCHEMA" "$DB_SCHEMA" "$DB_SCHEMA" "$ALB_LISTENER_RULE_PRIORITY" \
                  > "tenant_$TENANT_ID.tf"

              else
                # Default: n8n automation workflow
                printf 'resource "random_password" "key_%s" {\n  length = 32\n  special = false\n}\n\nresource "aws_secretsmanager_secret" "key_%s" {\n  name = "n8n-hosting/tenant/%s/encryption-key"\n  recovery_window_in_days = 0\n}\n\nresource "aws_secretsmanager_secret_version" "key_%s" {\n  secret_id = aws_secretsmanager_secret.key_%s.id\n  secret_string = random_password.key_%s.result\n}\n\nmodule "%s" {\n  source = "./modules/tenant"\n\n  tenant_id = "%s"\n  subdomain = "%s"\n  db_schema = "%s"\n  domain_name = var.base_domain\n\n  vpc_id                         = module.vpc.vpc_id\n  private_subnet_ids             = module.vpc.private_subnets\n  ecs_cluster_name               = aws_ecs_cluster.main.name\n  alb_listener_arn               = aws_lb_listener.https.arn\n  alb_security_group_id          = aws_security_group.alb.id\n  db_host                        = aws_db_instance.main.address\n  db_port                        = aws_db_instance.main.port\n  db_credentials_secret_arn      = aws_secretsmanager_secret.db_credentials.arn\n  vpc_endpoint_security_group_id = aws_security_group.vpc_endpoints.id\n  alb_listener_rule_priority     = %s\n\n  n8n_encryption_key_secret_arn = aws_secretsmanager_secret_version.key_%s.arn\n  smtp_api_key_secret_arn       = aws_secretsmanager_secret.smtp_api_key.arn\n}\n' \
                  "$TENANT_ID" "$TENANT_ID" "$TENANT_ID" "$TENANT_ID" "$TENANT_ID" "$TENANT_ID" \
                  "$TENANT_ID" "$TENANT_ID" "$TENANT_ID" "$DB_SCHEMA" "$ALB_LISTENER_RULE_PRIORITY" \
                  "$TENANT_ID" \
                  > "tenant_$TENANT_ID.tf"
              fi
            - cat "tenant_$TENANT_ID.tf"
            - terraform init -reconfigure
        build:
          commands:
            - terraform apply -auto-approve -target="module.$TENANT_ID"
        post_build:
          commands:
            # Persist the newly created tenant config back to S3
            - aws s3 cp "tenant_$TENANT_ID.tf" "s3://${var.state_bucket_name}/tenants/tenant_$TENANT_ID.tf"
      BUILDSPEC
  }

  depends_on = [aws_s3_object.codebuild_source]


  logs_config {
    cloudwatch_logs {
      group_name  = "/aws/codebuild/n8n-provision-tenant"
      stream_name = "build"
    }
  }
}
