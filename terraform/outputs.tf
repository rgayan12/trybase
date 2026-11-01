# --- outputs.tf ---

output "bastion_public_ip" {
  description = "The public IP address of the bastion host (if enabled)."
  value       = try(aws_instance.bastion[0].public_ip, null)
}

output "db_hostname" {
  description = "The hostname of the RDS instance."
  value       = aws_db_instance.main.address
}

output "db_resource_id" {
  description = "The RDS Resource ID (DbiResourceId) for RDS IAM authentication."
  value       = aws_db_instance.main.resource_id
}

output "db_credentials_secret_arn" {
  description = "The ARN of the secret containing the master database credentials."
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "alb_dns_name" {
  description = "The DNS name of the Application Load Balancer."
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "The URL of the ECR repository for the create-schema Lambda."
  value       = aws_ecr_repository.create_schema_lambda.repository_url
}

output "api_gateway_invoke_url" {
  description = "The base URL for invoking the control plane provisioning API."
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "step_functions_state_machine_arn" {
  description = "The ARN of the Step Function provisioning state machine."
  value       = aws_sfn_state_machine.provision_tenant.arn
}

output "codebuild_project_name" {
  description = "The CodeBuild project used to run Terraform tenant deployments."
  value       = aws_codebuild_project.provision_tenant.name
}
