# --- /modules/tenant/main.tf ---

# ------------------------------------------------------------------------------
# Security Group
# ------------------------------------------------------------------------------

resource "aws_security_group" "n8n" {
  name        = "n8n-service-${var.tenant_id}"
  description = "Security group for the n8n tenant service"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow traffic from the ALB"
    protocol        = "tcp"
    from_port       = 5678
    to_port         = 5678
    security_groups = [var.alb_security_group_id]
  }

  ingress {
    description     = "Allow traffic from the VPC endpoints for ECS Exec"
    protocol        = "tcp"
    from_port       = 0
    to_port         = 65535
    security_groups = [var.vpc_endpoint_security_group_id]
  }

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ------------------------------------------------------------------------------
# ECS Task and Service
# ------------------------------------------------------------------------------

resource "aws_ecs_task_definition" "n8n" {
  family                   = "n8n-${var.tenant_id}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory

  execution_role_arn = aws_iam_role.ecs_execution_role.arn
  task_role_arn      = aws_iam_role.ecs_task_role.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name      = "n8n"
      image     = var.n8n_image
      cpu       = var.cpu
      memory    = var.memory
      essential = true
      portMappings = [{
        containerPort = 5678
        protocol      = "tcp"
      }]
      environment = [
        # --- Database ---
        { name = "DB_TYPE",              value = "postgresdb" },
        { name = "DB_POSTGRESDB_HOST",   value = var.db_host },
        { name = "DB_POSTGRESDB_PORT",   value = tostring(var.db_port) },
        { name = "DB_POSTGRESDB_DATABASE", value = "postgres" },
        { name = "DB_POSTGRESDB_SCHEMA", value = var.db_schema },
        { name = "DB_POSTGRESDB_SSL",    value = "true" },
        { name = "DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED", value = "false" }, # Allow AWS certificates that may not be in the internal Node.js trust store

        # --- n8n URL / Routing ---
        { name = "N8N_HOST",             value = "${var.subdomain}.${var.domain_name}" },
        { name = "N8N_PROTOCOL",         value = "https" },
        { name = "N8N_PORT",             value = "5678" },
        { name = "WEBHOOK_URL",          value = "https://${var.subdomain}.${var.domain_name}" },
        { name = "N8N_EDITOR_BASE_URL",  value = "https://${var.subdomain}.${var.domain_name}" },

        # --- Execution Limits (billing protection) ---
        { name = "EXECUTIONS_TIMEOUT",          value = "3600" },
        { name = "EXECUTIONS_TIMEOUT_MAX",       value = "7200" },
        { name = "EXECUTIONS_DATA_MAX_AGE",      value = "7" },
        { name = "EXECUTIONS_DATA_SAVE_ON_SUCCESS", value = "all" },
        { name = "EXECUTIONS_DATA_SAVE_ON_ERROR",   value = "all" },
        { name = "N8N_CONCURRENCY_PRODUCTION_LIMIT", value = "5" },

        # --- SMTP Email (via Resend) ---
        { name = "N8N_EMAIL_MODE",       value = "smtp" },
        { name = "N8N_SMTP_HOST",        value = "smtp.resend.com" },
        { name = "N8N_SMTP_PORT",        value = "465" },
        { name = "N8N_SMTP_SSL",         value = "true" },
        { name = "N8N_SMTP_USER",        value = "resend" },
        { name = "N8N_SMTP_SENDER",      value = "noreply@${var.domain_name}" },

        # --- Privacy & UX ---
        { name = "N8N_DIAGNOSTICS_ENABLED",              value = "false" },
        { name = "N8N_VERSION_NOTIFICATIONS_ENABLED",    value = "false" },
        { name = "N8N_PERSONALIZATION_ENABLED",          value = "false" },
        { name = "N8N_TEMPLATES_ENABLED",                value = "true" },
        { name = "NODES_EXCLUDE",                        value = "[\"n8n-nodes-base.executeCommand\",\"n8n-nodes-base.readWriteFile\"]" },

        # --- AI Assistant (swap URL for custom proxy when ready) ---
        { name = "N8N_AI_ASSISTANT_BASE_URL", value = "https://ai-assistant.n8n.io" },
      ]
      secrets = [
        {
          name      = "DB_POSTGRESDB_USER"
          valueFrom = "${var.db_credentials_secret_arn}:username::"
        },
        {
          name      = "DB_POSTGRESDB_PASSWORD"
          valueFrom = "${var.db_credentials_secret_arn}:password::"
        },
        {
          name      = "N8N_ENCRYPTION_KEY"
          valueFrom = var.n8n_encryption_key_secret_arn
        },
        {
          name      = "N8N_SMTP_PASS"
          valueFrom = var.smtp_api_key_secret_arn
        }
      ],
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/n8n-tenant-logs"
          "awslogs-region"        = "eu-west-2"
          "awslogs-stream-prefix" = var.tenant_id
          "awslogs-create-group"  = "true"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "n8n" {
  name                   = "n8n-${var.tenant_id}"
  cluster                = var.ecs_cluster_name
  task_definition        = aws_ecs_task_definition.n8n.arn
  desired_count          = 1 # This can be exposed as a variable for tiered plans
  launch_type            = "FARGATE"
  enable_execute_command = true
  wait_for_steady_state  = true # Fixes the 503 error: don't report success until the app is fully online
  propagate_tags         = "SERVICE"

  tags = {
    Service     = "trybase"
    Environment = "Prod"
    Tenant      = var.tenant_id
  }

  network_configuration {
    security_groups = [aws_security_group.n8n.id]
    subnets         = var.private_subnet_ids
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.n8n.arn
    container_name   = "n8n"
    container_port   = 5678
  }

  # Ensure the service doesn't try to start until the ALB listener rule is created
  depends_on = [aws_lb_listener_rule.n8n]
}

# ------------------------------------------------------------------------------
# Networking (ALB Target Group & Listener Rule)
# ------------------------------------------------------------------------------

resource "aws_lb_target_group" "n8n" {
  name        = "n8n-${var.tenant_id}"
  port        = 5678
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"
  deregistration_delay = 30

  health_check {
    path                = "/healthz"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_listener_rule" "n8n" {
  listener_arn = var.alb_listener_arn
  priority     = var.alb_listener_rule_priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.n8n.arn
  }

  condition {
    host_header {
      values = ["${var.subdomain}.${var.domain_name}"]
    }
  }
}

# ------------------------------------------------------------------------------
# IAM (Task Role & Execution Role)
# ------------------------------------------------------------------------------

# Standard role for ECS to be able to manage the container
resource "aws_iam_role" "ecs_execution_role" {
  name = "n8n-execution-role-${var.tenant_id}"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_logs" {
  name = "n8n-execution-logs-${var.tenant_id}"
  role = aws_iam_role.ecs_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = "*"
    }]
  })
}

# Role for the n8n container itself, granting it permissions.
resource "aws_iam_role" "ecs_task_role" {
  name = "n8n-task-role-${var.tenant_id}"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
}

# Policy to allow the task to read necessary secrets from Secrets Manager
resource "aws_iam_policy" "read_task_secrets" {
  name   = "n8n-read-secrets-policy-${var.tenant_id}"
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Action   = "secretsmanager:GetSecretValue"
      Effect   = "Allow"
      Resource = [
        var.db_credentials_secret_arn,
        var.n8n_encryption_key_secret_arn,
        var.smtp_api_key_secret_arn
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "read_secrets_attachment_task" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.read_task_secrets.arn
}

resource "aws_iam_role_policy_attachment" "read_secrets_attachment_execution" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = aws_iam_policy.read_task_secrets.arn
}

# Policy to allow the task to communicate with the SSM agent for ECS Exec
resource "aws_iam_policy" "ssm_exec_policy" {
  name   = "n8n-ssm-exec-policy-${var.tenant_id}"
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action = [
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel"
      ]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_exec_attachment" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ssm_exec_policy.arn
}

