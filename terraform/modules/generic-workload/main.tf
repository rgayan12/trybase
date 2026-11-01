# --- /modules/generic-workload/main.tf ---
# Reusable generic container workload module for TryBase

# ------------------------------------------------------------------------------
# CloudWatch Logs
# ------------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "service" {
  name              = "/aws/ecs/${var.service_name}"
  retention_in_days = 7
}

# ------------------------------------------------------------------------------
# Security Group
# ------------------------------------------------------------------------------

resource "aws_security_group" "service" {
  name        = "trybase-workload-${var.service_name}"
  description = "Security group for ${var.service_name} workload"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow traffic from ALB"
    protocol        = "tcp"
    from_port       = var.container_port
    to_port         = var.container_port
    security_groups = [var.alb_security_group_id]
  }

  egress {
    description = "Allow all outbound traffic"
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ------------------------------------------------------------------------------
# IAM Roles (Task Execution & Task Role)
# ------------------------------------------------------------------------------

resource "aws_iam_role" "execution_role" {
  name = "trybase-${var.service_name}-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "execution_role_policy" {
  role       = aws_iam_role.execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task_role" {
  name = "trybase-${var.service_name}-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_policy" "bedrock_access" {
  count       = var.enable_bedrock ? 1 : 0
  name        = "trybase-${var.service_name}-bedrock"
  description = "Allows tenant workload '${var.service_name}' to invoke Amazon Bedrock foundation models keylessly"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid    = "BedrockModelInvocation"
          Effect = "Allow"
          Action = [
            "bedrock:InvokeModel",
            "bedrock:InvokeModelWithResponseStream"
          ]
          Resource = var.bedrock_model_arns
        }
      ],
      var.bedrock_guardrail_arn != "" ? [
        {
          Sid      = "BedrockGuardrailEnforcement"
          Effect   = "Allow"
          Action   = ["bedrock:ApplyGuardrail"]
          Resource = [var.bedrock_guardrail_arn]
        }
      ] : []
    )
  })
}

resource "aws_iam_role_policy_attachment" "bedrock_access" {
  count      = var.enable_bedrock ? 1 : 0
  role       = aws_iam_role.task_role.name
  policy_arn = aws_iam_policy.bedrock_access[0].arn
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_iam_policy" "rds_iam_access" {
  count       = var.enable_rds_iam ? 1 : 0
  name        = "trybase-${var.service_name}-rds-iam"
  description = "Allows tenant workload '${var.service_name}' to connect to RDS via IAM database authentication"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "RdsDbConnect"
        Effect = "Allow"
        Action = ["rds-db:connect"]
        Resource = [
          "arn:aws:rds-db:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:dbuser:${var.rds_resource_id}/${var.rds_db_user}"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_iam_access" {
  count      = var.enable_rds_iam ? 1 : 0
  role       = aws_iam_role.task_role.name
  policy_arn = aws_iam_policy.rds_iam_access[0].arn
}


# ------------------------------------------------------------------------------
# ECS Task Definition & Service
# ------------------------------------------------------------------------------

resource "aws_ecs_task_definition" "service" {
  family                   = "trybase-${var.service_name}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory

  execution_role_arn = aws_iam_role.execution_role.arn
  task_role_arn      = aws_iam_role.task_role.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.cpu_architecture
  }

  container_definitions = jsonencode(concat(
    [
      {
        name      = var.service_name
        image     = var.container_image
        cpu       = var.enable_redis ? (var.cpu - 128) : var.cpu
        memory    = var.enable_redis ? (var.memory - 256) : var.memory
        essential = true

        portMappings = [
          {
            containerPort = var.container_port
            hostPort      = var.container_port
            protocol      = "tcp"
          }
        ]

        environment = [
          for k, v in var.environment_variables : {
            name  = k
            value = v
          }
        ]

        logConfiguration = {
          logDriver = "awslogs"
          options = {
            "awslogs-group"         = aws_cloudwatch_log_group.service.name
            "awslogs-region"        = "eu-west-2"
            "awslogs-stream-prefix" = "workload"
          }
        }
      }
    ],
    var.enable_redis ? [
      {
        name      = "${var.service_name}-redis"
        image     = "public.ecr.aws/docker/library/redis:alpine"
        cpu       = 128
        memory    = 256
        essential = false

        portMappings = [
          {
            containerPort = 6379
            hostPort      = 6379
            protocol      = "tcp"
          }
        ]

        logConfiguration = {
          logDriver = "awslogs"
          options = {
            "awslogs-group"         = aws_cloudwatch_log_group.service.name
            "awslogs-region"        = "eu-west-2"
            "awslogs-stream-prefix" = "redis"
          }
        }
      }
    ] : []
  ))
}

resource "aws_ecs_service" "service" {
  name                   = var.service_name
  cluster                = var.ecs_cluster_name
  task_definition        = aws_ecs_task_definition.service.arn
  desired_count          = 1
  launch_type            = "FARGATE"
  enable_execute_command = true
  propagate_tags         = "SERVICE"

  tags = {
    Service     = "trybase"
    Environment = "Prod"
    Tenant      = var.tenant_id
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.service.arn
    container_name   = var.service_name
    container_port   = var.container_port
  }

  depends_on = [aws_lb_listener_rule.service]
}

# ------------------------------------------------------------------------------
# Networking (ALB Target Group & Listener Rule)
# ------------------------------------------------------------------------------

resource "aws_lb_target_group" "service" {
  name                 = "tg-${substr(var.service_name, 0, 28)}"
  port                 = var.container_port
  protocol             = "HTTP"
  vpc_id               = var.vpc_id
  target_type          = "ip"
  deregistration_delay = 15

  health_check {
    path                = var.health_check_path
    protocol            = "HTTP"
    matcher             = "200-499"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_listener_rule" "service" {
  listener_arn = var.alb_listener_arn
  priority     = var.alb_listener_rule_priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.service.arn
  }

  condition {
    host_header {
      values = ["${var.subdomain}.${var.domain_name}"]
    }
  }
}
