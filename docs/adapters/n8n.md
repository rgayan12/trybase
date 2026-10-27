# Adapter: n8n Automation

> [!NOTE]
> n8n is an extendable workflow automation tool. TryBase packages n8n with PostgreSQL schema isolation and encrypted execution credential storage.

---

## 1. Architecture & Port Mapping

| Parameter | Specification |
| :--- | :--- |
| **Container Port** | `5678` |
| **Health Check Path**| `/healthz` |
| **Database Target** | Dedicated PostgreSQL schema (`tenant_slug`) |
| **Execution Mode** | Main process with optional webhook scaling |
| **Fargate Sizing** | `512` CPU (0.5 vCPU) • `1024` MiB RAM |

---

## 2. Terraform Adapter Specification

```hcl
module "n8n_workload" {
  source = "./modules/generic-workload"

  tenant_id                  = var.tenant_id
  workload_type              = "n8n"
  container_image            = "n8nio/n8n:1.40.0"
  container_port             = 5678
  health_check_path          = "/healthz"
  alb_listener_rule_priority = var.alb_listener_rule_priority
  
  cpu                        = "512"
  memory                     = "1024"

  environment = [
    { name = "DB_TYPE", value = "postgresdb" },
    { name = "DB_POSTGRESDB_HOST", value = aws_db_instance.rds.address },
    { name = "DB_POSTGRESDB_PORT", value = "5432" },
    { name = "DB_POSTGRESDB_DATABASE", value = "n8n" },
    { name = "DB_POSTGRESDB_SCHEMA", value = replace(var.tenant_id, "-", "_") },
    { name = "N8N_ENCRYPTION_KEY", value = random_password.encryption_key.result },
    { name = "WEBHOOK_URL", value = "https://${var.tenant_id}.n8n.${var.root_domain}/" }
  ]
}
```

---

[Next: Authoring a New Workload Adapter →](./authoring.md)
