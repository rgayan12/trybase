# Installation & Prerequisites

> [!NOTE]
> TryBase requires a set of standard cloud and DevOps tools. Follow these pre-flight instructions to verify your workstation before provisioning infrastructure.

---

## 1. System Requirements

Ensure your local workstation or CI/CD runner has the following minimum versions installed:

| Tool | Recommended Version | Verification Command | Purpose |
| :--- | :--- | :--- | :--- |
| **Terraform** | `v1.5.0` or higher | `terraform version` | Cloud resource orchestration |
| **AWS CLI** | `v2.15.0` or higher | `aws --version` | STS credential management & IAM operations |
| **Docker** | `v24.0.0` or higher | `docker --version` | Container packaging & local validation |
| **Infracost** | `v0.10.0` or higher | `infracost --version` | Pre-deploy cloud cost forecasting |
| **Node.js** | `v18.0.0` (LTS) or higher | `node --version` | Control plane & web console execution |
| **jq** | `v1.6` or higher | `jq --version` | Command-line JSON parsing |

---

## 2. Installing the TryBase CLI

Install the unified TryBase developer CLI globally:

```bash
npm install -g @trybase/cli
```

*If working directly inside the cloned TryBase repository, you can build and link the CLI locally with:*
```bash
make cli
```

---

## 3. Automated Pre-Flight Health Check (`trybase doctor`)

Run the automated diagnostic suite to verify your workstation tools, AWS credentials, and Docker engine:

```bash
trybase doctor
# or: make doctor / make check-env
```

Expected output:

```text
🩺 TryBase Pre-Flight Health Check
Repository Root: /path/to/trybase

  ✔ Node.js                  v20.18.3 (>= 18.0.0 required)
  ✔ Terraform                v1.5.7
  ✔ AWS Credentials          Account: 123456789012 (eu-west-2)
  ✔ Docker Daemon            Running
  ✔ Supabase CLI             Authenticated (v2.90.0)
  ✔ Infracost (FinOps)       infracost version v2.18.2
  ✔ Infrastructure Config    terraform.tfvars present

──────────────────────────────────────────────────────────────────
🎉 All required tools operational! Workstation is ready.
```

If any tool is missing, install it via Homebrew on macOS:

```bash
brew install terraform awscli docker infracost node supabase/tap/supabase
```

---

## 4. AWS Account Permissions

TryBase provisions an interconnected cloud fleet and requires an IAM identity with permissions for:

### Compute & Orchestration
* **Amazon ECS**: ECS clusters, task definitions, and Fargate services.
* **AWS Step Functions**: State machines and asynchronous tenant provisioning pipelines.
* **AWS Lambda**: API Gateway token authorizers, database schema creation, and success notifications.
* **AWS CodeBuild**: Automated Terraform execution environment invoked by Step Functions.
* **Amazon ECR (Elastic Container Registry)**: Workload container images and Lambda build artifacts.

### Networking & Ingress
* **Amazon VPC**: VPCs, subnets, route tables, internet gateways, NAT gateways, and security groups.
* **Elastic Load Balancing (ALB)**: Application Load Balancers, target groups, and SNI/subdomain HTTPS routing rules.
* **AWS Certificate Manager (ACM)**: Wildcard SSL/TLS certificates.
* **Amazon EC2**: Elastic Network Interfaces (ENIs), Elastic IPs, and optional bastion host.

### State, Storage & Database
* **Amazon RDS**: Shared PostgreSQL instance, subnet groups, and parameter groups.
* **Amazon S3**: Remote Terraform state backend (`terraform.tfstate`), CodeBuild source bundles, and state sync.
* **Amazon DynamoDB**: Distributed state locking table preventing concurrent Terraform execution conflicts.
* **AWS Secrets Manager**: Anti-Leak secret storage (`trybase/tenants/<id>/secrets`) and master credentials.

### Observability, Security & AI
* **AWS IAM & STS**: Roles, execution policies, and temporary session credential rotation.
* **Amazon CloudWatch & Logs**: Container stdout/stderr streams, Step Function audit trails, and alarms.
* **Amazon API Gateway**: REST APIs, custom Lambda authorizers, and stage deployments.
* **Amazon Bedrock (Optional)**: Task execution role permissions for autonomous AI agent inference.

Authenticate your AWS CLI session:

```bash
aws configure
```

Verify your active identity and account ID:

```bash
aws sts get-caller-identity
```

---

## 5. Supabase Control Plane Setup (Free)

TryBase uses Supabase for user authentication, organization management, and tenant control plane tracking:

1. Create a free account at [supabase.com](https://supabase.com) and click **New Project**.
2. Set your **Project Name** (e.g. `trybase-control-plane`), enter a secure **Database Password**, and select your closest AWS region.
3. Note your **Project Reference ID** from your project's dashboard URL:
   ```text
   https://supabase.com/dashboard/project/abcdefghijklmnopqrst
                                          └── PROJECT REF ──┘
   ```
4. Deploy the database schema and Edge Functions:
   ```bash
   trybase control-plane
   # or: make control-plane
   ```
   *When prompted, paste your 20-character **Project Reference ID** and enter your database password. TryBase will automatically push all database migrations and deploy provisioning edge functions.*

---

[Next: Environment Configuration →](./configuration.md)
