# Workload Adapter Specification

> [!NOTE]
> A **Workload Adapter** is a declarative specification that packages an autonomous AI agent runtime or orchestration studio into TryBase's multi-tenant cloud fabric.

---

## 1. The 4 Architectural Contracts

Every Workload Adapter satisfies four core contracts:

| Contract | Implementation | Guarantee |
| :--- | :--- | :--- |
| **1. Compute Hypervisor** | AWS Fargate Graviton ARM64 | MicroVM isolation, independent CPU/RAM scaling |
| **2. Traffic Ingress** | ALB Host-Header Routing Rule | Wildcard TLS termination, automatic subdomain routing |
| **3. Vector Memory** | RDS PostgreSQL with `pgvector` | Dedicated schema, HNSW indexed embeddings |
| **4. In-Task Caching** | Local Redis sidecar container | `127.0.0.1:6379`, 0.05ms loopback latency, $0 extra cost |

---

## 2. Directory Layout of an Adapter

Workload adapters live under `terraform/adapters/` or `terraform/modules/generic-workload/`:

```text
terraform/
├── adapters/
│   ├── agent.tf               # Custom Agent container adapter
│   ├── dify.tf                # Dify AI Studio adapter
│   └── n8n.tf                 # n8n workflow engine adapter
└── tenant_adapter_template.tf.example  # Universal boilerplate template
```

---

## 3. Supported Starter Adapters

TryBase ships with production adapters for three primary workload archetypes:

1. **Custom AI Container (`agent`)**: Any container running Python, FastAPI, CrewAI, LangGraph, or custom agent code.
2. **Dify AI Studio (`dify`)**: Visual agent canvas and full-stack RAG pipeline with Celery workers and Redis sidecar.
3. **n8n Automation (`n8n`)**: Workflow automation engine with dedicated PostgreSQL schemas.

---

[Next: Custom Agent: Python & FastAPI →](./python-agent.md)
