# ALB & Wildcard TLS Ingress

> [!TIP]
> TryBase eliminates the cost of provisioning individual load balancers for each customer by sharing a single high-availability Application Load Balancer across hundreds of workloads.

---

## 1. High-Density Ingress Architecture

Provisioning an AWS Application Load Balancer per tenant costs ~$22.26/month in standing fees. For a platform with 50 customer workloads, individual ALBs would cost **$1,113/month**.

TryBase shares a single ALB across all workloads using **Host-Header Routing Rules**:

```
Inbound Request: https://tenant-alpha.agent.trybase.io
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│  Shared Application Load Balancer (Port 443)           │
│  ACM Wildcard Certificate (*.agent.trybase.io)         │
├────────────────────────────────────────────────────────┤
│  ALB Rule 14250: Host = tenant-alpha.agent.trybase.io  │
│  Action: Forward to Target Group tg-tenant-alpha       │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼ (Private Subnet)
┌────────────────────────────────────────────────────────┐
│  Fargate MicroVM: tenant-alpha (10.0.10.142:8080)      │
└────────────────────────────────────────────────────────┘
```

---

## 2. Terraform Listener Rule Definition

When a workload is provisioned via Step Functions, an ALB Listener Rule is registered:

```hcl
resource "aws_lb_listener_rule" "workload_routing" {
  listener_arn = aws_lb_listener.https.arn
  priority     = var.alb_listener_rule_priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.workload.arn
  }

  condition {
    host_header {
      values = ["${var.tenant_id}.${var.workload_domain}"]
    }
  }
}
```

### Rule Priority Allocation
ALB listener rule priorities must be unique integers between `1` and `50000`. TryBase assigns priority numbers deterministically or via random range assignment (`100` to `49100`), reserving `50000` for default 404 catch-alls.

---

## 3. Health Checks & Zero-Downtime Swaps

Each target group is configured with an automated health check:

| Setting | Value |
| :--- | :--- |
| **Protocol** | HTTP |
| **Path** | `/healthz` (agent, n8n) or `/health` (dify) |
| **Healthy Threshold** | 2 consecutive successes |
| **Unhealthy Threshold**| 3 consecutive failures |
| **Interval** | 15 seconds |
| **Timeout** | 5 seconds |

Step Functions monitors this health check until the container returns `HTTP 200` before routing public traffic, guaranteeing zero-downtime deployments.

---

[Next: Vector Memory & pgvector Subsystem →](./pgvector.md)
