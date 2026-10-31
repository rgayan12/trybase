# Getting Started with TryBase

This guide walks you through bootstrapping your cloud environment, auditing infrastructure costs, deploying the hyperscaler engine, and launching your first isolated AI agent workload.

---

## Prerequisites

Before beginning, ensure your local development workstation has the following tools installed:

| Tool | Minimum Version | Purpose |
| :--- | :--- | :--- |
| **Terraform** | `v1.5.0+` | Infrastructure-as-code orchestration |
| **AWS CLI** | `v2.15.0+` | AWS identity & STS token management |
| **Docker** | `v24.0.0+` | Container packaging and local validation |
| **Infracost** | `v0.10.0+` | Pre-deploy cloud bill estimation |
| **Node.js** | `v18.0.0+` | Web console and control plane dependencies |
| **jq** | `v1.6+` | Command-line JSON parsing |

You can verify your environment with one command:

```bash
make check-env
```

---

## AWS Credentials & IAM Setup

TryBase requires an AWS account with permissions to provision VPCs, ECS clusters, RDS databases, Application Load Balancers, IAM roles, and Step Functions.

Authenticate your AWS CLI session:

```bash
aws configure
# Or assume a privileged role:
export AWS_REGION="eu-west-2"
export AWS_DEFAULT_REGION="eu-west-2"
```

Verify your active identity:

```bash
aws sts get-caller-identity
```

---

## Environment Configuration

Clone the repository and prepare your Terraform variables:

```bash
git clone https://github.com/rgayan12/trybase.git
cd trybase
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
```

Edit `terraform/terraform.tfvars` with your target settings:

```hcl
aws_region       = "eu-west-2"
environment      = "production"
root_domain      = "yourdomain.com"
route53_zone_id  = "Z0123456789ABCDEF"
rds_master_user  = "postgres"
db_instance_class = "db.t4g.micro"
```

---

## Pre-Deploy FinOps Audit

TryBase enforces pre-deploy cost auditing to prevent unexpected AWS cloud bills. Run Infracost against the Terraform configuration:

```bash
make cost
```

This parses the complete resource graph (VPC, NAT Gateways, Graviton RDS, ALB, and Fargate profiles) and generates a line-item monthly forecast:

```text
Project: trybase/terraform
────────────────────────────────────────────────────────
aws_lb.main (ALB)                   $22.26 / mo
aws_db_instance.rds (db.t4g.micro)  $18.10 / mo
aws_ecs_cluster.main                $0.00 / mo
────────────────────────────────────────────────────────
OVERALL TOTAL:                      ~$280.00 / mo baseline (Multi-AZ)
```

---

## Deploying the Fleet

Once satisfied with the cost forecast, execute the automated infrastructure deployment:

```bash
trybase infra
# or: make infra
```

This target performs the following operations:
1. **Initializes Remote State**: Configures S3 backend with DynamoDB state locking (`trybase bootstrap`).
2. **Provisions Network Core**: Creates the multi-AZ VPC, public/private subnets, Route Tables, and NAT Gateways.
3. **Deploys Hypervisor**: Configures the ECS Fargate cluster with Graviton ARM64 execution support.
4. **Stands up Vector Database**: Boots an RDS PostgreSQL 16.3 instance with the native `pgvector` 0.7.0 extension enabled.
5. **Configures Wildcard Ingress**: Attaches wildcard ACM certificates to the Application Load Balancer (`*.apps.yourdomain.com`).
6. **Deploys Step Functions**: Configures the asynchronous provisioning state machine and API Gateway integration.

Deployment typically completes in **6 to 8 minutes**.

---

## Launching the Web Console

The TryBase Web Console provides a clean, calm dashboard to deploy, monitor, and inspect your AI agent containers.

### 1. Configure Web Environment

Copy the example environment file inside `web/`:

```bash
cd web
cp .env.example .env.local
```

Populate `.env.local` with your Supabase and API Gateway endpoints:

```bash
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1Ni...
VITE_API_GATEWAY_URL=https://api.yourdomain.com/v1
```

### 2. Start the Development Server

From your repository root, run:

```bash
trybase web
# or: make web
```

Visit `http://localhost:5173` to sign in. In the open-source version, authentication takes you straight to the dashboard with **unlimited container deployments** on your AWS fleet.

---

## Deploying Your First Workload

Once inside the Web Console:
1. Click **+ Deploy Workload**.
2. Select your workload engine:
   * **Custom AI Container**: Any Docker container running Python, FastAPI, CrewAI, LangChain, or custom LLM logic.
   * **Dify AI Studio**: Full-stack visual agent and RAG workflow builder.
   * **n8n Automation**: Node-based workflow orchestrator with isolated PostgreSQL schemas.
3. Choose or customize your subdomain slug (e.g. `nova-agent`).
4. Click **Deploy Infrastructure**.

AWS Step Functions will spin up the dedicated Fargate MicroVM, bind the ALB routing rule, create the pgvector schema, and expose the live endpoint at `https://nova-agent.agent.yourdomain.com` in under 90 seconds.

---

## Next Steps

* [Read the Architecture Deep Dive](./architecture.md)
* [Review the Security Standard & Zero-Static Secrets](./security.md)
* [Write a Custom Workload Adapter](./workload-adapters.md)
