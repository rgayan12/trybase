# Infracost Auditing

> [!NOTE]
> TryBase embeds Infracost into local workflows and CI/CD pipelines to guarantee that cloud expenditures are verified before any terraform apply runs.

---

## 1. Running Infracost Audits

Execute the audit target:

```bash
make cost
```

Infracost evaluates the resource graph against the AWS Cloud Pricing API:

```text
Project: trybase/terraform
──────────────────────────────────────────────────────────────────────────
Resource                                       Quantity  Unit      Monthly
──────────────────────────────────────────────────────────────────────────
aws_lb.main (Application Load Balancer)             730  hours      $22.26
aws_db_instance.rds (PostgreSQL db.t4g.micro)       730  hours      $18.10
  + Storage (gp3, 20 GB)                             20  GB          $2.30
aws_nat_gateway.main (NAT Gateway, 2 AZs)          1460  hours      $65.70
  + Data processed (100 GB)                         100  GB          $4.50
aws_route53_zone.main                                 1  months      $0.50
──────────────────────────────────────────────────────────────────────────
OVERALL TOTAL:                                                  ~$113.36 / mo
```

---

## 2. GitHub Actions CI/CD Integration

To enforce cost governance on pull requests, add this GitHub Actions workflow:

```yaml
name: "Infracost FinOps Check"
on: [pull_request]

jobs:
  infracost:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Infracost
        uses: infracost/actions/setup@v3
        with:
          api-key: ${{ secrets.INFRACOST_API_KEY }}

      - name: Run Infracost breakdown
        run: infracost breakdown --path=terraform/ --format=json --out-file=/tmp/infracost.json

      - name: Post Infracost Comment
        uses: infracost/actions/comment@v3
        with:
          path: /tmp/infracost.json
          behavior: update
```

Any pull request that increases cloud spend will receive an automated breakdown comment displaying the exact dollar delta.

---

[Next: Baseline Cloud Run-Rate →](./run-rate.md)
