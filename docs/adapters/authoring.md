# Authoring a New Workload Adapter

> [!TIP]
> We welcome open-source contributions of adapters for popular autonomous runtimes (Langflow, AutoGen, CrewAI, Flowise). Follow this step-by-step guide to package your framework.

---

## Step 1: Copy Universal Adapter Template

From the `terraform/` directory, copy the boilerplate template:

```bash
cp terraform/tenant_adapter_template.tf.example terraform/adapters/crewai.tf
```

---

## Step 2: Configure Workload Metadata

Edit your adapter file and define the container parameters:

```hcl
locals {
  workload_type      = "crewai"
  container_image    = "ghcr.io/crewai/studio:latest"
  container_port     = 8000
  health_check_path  = "/api/v1/health"
  default_cpu        = "1024" # 1 vCPU
  default_memory     = "2048" # 2 GiB
}
```

---

## Step 3: Wire Environment & Sidecars

If your runtime requires Redis caching or background task workers, enable the Redis sidecar:

```hcl
module "crewai_adapter" {
  source = "../modules/generic-workload"

  tenant_id                  = var.tenant_id
  workload_type              = local.workload_type
  container_image            = local.container_image
  container_port             = local.container_port
  health_check_path          = local.health_check_path
  alb_listener_rule_priority = var.alb_listener_rule_priority

  enable_redis_sidecar       = true

  environment = [
    { name = "REDIS_URL", value = "redis://127.0.0.1:6379/0" },
    { name = "DATABASE_URL", value = "postgresql://${var.db_user}:${var.db_password}@${var.db_host}:5432/${var.tenant_id}" },
    { name = "AWS_DEFAULT_REGION", value = "eu-west-2" }
  ]
}
```

---

## Step 4: Run Verification Tests

Test provisioning your new adapter in an isolated test environment:

```bash
make test-provision WORKLOAD=crewai
```

Verify that the target group returns `HTTP 200` on the health check endpoint within 90 seconds.

Submit your pull request following [CONTRIBUTING.md](../../CONTRIBUTING.md).

---

[Next: Infracost Auditing →](../finops/infracost.md)
