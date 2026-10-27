# In-Task Redis Sidecar Pattern

> [!TIP]
> Modern agent frameworks (such as Dify for Celery worker queues or LangChain for conversation buffers) require Redis. TryBase delivers Redis caching with zero infrastructure cost and physical isolation.

---

## 1. The ElastiCache Dilemma

In traditional AWS deployments, architects provision a shared **Amazon ElastiCache Redis** cluster:
* Standing idle cost: **~$25 to $60/month per cluster**.
* Network latency: 1.5ms to 3.0ms over VPC network interfaces.
* **Cross-Tenant Collisions**: If Tenant A fills Redis memory or flushes keys (`FLUSHALL`), Tenant B suffers immediate data corruption or downtime.

---

## 2. The In-Task Sidecar Architecture

TryBase deploys `redis:7-alpine` as a secondary container inside the tenant's Fargate task definition:

```
┌────────────────────────────────────────────────────────┐
│  Fargate MicroVM Task (awsvpc Network Namespace)       │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Application Container (Dify / FastAPI / n8n)     │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           │                            │
│                           ▼ connects to 127.0.0.1:6379 │
│                           │ (0.05ms loopback latency)  │
│  ┌────────────────────────┴─────────────────────────┐  │
│  │ Redis Sidecar Container (redis:7-alpine, 128MB)  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

Because both containers share the same `awsvpc` network namespace, communication travels over the **Linux loopback interface (`127.0.0.1`)**.

---

## 3. Architectural Guarantees

| Metric | AWS ElastiCache Cluster | TryBase In-Task Sidecar |
| :--- | :--- | :--- |
| **Monthly Cost** | ~$35.00 / month | **$0.00** (Runs inside task RAM) |
| **Round-Trip Latency** | 1.8ms - 3.5ms (Network hop) | **0.05ms (Kernel loopback)** |
| **Cache Isolation** | Shared keyspace (Risk of leakage) | **Physically isolated in MicroVM cgroup** |
| **Scale-to-Zero** | Always running ($$$) | **Suspends with task when idle** |

---

## 4. Task Definition Declaration

In Terraform, the sidecar is declared alongside the main container:

```json
[
  {
    "name": "application",
    "image": "ghcr.io/trybase/agent:latest",
    "essential": true,
    "environment": [
      { "name": "REDIS_HOST", "value": "127.0.0.1" },
      { "name": "REDIS_PORT", "value": "6379" }
    ]
  },
  {
    "name": "redis-sidecar",
    "image": "redis:7-alpine",
    "essential": true,
    "memoryReservation": 128
  }
]
```

---

[Next: Keyless STS Authentication Loop →](../security/keyless-sts.md)
