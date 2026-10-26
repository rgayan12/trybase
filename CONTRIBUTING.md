# Contributing to TryBase

Thank you for your interest in contributing to **TryBase**! We welcome community contributions, bug reports, and feature proposals.

---

## 🛠️ Development Workflow

### 1. Prerequisites
- **Terraform** >= 1.8.0
- **AWS CLI v2** configured with administrative credentials
- **Docker** (for local image builds / testing Lambda containers)
- **Node.js** >= 18 (for Lambda authorizer tests)

### 2. Local Setup
1. Fork and clone the repository:
   ```bash
   git clone https://github.com/your-username/trybase.git
   cd trybase
   ```
2. Navigate to the Terraform directory and configure your variables:
   ```bash
   cd terraform
   cp terraform.tfvars.example terraform.tfvars
   ```
3. Initialize Terraform:
   ```bash
   terraform init
   ```
4. Validate configurations and syntax:
   ```bash
   terraform validate
   terraform fmt -check
   ```

---

## 📜 Coding Guidelines

- **Never Commit Secrets or AWS Account IDs**:
  Always use Terraform variables (`var.*`), AWS SSM/Secrets Manager, or dynamic data sources (`data.aws_caller_identity.current`, `data.aws_region.current`).
- **Dynamic Tenants**:
  Individual tenant files are generated dynamically by CodeBuild (`tenant_<tenant_id>.tf`) and persisted in S3. Never commit individual tenant `.tf` files to Git; they are excluded via `.gitignore`.
- **Formatting**:
  Run `terraform fmt -recursive` before submitting pull requests.

---

## 🧩 Contributing a New Workload Adapter

TryBase is an open-source, modular cloud infrastructure engine for autonomous AI agents and automations. Community members can contribute adapters for popular agent frameworks and execution runtimes (e.g., **OpenClaw**, **Flowise**, **Langflow**, **CrewAI**, **AutoGen**).

Any containerized workload can run as a first-class TryBase tenant without altering the core infrastructure.

### The TryBase Platform Capabilities

When you build an adapter on TryBase, your container automatically inherits:
* **MicroVM Hardware Isolation**: Runs on private AWS ECS Fargate tasks with dedicated Firecracker MicroVM boundaries.
* **Wildcard SSL Routing**: Automatically routed on `<tenant-id>.<base-domain>` via Application Load Balancer (ALB) Host-Header rules.
* **In-Task Redis Caching (`enable_redis = true`)**: Injects a private `redis:alpine` sidecar on `127.0.0.1:6379` at $0 extra cloud cost.
* **Keyless AWS Bedrock AI (`enable_bedrock = true`)**: Dedicated IAM Task Role providing 60-min rotating STS tokens via link-local metadata (`169.254.170.2`). Zero API keys needed.
* **Managed Vector Database**: Access to TryBase's shared Graviton PostgreSQL cluster with native `pgvector` and isolated scoped users (`usr_<tenant_id>`).

---

### Step-by-Step: Adding an Adapter to TryBase

#### Step 1: Create the Example Configuration
Copy the boilerplate template:
```bash
cp terraform/tenant_adapter_template.tf.example terraform/tenant_<your_workload>.tf.example
```
Configure your container image, port, health check path, and environment variables.

#### Step 2: Plug into the CodeBuild Provisioning Engine
Open `terraform/codebuild.tf` and add a block for your workload type in the dynamic Terraform generator:
```hcl
elif [ "$WORKLOAD" = "your_workload" ]; then
  printf 'module "%s" {\n  source = "./modules/generic-workload"\n\n  service_name      = "%s"\n  subdomain         = "%s"\n  container_image   = "your-org/your-image:latest"\n  container_port    = 8000\n  health_check_path = "/health"\n  cpu               = 512\n  memory            = 1024\n  enable_redis      = true\n\n  environment_variables = {\n    PORT = "8000"\n  }\n\n  vpc_id                     = module.vpc.vpc_id\n  private_subnet_ids         = module.vpc.private_subnets\n  ecs_cluster_name           = aws_ecs_cluster.main.name\n  alb_listener_arn           = aws_lb_listener.https.arn\n  alb_security_group_id      = aws_security_group.alb.id\n  alb_listener_rule_priority = %s\n  domain_name                = var.base_domain\n}\n' \
    "$TENANT_ID" "$TENANT_ID" "$TENANT_ID" "$ALB_LISTENER_RULE_PRIORITY" \
    > "tenant_$TENANT_ID.tf"
```

#### Step 3: Add to the Automated Test Battery
Open `tests/test_api_provisioning.sh` and register your workload in the test suite dispatch block:
```bash
if [ "$TARGET_WORKLOAD" == "all" ] || [ "$TARGET_WORKLOAD" == "your_workload" ]; then
    run_workload_test "your_workload" $((PRIORITY_BASE + 4)) || FAILED=$((FAILED + 1))
fi
```

#### Step 4: Verify End-to-End
Deploy your CodeBuild changes and test the full automated provisioning cycle:
```bash
# 1. Update CodeBuild project in AWS
terraform -chdir=terraform apply -target=aws_codebuild_project.provision_tenant -target=aws_s3_object.codebuild_source -auto-approve

# 2. Run the automated provisioning test
make test-provision WORKLOAD=your_workload

# 3. Clean up the ephemeral test tenant
make clean-test-tenants
```

---

### Reference Implementations in the Repository
* [`terraform/tenant_adapter_template.tf.example`](file:///Volumes/Dev/blymo-spinout/terraform/tenant_adapter_template.tf.example): Universal starting boilerplate.
* [`terraform/tenant_hello_world.tf.example`](file:///Volumes/Dev/blymo-spinout/terraform/tenant_hello_world.tf.example): Minimal generic container (`nginxdemos/hello`).
* [`terraform/tenant_dify.tf.example`](file:///Volumes/Dev/blymo-spinout/terraform/tenant_dify.tf.example): Headless AI Studio with Redis sidecar, dedicated DB, and `pgvector`.
* [`terraform/tenant_example.tf.example`](file:///Volumes/Dev/blymo-spinout/terraform/tenant_example.tf.example): n8n workflow engine with schema-per-tenant isolation.

---

## 🐛 Submitting Issues & Pull Requests

1. **Bug Reports**:
   Please provide reproduction steps, Terraform version, AWS region, and sanitized log output.
2. **Feature Requests**:
   Open an issue first to discuss the architecture proposal before writing large changes.
3. **Pull Requests**:
   - Create a feature branch (`git checkout -b feat/my-improvement`).
   - Commit with descriptive messages.
   - Open a PR against `main`.

---

## ⚖️ License
By contributing to TryBase, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
