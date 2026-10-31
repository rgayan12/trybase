# TryBase Unified CLI & Command Reference

> [!TIP]
> TryBase operations are unified under the **`trybase`** Developer CLI (`@trybase/cli`), with standard `make` targets provided as convenient 1-to-1 aliases.

---

## 1. CLI Installation & Updates

### Global Installation (Recommended)
```bash
npm install -g @trybase/cli
```
*Or run commands instantly without installing using `npx @trybase/cli <command>`.*

### Updating the CLI
- **Public npm release**:
  ```bash
  npm install -g @trybase/cli@latest
  ```
- **Local development in cloned repository**:
  ```bash
  make cli
  ```
  *(Recompiles and links the binary locally in ~2 seconds).*

---

## 2. Command Reference

| TryBase CLI Command | Make Alias | Description | Example Usage |
| :--- | :--- | :--- | :--- |
| `trybase doctor` | `make doctor` / `make check-env` | Verifies workstation tools (Terraform, AWS credentials, Docker daemon, Node, Supabase) | `trybase doctor` |
| `trybase bootstrap` | `make bootstrap` | Provisions S3 remote state bucket and DynamoDB lock table in AWS | `trybase bootstrap` |
| `trybase control-plane` | `make control-plane` | Pushes Supabase migrations, deploys Edge Functions, and auto-syncs ES256 JWKS | `trybase control-plane` |
| `trybase infra` | `make infra` | Deploys AWS fleet infrastructure (VPC, Graviton RDS PostgreSQL, ALB, Step Functions, ECS) | `trybase infra` |
| `trybase up` | `make up` / `make all` | One-shot full deployment: runs `control-plane` then `infra` sequentially | `trybase up` |
| `trybase web` | `make web` | Starts the local React/Vite dashboard console and documentation at `localhost:5173` | `trybase web` |
| `trybase cost` | `make cost` | Runs Infracost FinOps cloud spend breakdown and hourly cost forecast | `trybase cost` |
| `trybase destroy` | `make destroy` | Tears down cloud resources cleanly with automatic ENI retry handling | `trybase destroy` |
| `trybase sync` | `make sync` | Re-synchronizes remote tenant state from S3 to local Git | `trybase sync` |

---

## 3. Workload & Secret Management Commands

| Command | Description | Example Usage |
| :--- | :--- | :--- |
| `trybase login` | Authenticates the CLI with your Control Plane using Supabase JWT | `trybase login` |
| `trybase env push` | Injects local `.env` values directly into AWS Secrets Manager (Anti-Leak Standard) | `trybase env push .env.prod -t acme` |
| `trybase fleet deploy` | Deploys a multi-workload organization manifest (`trybase.fleet.yml`) via Step Functions | `trybase fleet deploy` |
| `trybase status` | Displays active workloads, CPU/memory allocations, and container health | `trybase status -o acme-corp` |

---

## 4. Low-Level AWS CLI Debugging Commands

### Inspect Active ECS Tasks
```bash
aws ecs list-tasks --cluster trybase-production-cluster --region eu-west-2
```

### Stream Task Logs from CloudWatch
```bash
aws logs tail /ecs/trybase-fast-sam-soars --follow --region eu-west-2
```

### Query Active ALB Listener Rules
```bash
aws elbv2 describe-rules --listener-arn <LISTENER_ARN> --region eu-west-2
```

---

[Back to Documentation Index →](../README.md)
