# ECR repository to store the container image for our create-schema Lambda
resource "aws_ecr_repository" "create_schema_lambda" {
  name                 = "n8n-hosting/create-schema-lambda"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "create_schema_lambda" {
  repository = aws_ecr_repository.create_schema_lambda.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images older than 14 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 14
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep last 10 tagged images"
        selection = {
          tagStatus     = "any"
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Automatically build and push the create-schema Lambda container image
resource "null_resource" "build_create_schema_lambda" {
  triggers = {
    dockerfile_sha   = fileexists("${path.module}/../lambda/create-schema/Dockerfile") ? filesha256("${path.module}/../lambda/create-schema/Dockerfile") : "remote"
    handler_sha      = fileexists("${path.module}/../lambda/create-schema/main.py") ? filesha256("${path.module}/../lambda/create-schema/main.py") : "remote"
    requirements_sha = fileexists("${path.module}/../lambda/create-schema/requirements.txt") ? filesha256("${path.module}/../lambda/create-schema/requirements.txt") : "remote"
  }

  provisioner "local-exec" {
    command = <<EOF
      REGISTRY_URL=$(echo "${aws_ecr_repository.create_schema_lambda.repository_url}" | cut -d'/' -f1)
      aws ecr get-login-password --region ${data.aws_region.current.name} | docker login --username AWS --password-stdin $REGISTRY_URL
      docker build --platform linux/arm64 -t ${aws_ecr_repository.create_schema_lambda.repository_url}:latest ${path.module}/../lambda/create-schema
      docker push ${aws_ecr_repository.create_schema_lambda.repository_url}:latest
EOF
  }

  depends_on = [aws_ecr_repository.create_schema_lambda]
}

# ECR repository to mirror the n8n base image (bye-bye Docker Hub rate limits!)
resource "aws_ecr_repository" "n8n_base" {
  name                 = "n8n-hosting/n8n-base"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "n8n_base" {
  repository = aws_ecr_repository.n8n_base.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images older than 14 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 14
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep last 5 images"
        selection = {
          tagStatus     = "any"
          countType     = "imageCountMoreThan"
          countNumber   = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}


# Automatically Mirror the n8n image during Terraform Apply
resource "null_resource" "mirror_n8n" {
  triggers = {
    # This will re-run if we change the desired n8n version
    image_version = "latest"
  }

  provisioner "local-exec" {
    command = <<EOF
      REGISTRY_URL=$(echo "${aws_ecr_repository.n8n_base.repository_url}" | cut -d'/' -f1)
      aws ecr get-login-password --region ${data.aws_region.current.name} | docker login --username AWS --password-stdin $REGISTRY_URL
      docker pull --platform linux/arm64 n8nio/n8n:latest
      docker tag n8nio/n8n:latest ${aws_ecr_repository.n8n_base.repository_url}:latest
      docker push ${aws_ecr_repository.n8n_base.repository_url}:latest
EOF
  }

  depends_on = [aws_ecr_repository.n8n_base]
}
