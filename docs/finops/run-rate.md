# Baseline Cloud Run-Rate

> [!TIP]
> Understanding the division between standing cluster overhead and per-workload compute allows platforms to forecast margins with mathematical certainty.

---

## 1. Standing Base Infrastructure

Every production TryBase cluster maintains high-availability networking, multi-AZ database clustering, and traffic ingress:

| Resource | Configuration | Monthly Cost (est.) | Purpose |
| :--- | :--- | :--- | :--- |
| **Application Load Balancer** | 1 Shared ALB (Multi-AZ) | ~$22.26 | Wildcard TLS & layer-7 routing |
| **AWS Graviton RDS (pgvector)** | `db.t4g.micro` (gp3, 20 GB) | ~$20.40 | Relational state & vector embeddings |
| **AWS NAT Gateways** | 2 Multi-AZ Gateways | ~$70.20 | Secure outbound egress for 0-public-IP tasks |
| **Route 53 Hosted Zone** | Public Hosted Zone | ~$0.50 | Wildcard DNS resolution |
| **Base Standing Total** | Multi-AZ High Availability | **~$113.36 / month** | Shared across ALL tenants |

---

## 2. Per-Workload Compute Pricing

When workloads run, AWS charges for Fargate Graviton ARM64 resources on a per-second basis (minimum 1 minute):

| Task Profile | Sizing | Hourly Rate | 24/7 Run-Rate (Monthly) |
| :--- | :--- | :--- | :--- |
| **Micro Agent** | 0.25 vCPU • 512 MiB | $0.008 / hr | ~$5.76 / mo |
| **Standard Agent** | 0.50 vCPU • 1024 MiB | $0.016 / hr | ~$11.52 / mo |
| **Performance Studio** | 1.00 vCPU • 2048 MiB | $0.032 / hr | ~$23.04 / mo |

---

## 3. High-Density Economics

Compare running 50 customer workloads:

* **Traditional Single-Tenant Approach**:
  * 50 ALBs = $1,113/month
  * 50 RDS instances = $1,020/month
  * 50 ElastiCache clusters = $1,750/month
  * **Total: ~$3,883/month**

* **TryBase High-Density Engine**:
  * 1 Shared ALB = $22.26/month
  * 1 Shared Graviton RDS = $20.40/month
  * 50 in-task Redis sidecars = **$0.00**
  * 50 Standard Fargate MicroVMs = $576.00/month
  * **Total: ~$688.86/month (Over 82% cost reduction)**

---

[Next: Scale-to-Zero Architecture →](./scale-to-zero.md)
