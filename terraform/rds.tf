# --- rds.tf ---

# Generate a random password for the RDS database master user.
resource "random_password" "db_master_password" {
  length           = 16
  special          = true
  override_special = "!#$%^&*()_+-="
}

# Store the generated password securely in AWS Secrets Manager.
resource "aws_secretsmanager_secret" "db_credentials" {
  name_prefix             = "n8n-hosting/rds-master-credentials-"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = "n8nmaster"
    password = random_password.db_master_password.result
  })
}

# A security group for the RDS instance to control access.
resource "aws_security_group" "rds" {
  name        = "n8n-hosting-rds-sg"
  description = "Allow inbound traffic to RDS from within the VPC"
  vpc_id      = module.vpc.vpc_id

  # Allow inbound Postgres traffic from any resource inside the VPC
  ingress {
    protocol    = "tcp"
    from_port   = 5432
    to_port     = 5432
    cidr_blocks = [module.vpc.vpc_cidr_block]
  }

  # Allow inbound Postgres traffic from the create_schema Lambda
  ingress {
    protocol        = "tcp"
    from_port       = 5432
    to_port         = 5432
    security_groups = [aws_security_group.create_schema_lambda.id]
  }
}

# Allow inbound Postgres traffic from the bastion host if enabled
resource "aws_security_group_rule" "rds_bastion_ingress" {
  count                    = var.enable_bastion ? 1 : 0
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.bastion[0].id
  security_group_id        = aws_security_group.rds.id
}

# A subnet group for RDS, which tells it which subnets it can be placed in.
# We must use our private subnets.
resource "aws_db_subnet_group" "default" {
  name       = "n8n-hosting-rds-subnet-group"
  subnet_ids = module.vpc.private_subnets
}

# Custom Parameter Group to disable forced SSL for internal private VPC connections
resource "aws_db_parameter_group" "main" {
  name   = "n8n-hosting-pg16-params"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "0"
  }
}

# The RDS Postgres database instance.
resource "aws_db_instance" "main" {
  identifier                          = "n8n-hosting-shared-db"
  engine                              = "postgres"
  engine_version                      = "16.11"
  instance_class                      = "db.t4g.micro" # Upgraded to ARM64 (Graviton 2) for better price/performance
  allocated_storage                   = 20
  storage_type                        = "gp3"                     # 20% lower cost per GB than gp2 with independent IOPS
  storage_encrypted                   = true                      # Encryption at-rest (corresponds to AWS Security Hub RDS.3)
  copy_tags_to_snapshot               = true                      # Retain resource tags on DB snapshots (RDS.16, RDS.17)
  enabled_cloudwatch_logs_exports     = ["postgresql", "upgrade"] # Export logs for monitoring/auditing (RDS.9)
  username                            = jsondecode(aws_secretsmanager_secret_version.db_credentials.secret_string)["username"]
  password                            = jsondecode(aws_secretsmanager_secret_version.db_credentials.secret_string)["password"]
  db_subnet_group_name                = aws_db_subnet_group.default.name
  vpc_security_group_ids              = [aws_security_group.rds.id]
  parameter_group_name                = aws_db_parameter_group.main.name
  publicly_accessible                 = false # Important for security
  iam_database_authentication_enabled = true  # Enable AWS IAM Database Authentication (Passwordless Auth)
  apply_immediately                   = true  # Force architectural changes to happen now, not during the next maintenance window
  backup_retention_period             = 7
  skip_final_snapshot                 = var.rds_skip_final_snapshot
  final_snapshot_identifier           = var.rds_skip_final_snapshot ? null : "n8n-hosting-final-${formatdate("YYYYMMDDhhmmss", timestamp())}"
}

