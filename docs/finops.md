# FinOps & Cloud Cost Governance

TryBase treats infrastructure cost as a first-class engineering metric. Cloud bills must be predictable, auditable, and attributed per tenant.

---

## Infracost Audits

TryBase integrates with [Infracost](https://www.infracost.io/) to audit the monthly cost of all AWS resources before applying changes.

### Running a Cost Audit
Execute the Make target from the project root:

```bash
make cost
```

Infracost evaluates the Terraform dependency graph against live AWS pricing APIs:

```text
Project: trybase/terraform
──────────────────────────────────────────────────────────────────────────
Resource                                       Quantity  Unit      Monthly
──────────────────────────────────────────────────────────────────────────
aws_lb.main (Application Load Balancer)             730  hours      $22.26
  + LCU data processed                                -  GB          $0.00
aws_db_instance.rds (PostgreSQL db.t4g.micro)       730  hours      $18.10
  + Storage (gp3, 20 GB)                             20  GB          $2.30
aws_nat_gateway.main (NAT Gateway, 2 AZs)          1460  hours      $65.70
  + Data processed (100 GB)                         100  GB          $4.50
aws_ecs_cluster.main                                  -  -           $0.00
──────────────────────────────────────────────────────────────────────────
OVERALL TOTAL:                                                  ~$112.86 / mo
```

---

## Baseline Run-Rate

The baseline cost of running a production-grade TryBase cluster with high-availability networking, load balancing, and database storage:

| Component | Sizing | Monthly Cost (est.) |
| :--- | :--- | :--- |
| **AWS Application Load Balancer** | 1 Shared ALB (Multi-AZ) | ~$22.26 |
| **AWS Graviton RDS (pgvector)** | `db.t4g.micro` (gp3, 20 GB) | ~$20.40 |
| **AWS NAT Gateways** | 2 Multi-AZ NAT Gateways | ~$70.20 |
| **Route 53 & ACM** | Hosted Zone & Wildcard TLS | ~$0.50 |
| **Base Infrastructure Total** | Standing cluster overhead | **~$113.36 / month** |

All workloads share this baseline infrastructure. Adding a new agent container does **not** provision a new database or load balancer.

---

## Per-Workload Compute Pricing

When a workload is active, AWS charges for Fargate Graviton ARM64 resources on a per-second basis (minimum 1 minute):

| Task Configuration | vCPU | RAM | Cost per Hour | Cost per Day (24h) |
| :--- | :--- | :--- | :--- | :--- |
| **Micro Agent** | 0.25 vCPU | 512 MiB | $0.008 | $0.19 |
| **Standard Agent** | 0.50 vCPU | 1024 MiB | $0.016 | $0.38 |
| **Studio (Dify / n8n)** | 1.00 vCPU | 2048 MiB | $0.032 | $0.77 |

---

## Scale-to-Zero Architecture

For workloads that process batch jobs, asynchronous webhooks, or periodic automation triggers, standing containers represent unnecessary idle spend.

TryBase supports Scale-to-Zero orchestration:
1. **Idle Detection**: CloudWatch metric alarms monitor ALB target group request counts. When a workload receives 0 requests for a configured duration (e.g. 30 minutes), an alarm triggers.
2. **Task Suspension**: Step Functions scales the ECS Fargate Service desired count to `0`.
3. **Reactive Rehydration**: When an inbound HTTP request arrives at the ALB, the listener triggers a lightweight Lambda function that scales the service back to `1` and buffers the initial request.

---

## Next Steps

* [Explore the API Reference](./api-reference.md)
* [Review Workload Adapter Specifications](./workload-adapters.md)
* [Inspect the Security Standard](./security.md)
