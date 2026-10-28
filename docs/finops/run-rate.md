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

## 3. Real-World Fleet Economics: 50 Tenant Workloads

A realistic comparison of running 50 isolated customer workloads:

* **Approach A: Managed Commercial SaaS / PaaS (Per-Seat / Per-Instance)**:
  * 50 hosted instances at $50–$100/mo each = **$2,500 – $5,000/month**
  * Vendor lock-in, zero access to underlying AWS infrastructure or VPCs.

* **Approach B: Kubernetes (EKS) with Shared Ingress & Shared RDS**:
  * 1 EKS Control Plane = $73.00/month
  * 1 Shared ALB = $22.26/month
  * 2 NAT Gateways = $70.20/month
  * 3 EC2 Worker Nodes (`t4g.xlarge` / `m6g.large` to schedule 50 pods) = ~$200.00/month
  * 1 Shared RDS PostgreSQL = $35.00/month
  * **Total: ~$400.46/month** (Requires ongoing SRE maintenance, complex Helm charts, and Ingress routing).

* **Approach C: TryBase Virtual Single-Tenancy (Fargate MicroVMs + Scale-to-Zero)**:
  * 1 Shared ALB = $22.26/month
  * 1 Shared Graviton RDS (with `pgvector` & scoped schemas) = $20.40/month
  * 2 NAT Gateways = $70.20/month
  * 50 In-Task Redis sidecars = **$0.00**
  * 50 Standard Fargate MicroVMs with Scale-to-Zero (~8 hrs/day active):
    * 50 × ~$3.84/mo = ~$192.00/month
  * **Total: ~$304.86/month (Zero Kubernetes cluster fees, physical MicroVM isolation, and zero .env files)**

---

[Next: Scale-to-Zero Architecture →](./scale-to-zero.md)

