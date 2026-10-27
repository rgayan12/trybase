# Pre-Deploy FinOps Audit

> [!IMPORTANT]
> Running `make cost` audits your full AWS dependency graph against live AWS pricing APIs before provisioning a single cloud resource. Never deploy changes without verifying the Infracost forecast.

---

## 1. Why Pre-Deploy Auditing Matters

Autonomous agent architectures frequently consume unexpected cloud resources through:
* Multi-AZ NAT Gateway data transfer
* Provisioned IOPS or excessive database instance sizing
* Idle load balancer listener rule overhead
* Unscaled background worker microVMs

TryBase embeds [Infracost](https://www.infracost.io/) directly into the development workflow to ensure absolute cost transparency before `terraform apply`.

---

## 2. Running the Cost Audit

From the repository root, run:

```bash
make cost
```

Infracost evaluates the 182 AWS resources declared across `terraform/` and outputs a breakdown:

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
aws_route53_zone.main                                 1  months      $0.50
aws_ecs_cluster.main                                  -  -           $0.00
──────────────────────────────────────────────────────────────────────────
OVERALL TOTAL:                                                  ~$113.36 / mo
```

---

## 3. Auditing Workload Diffs

When you add a new Workload Adapter or adjust compute parameters (e.g. upgrading an agent task from `0.25 vCPU` to `1 vCPU`), run `infracost diff` to evaluate the delta:

```bash
infracost diff --path terraform/
```

Example diff output:

```text
Project: trybase/terraform

~ module.workload_agent.aws_ecs_task_definition.task
  +$11.52 / mo ($0.016/hr -> $0.032/hr)
  + CPU units: 512 -> 1024
  + Memory: 1024 -> 2048

Monthly cost will increase by $11.52
```

---

[Next: Fleet Deployment →](./deployment.md)
