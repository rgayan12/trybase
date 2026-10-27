# Adapter: Dify AI Studio

> [!TIP]
> Dify is an open-source LLM app development platform. TryBase packages Dify with dedicated database isolation and a zero-cost Redis sidecar for Celery task queues.

---

## 1. Dify Topology on TryBase

```
┌────────────────────────────────────────────────────────┐
│  Fargate MicroVM: tenant-dify (awsvpc)                 │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Dify API & Web Container (Port 5001)             │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           │                            │
│                           ▼ (127.0.0.1:6379)           │
│  ┌────────────────────────┴─────────────────────────┐  │
│  │ Redis 7 Alpine Sidecar (Celery Workers & Cache)  │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  Graviton RDS: Dedicated Database db_tenant_dify       │
│  pgvector enabled for visual RAG pipelines             │
└────────────────────────────────────────────────────────┘
```

---

## 2. Terraform Adapter Specification

```hcl
module "dify_workload" {
  source = "./modules/generic-workload"

  tenant_id                  = var.tenant_id
  workload_type              = "dify"
  container_image            = "langgenius/dify-api:0.6.10"
  container_port             = 5001
  health_check_path          = "/health"
  alb_listener_rule_priority = var.alb_listener_rule_priority
  
  cpu                        = "1024" # 1.0 vCPU
  memory                     = "2048" # 2.0 GiB RAM

  # Redis loopback sidecar
  enable_redis_sidecar       = true

  environment = [
    { name = "DB_HOST", value = aws_db_instance.rds.address },
    { name = "DB_PORT", value = "5432" },
    { name = "DB_NAME", value = "db_${replace(var.tenant_id, "-", "_")}" },
    { name = "REDIS_HOST", value = "127.0.0.1" },
    { name = "REDIS_PORT", value = "6379" },
    { name = "VECTOR_STORE", value = "pgvector" }
  ]
}
```

---

[Next: Adapter: n8n Automation →](./n8n.md)
