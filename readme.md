<div align="center">

<p align="center">
  <img src="docs/assets/banner.png" alt="TryBase Cloud Engine" width="650" />
</p>

### The Open-Source Cloud Infrastructure Engine for Autonomous AI Agents & Automations

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Documentation](https://img.shields.io/badge/Docs-Laravel%20Style-red.svg)](docs/README.md)
[![GitHub](https://img.shields.io/badge/GitHub-Open_Source-181717?logo=github)](https://github.com/rgayan12/trybase)
[![Hyperscaler](https://img.shields.io/badge/Hyperscaler-AWS_Fargate_%26_Bedrock-FF9900?logo=amazon-aws)](https://aws.amazon.com)
[![Vector Memory](https://img.shields.io/badge/Vector_Memory-pgvector_RDS-336791.svg?logo=postgresql)](#-schema--database-isolation-with-pgvector)
[![Infracost FinOps](https://img.shields.io/badge/FinOps-Infracost_Verified-00C7B7.svg)](#-forecasting-cloud-costs-with-infracost)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Deploy, isolate, and scale any containerized AI agent, autonomous worker, or workflow engine as a production-grade multi-tenant fleet on AWS.**  
Built for AI agencies, developers, and platform teams who need strict client data isolation, dedicated microVM compute, per-tenant IAM security, dynamic wildcard SSL subdomains, and native vector memory (`pgvector`) without paying $50+/seat SaaS fees or maintaining Kubernetes.

[📚 Read Full Documentation](docs/README.md) • [Why TryBase?](#-why-trybase) • [Architecture](#-architecture) • [Run Any Container](#-run-any-containerized-ai-agent-or-workload) • [Cost Breakdown](#-cost-breakdown) • [Quickstart](#-quickstart-guide) • [License](#-license--disclaimer)

---

</div>

## 💡 Why TryBase?

Building an AI agent or microservice locally in Docker is simple (`docker run my-agent:latest`). But the moment you need to serve **10, 20, or 100 isolated clients or teams**, running containers in production becomes an operational nightmare:
- **Commercial SaaS Platforms** charge **$50–$200/seat/month**, destroying agency and software profit margins at scale.
- **A Single Shared Server** creates catastrophic security risks: shared memory, API key cross-contamination, and runaway tool scripts taking down all clients.
- **Kubernetes (EKS)** requires a dedicated SRE team, complex ingress controllers, and a minimum **$150–$250/month baseline fee** before running a single tenant.
- **Separate Virtual Machines / RDS per Tenant** creates massive infrastructure bloat, complex patching, and crippling cloud bills.

**TryBase solves this with a universal container orchestration pattern:**  
Hardware-level microVM container isolation on **AWS ECS Fargate**, database and vector isolation on a shared **Graviton RDS PostgreSQL (`pgvector`)** cluster, and instant API orchestration via **AWS Step Functions & CodeBuild**. Bring any Docker image, and TryBase turns it into an isolated, routed, production-grade cloud service in minutes.

| Feature | Single Docker VPS | Managed AI SaaS | Kubernetes (EKS) | TryBase |
| :--- | :---: | :---: | :---: | :---: |
| **Compute Isolation** | ❌ Shared Process | ✅ Isolated | ⚠️ Shared Kernel | ✅ **Dedicated Firecracker MicroVM** |
| **Any Docker Image** | ✅ Manual CLI | ❌ Closed Vendor | ✅ Supported | ✅ **Universal Container Module** |
| **Database & Vector Memory** | ❌ Shared Tables | ✅ Isolated | ❌ Unmanaged Pods | ✅ **Dedicated RDS Schema/DB with `pgvector`** |
| **Subdomain Routing** | ❌ Manual Nginx | ✅ Automated | ⚠️ Complex Ingress | ✅ **Automated Host-Header ALB Routing** |
| **LLM Key Security** | ❌ Shared Env | ✅ Managed | ⚠️ Complex Secrets | ✅ **Unique AES-256 Vault per Tenant** |
| **Base Platform Cost** | ~$20/mo (No isolation) | N/A ($50+/seat) | ~$150–$250/mo | **~$50–$65/mo (Fleet-wide)** |
| **Cost for 20 Tenants** | ~$40/mo (Insecure) | ~$1,000–$4,000/mo | ~$350+/mo | **~$120–$140/mo (Full isolation)** |

---

## 🏗️ Architecture

```mermaid
graph TD
    User([End User / Client]) -->|HTTPS *.<subdomain>.yourdomain.com| ALB[AWS Application Load Balancer]
    
    subgraph Data Plane [Data Plane: Private Subnets]
        ALB -->|Host-Header Route| F1[Tenant A: AI Agent / Workload Task]
        ALB -->|Host-Header Route| F2[Tenant B: AI Agent / Workload Task]
        ALB -->|Host-Header Route| F3[Tenant C: AI Agent / Workload Task]
        
        F1 -->|isolated schema/db & pgvector| RDS[(Shared PostgreSQL RDS with pgvector)]
        F2 -->|isolated schema/db & pgvector| RDS
        F3 -->|isolated schema/db & pgvector| RDS
        
        SM[AWS Secrets Manager] -.->|Per-Tenant Secret Vault / API Keys| F1
        SM -.->|Per-Tenant Secret Vault / API Keys| F2
        SM -.->|Per-Tenant Secret Vault / API Keys| F3
    end

    subgraph Control Plane [Control Plane: Orchestration Engine]
        ClientApp([Frontend / Dashboard]) -->|POST /provision| APIGW[AWS API Gateway HTTP v2]
        APIGW -->|ES256 Verification| Auth[Lambda JWT Authorizer]
        Auth -->|Authorized| SFN[AWS Step Functions State Machine]
        
        SFN -->|1. Create DB Schema/DB & pgvector| L1[Lambda: Create Schema]
        SFN -->|2. Generate & Apply Terraform| CB[AWS CodeBuild]
        CB -->|Lock & Consistency Check| DDB[(AWS DynamoDB Lock Table)]
        CB -->|Pull Source & Sync Tenants| S3[(S3 State & Tenant Registry)]
        SFN -->|4. Callback Ping| L2[Lambda: Notify Success]
    end
```

### 1. Dedicated MicroVM Compute (ECS Fargate)
Every tenant receives their own dedicated AWS Fargate task running their containerized AI agent, worker, or workflow engine. Tasks run inside private subnets without public IPs. If one tenant runs a heavy loop or crashes, no other tenant is impacted.

### 2. Schema & Database Isolation with `pgvector` (RDS PostgreSQL)
Rather than paying for 20 separate database instances, TryBase uses a shared Graviton RDS PostgreSQL cluster with **dual-mode isolation**:
- **Schema-per-tenant** (`CREATE SCHEMA tenant_slug`): Ultra-lightweight for standard microservices and n8n.
- **Database-per-tenant** (`CREATE DATABASE db_tenant_slug`): Complete catalog isolation for frameworks like Dify.
Both modes automatically enable the **`vector` extension (`pgvector`)**, giving every tenant their own isolated vector memory and embeddings index at **$0 extra infrastructure cost**.

### 3. Dynamic Subdomain Routing (Application Load Balancer)
A shared ALB handles TLS termination via AWS Certificate Manager (ACM). When a container is provisioned, CodeBuild attaches a listener rule matching the tenant's host header (e.g. `client-a.<domain>`) forwarding directly to that tenant's target group.

### 4. Zero-Knowledge Credential Security
TryBase provisions a dedicated AES-256 secret vault per tenant in AWS Secrets Manager for encryption keys, tool credentials, and LLM API keys (OpenAI, Anthropic, Bedrock). Even on a shared database, one tenant cannot decrypt another tenant's credentials.

### 5. Serverless Provisioning Pipeline
- **API Gateway**: REST endpoint with custom ES256 JWT authorizer for Supabase / custom auth tokens.
- **Step Functions**: 4-step state machine orchestrating database setup, dynamic CodeBuild Terraform application, and callback notification.
- **S3 State & Tenant Registry**: CodeBuild automatically syncs `tenant_<slug>.tf` configurations, stores the Terraform remote state (`shared/terraform.tfstate`), and pulls the infrastructure source archive (`source/infra.zip`).
- **DynamoDB State Lock Table**: Manages distributed state locks and MD5 cryptographic integrity for Terraform (`n8n-hosting-saas-tf-locks`). Prevents race conditions and state corruption when multiple tenants are provisioned concurrently by CodeBuild or when local administrators run Terraform.

---

## 💰 Cost Breakdown

TryBase is designed to be lean. Below is an estimated real-world AWS cost breakdown (using standard pricing in `us-east-1` / `eu-west-2`):

### Shared Platform Base (Fixed)
| Resource | Spec | Est. Monthly Cost |
| :--- | :--- | :--- |
| **AWS RDS PostgreSQL** | `db.t4g.micro` (ARM64, 20GB GP2) | ~$15.00 |
| **Application Load Balancer** | 1 ALB with SSL termination | ~$18.00–$22.00 |
| **VPC Endpoints & Networking** | S3 Gateway + Secrets Manager Endpoints | ~$15.00–$25.00 |
| **API Gateway & Step Functions** | Serverless (Pay-per-request) | < $1.00 |
| **DynamoDB (State Locking)** | On-Demand (`PAY_PER_REQUEST`, state locks only) | $0.00 |
| **Total Base Cost** | **Shared Cluster Foundation** | **~$50–$65 / month** |

### Per-Tenant Cost (Variable)
| Resource | Allocation | Est. Monthly Cost |
| :--- | :--- | :--- |
| **Fargate Task** | 0.5 vCPU / 1.0 GB RAM (24/7 runtime) | ~$3.50–$4.50 / month |
| **Secrets Manager** | 1 Encryption Key secret | ~$0.40 / month |
| **Total Per Active Tenant** | | **~$4.00–$5.00 / month** |

> 💡 **Fleet Economics**: 20 fully isolated, dedicated enterprise n8n tenants cost approximately **~$130–$150/month total** on AWS, compared to **$1,000+/month** on managed SaaS platforms.

---

## ⚖️ Why TryBase Instead of Kubernetes (EKS)?

A common question from cloud architects is: *"Why not deploy this on Kubernetes (EKS) with Helm?"*

While Kubernetes is powerful for microservice meshes, running multi-tenant isolated workloads like n8n on Kubernetes introduces substantial cost, complexity, and security trade-offs:

| Dimension | Kubernetes (AWS EKS) | TryBase (AWS ECS Fargate) |
| :--- | :--- | :--- |
| **Minimum Base Cost** | **~$150–$250 / month** ($73/mo EKS cluster fee + redundant EC2 worker nodes) | **~$50 / month** (ALB + Graviton RDS; Fargate has zero cluster fee) |
| **Maintenance Overhead** | **High** (Mandatory yearly k8s version upgrades, deprecated APIs, node patching, CNI upgrades, Helm charts) | **Zero** (Serverless AWS managed runtime; no nodes, no OS, no cluster to patch) |
| **Container Isolation** | **Shared Linux Kernel** (Pods share nodes; vulnerable to noisy neighbors and kernel exploits) | **Firecracker MicroVM** (Every tenant task runs in a dedicated hardware hypervisor) |
| **DevOps Footprint** | **Requires Dedicated SRE** (Ingress-NGINX, Cert-Manager, Karpenter, Pod Disruption Budgets) | **Developer-Friendly** (2 CLI commands: `make control-plane` and `make infra`) |
| **Database Multi-Tenancy** | **Unsolved** (Requires custom operators or 20 separate unmanaged Postgres pods) | **Built-in** (Automated Postgres schema engine + AWS Secrets Manager) |

### Key Architectural Rationale

1. **Zero "Cluster Tax"**: In AWS, just keeping an EKS control plane alive costs **$73.00/month** before deploying a single pod. Add two worker nodes for high availability, and your minimum baseline is ~$150+/month even with zero users. TryBase uses **ECS Fargate**, which has **$0.00 cluster fees**—you only pay for active container seconds.
2. **True Hardware Isolation (MicroVMs)**: In standard Kubernetes, pods share the worker node's host kernel. If Tenant A runs a runaway workflow or encounters a memory leak, it can starve or crash the node, impacting Tenant B. With AWS Fargate, each tenant container runs inside its own **AWS Firecracker MicroVM** with hardware-level boundary isolation.
3. **No Kubernetes Upgrade Treadmill**: Kubernetes forces major version upgrades every ~12 months, which routinely break Ingress resources, CRDs, and CNI plugins. TryBase relies entirely on managed serverless building blocks (Fargate, Step Functions, RDS), meaning zero node management, zero AMI patching, and zero operational toil.
4. **The Database Problem**: Kubernetes only orchestrates containers—it does not solve data isolation. TryBase provides the automated database schema provisioning pipeline (`CREATE SCHEMA tenant_slug`) on a single high-performance Graviton RDS instance, achieving strict isolation at 90% lower cost.

---

## 🚀 Quickstart Guide

### Prerequisites
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) installed and configured (`aws configure`).
- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.8.0.
- [Docker](https://www.docker.com/) running locally (for initial Lambda image push).
- A domain with a **Wildcard SSL Certificate** in AWS Certificate Manager (e.g. `*.n8n.yourdomain.com`).

## ⚡ Deploy in 2 Commands

TryBase is engineered for maximum developer velocity. Bootstrapping the entire multi-tenant platform (Supabase Control Plane + AWS Fleet Infrastructure) takes just **2 CLI commands**:

```bash
git clone https://github.com/your-username/trybase.git
cd trybase
```

### 1️⃣ Command 1: Deploy the Control Plane (Supabase)
```bash
./deploy-control-plane.sh
# or: make control-plane
```
**What this does automatically:**
- Links to your Supabase project (prompts for your Project Ref if needed).
- Pushes database migrations (creates `workspaces` table with Row-Level Security).
- Deploys the 3 Edge Functions (`on-provision-success`, `verify-checkout`, `create-portal-session`).
- Automatically updates `terraform/terraform.tfvars` with your Supabase URL and settings.

---

### 2️⃣ Command 2: Deploy the Fleet Infrastructure (AWS)
```bash
./deploy-infra.sh
# or: make infra
```
**What this does automatically:**
- Verifies your AWS credentials and Terraform installation.
- Initializes Terraform and provisions the shared VPC, private subnets, Graviton RDS PostgreSQL database, Application Load Balancer, Step Functions state machine, and CodeBuild executors.
- Outputs the **ALB DNS Name** and **API Gateway Provisioning Endpoint**.

---

### 3️⃣ Point Your Wildcard Domain (Final Step)
Once `./deploy-infra.sh` finishes, it outputs `alb_dns_name`:
```text
alb_dns_name = "n8n-hosting-shared-alb-123456789.eu-west-2.elb.amazonaws.com"
```
In your DNS provider (Hostinger, Cloudflare, GoDaddy, Namecheap):
Add a single **Wildcard CNAME**:
| Record Type | Host / Name | Target / Points To |
| :--- | :--- | :--- |
| **CNAME** | `*.n8n` *(or `*` if using apex)* | `<alb_dns_name>` |

---

### 4️⃣ Launch the Web Dashboard (UI)
```bash
make web
```
Spins up the integrated React/Vite dashboard locally with interactive provisioning, real-time terminal logs, and multi-engine selection (n8n Automation & Dify AI Studio).

🎉 **That's it!** Your entire platform is live. You can immediately provision tenants via the UI, API, or GitOps.

---

## 👥 Provisioning Tenants

You can provision tenants in two ways: **Automated via API** or **Declarative via GitOps**.

### Option A: Automated via API (Recommended for Platforms & Dashboards)
Send an authenticated `POST` request to your API Gateway endpoint:

```bash
curl -X POST "https://<API_GATEWAY_URL>/provision" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "acme-corp",
    "subdomain": "acme",
    "rule_priority": 100
  }'
```

**What happens behind the scenes:**
1. API Gateway validates the JWT with the ES256 Lambda Authorizer.
2. Step Functions triggers the `n8n-tenant-create-schema` Lambda to create Postgres schema `acme_corp`.
3. CodeBuild pulls the Terraform source archive from S3, generates `tenant_acme-corp.tf`, and runs `terraform apply -target=module.acme_corp`.
4. The ALB automatically begins routing `https://acme.n8n.yourdomain.com` to the new Fargate container.

---

### Option B: Declarative via GitOps
If you prefer managing tenants statically in Git without the API:

1. Copy the tenant example file:
   ```bash
   cp tenant_example.tf.example tenant_acme.tf
   ```
2. Edit `tenant_acme.tf` with your tenant slug and unique ALB priority:
   ```hcl
   module "acme" {
     source    = "./modules/tenant"
     tenant_id = "acme"
     subdomain = "acme"
     db_schema = "acme"
     
     alb_listener_rule_priority = 100
     # (Shared variables mapped from shared infrastructure)
   }
   ```
3. Apply the tenant:
   ```bash
   terraform apply -target=module.acme
   ```

---

## 📦 Run Any Containerized AI Agent or Workload

TryBase is **100% container-agnostic**. While we provide pre-configured templates for common engines like Dify and n8n, the core superpower is the **Generic Container Module** (`modules/generic-workload`):

> **Bring any Docker container** — your custom Python CrewAI agent, AutoGen bot, LangChain pipeline, FastAPI microservice, or open-source tool — and TryBase gives it dedicated microVM compute, dynamic wildcard SSL subdomains, keyless Bedrock IAM, and native vector memory in seconds.

### Example: Deploying a Custom Python AI Agent (Keyless Bedrock + pgvector)

```hcl
module "finance_agent" {
  source = "./modules/generic-workload"

  service_name      = "finance-agent"
  subdomain         = "finance-bot"
  container_image   = "ghcr.io/my-org/crewai-finance-agent:v1.0"
  container_port    = 8000
  health_check_path = "/health"

  # Attach dedicated per-tenant IAM Task Role with keyless Bedrock access
  enable_bedrock    = true

  environment_variables = {
    AWS_DEFAULT_REGION = "eu-west-2"
    DATABASE_URL       = "postgresql://user:pass@${aws_db_instance.rds.endpoint}/postgres?sslmode=require"
    AGENT_ENV          = "production"
    # ZERO API KEYS NEEDED! Boto3 automatically retrieves 60m STS tokens from link-local Fargate metadata
  }

  # Bind to TryBase shared infrastructure
  vpc_id                     = module.vpc.vpc_id
  private_subnet_ids         = module.vpc.private_subnets
  ecs_cluster_name           = aws_ecs_cluster.main.name
  alb_listener_arn           = aws_lb_listener.https.arn
  alb_security_group_id      = aws_security_group.alb.id
  alb_listener_rule_priority = 150
  domain_name                = var.base_domain
}
```

### 🛡️ How to Write a Keyless Bedrock Agent Container

Unlike traditional hosting platforms that require storing raw `OPENAI_API_KEY` or `AWS_SECRET_ACCESS_KEY` in environment variables (which get stolen during supply chain compromises or container breaches), TryBase containers authenticate **keylessly**:

```python
# agent.py - Zero hardcoded API keys
import json, boto3
from fastapi import FastAPI

app = FastAPI(title="Bedrock Financial Agent")

# ZERO CREDENTIALS PASSED:
# Boto3 queries the ECS link-local metadata agent (http://169.254.170.2).
# AWS STS vends a 60-minute ephemeral session token and silently rotates it in memory.
bedrock = boto3.client("bedrock-runtime", region_name="eu-west-2")

@app.post("/chat")
def chat(prompt: str):
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": prompt}]
    })
    
    # Invokes Claude 3.5 Sonnet under this tenant's dedicated IAM Task Role
    response = bedrock.invoke_model(
        modelId="anthropic.claude-3-5-sonnet-20240620-v1:0",
        body=body
    )
    result = json.loads(response["body"].read())
    return {"reply": result["content"][0]["text"]}
```

### Architecture Comparison: Status Quo vs. TryBase

| Architectural Vector | Fragile Status Quo (PaaS / DIY) | The TryBase Hyperscaler Standard |
| :--- | :--- | :--- |
| **API Credentials** | Permanent keys (`AKIA...` / `sk-...`) in `.env` files or databases. | **Zero secrets stored.** In-memory STS tokens auto-rotated every 60 min. |
| **Supply Chain Exposure** | Malicious packages dump environment variables to external servers. | **No static keys exist** in the environment to steal. |
| **Multi-Tenant Blast Radius** | Shared API keys. One compromised container drains everyone's quotas. | **Per-tenant IAM Task Roles.** Tenant A physically cannot call Tenant B's models. |
| **Network Attack Surface** | Containers assigned public IPv4 addresses reachable by botnets. | **100% Private VPC (0 Public IPs).** ALB terminates TLS; tasks sit in private subnets. |

**Instant Results:**
- 🛡️ **Private MicroVM**: Runs in its own AWS Firecracker MicroVM on Fargate — no shared memory, no host kernel leaks.
- 🌐 **Instant HTTPS Subdomain**: Live immediately at `https://finance-bot.<yourdomain.com>` with automatic ACM wildcard TLS.
- 🧠 **Native Vector Memory**: Connected directly to Graviton RDS with native `pgvector` enabled for semantic search and RAG.

### Pre-Configured Workload Templates
TryBase includes battle-tested starter configurations:
- **Custom Containers** (`modules/generic-workload`): Any Docker image from Docker Hub, ECR, or GitHub Packages with keyless Bedrock IAM.
- **Dify AI Studio Adapter** (`terraform/tenant_dify.tf.example`): Visual agent studio with dedicated database & `pgvector` RAG.
- **n8n Workflow Automation** (`modules/tenant`): Schema-isolated workflow automation engine with AES-256 encrypted credential vaults.

---

## 🛠️ Repository Structure

```text
trybase/
├── terraform/
│   ├── main.tf                    # Provider configuration & data sources
│   ├── variables.tf               # Configurable parameters & defaults
│   ├── terraform.tfvars.example   # Example configuration template
│   ├── outputs.tf                 # ALB DNS, API Gateway URL, Step Function ARNs
│   ├── vpc.tf                     # 3-tier VPC with public/private subnets
│   ├── alb.tf                     # Application Load Balancer & HTTPS redirect
│   ├── rds.tf                     # Shared Graviton RDS PostgreSQL instance
│   ├── ecs.tf                     # ECS Cluster definition
│   ├── apigateway.tf              # HTTP v2 API & CORS configuration
│   ├── authorizer.tf              # ES256 Supabase JWT Lambda Authorizer
│   ├── stepfunctions.tf           # Orchestration state machine
│   ├── codebuild.tf               # Terraform executor for dynamic tenant provisioning
│   ├── bastion.tf                 # Secure jump host for private database administration
│   ├── tenant_example.tf.example  # Declarative GitOps tenant template
│   └── modules/
│       └── tenant/                # Reusable tenant module (Fargate task, target group, rules)
├── lambda/
│   ├── authorizer/                # Lightweight Node.js ES256 JWT verifier
│   └── create-schema/             # Python RDS schema provisioning container
├── sync-tenants.sh                # Synchronizes dynamic tenant configs from S3 to local Git
├── cleanup-enis.sh                # Helper script to clean up orphaned Lambda ENIs
├── BOOTSTRAP.md                   # Operational guide & bootstrap gotchas
├── ARCHITECTURE.md                # Comprehensive technical specification
└── LICENSE                        # Apache 2.0 License
```

---

## 🤝 Operational Workflows

### Keeping Local State in Sync with Cloud Tenants
When tenants are provisioned via API, CodeBuild saves their configuration files in the S3 state bucket. Before running local Terraform commands, always sync your local directory:
```bash
./sync-tenants.sh
```

### Accessing the Database via Bastion
To inspect tenant schemas or debug workflows:
```bash
# 1. Retrieve master credentials
aws secretsmanager get-secret-value --secret-id $(terraform -chdir=terraform output -raw db_credentials_secret_arn) --query SecretString --output text

# 2. Connect through the Bastion jump host
ssh -i ~/.ssh/your-key.pem ec2-user@<BASTION_IP>

# 3. Inside the bastion, connect to PostgreSQL
PGPASSWORD='<PASSWORD>' PGSSLMODE=require psql -h <DB_HOSTNAME> -U n8nmaster -d postgres
```

### Forecasting Cloud Costs with Infracost
TryBase integrates with [Infracost](https://www.infracost.io/) (Apache 2.0) to forecast monthly AWS and multi-cloud fleet expenses before applying changes:
```bash
make cost
```

---

## 🗺️ Roadmap: The Universal Container Platform

TryBase is building the ultimate open-source platform for multi-tenant container fleets and AI workloads:

### 1. Workload Orchestration
- [x] **Universal Container Module** (`modules/generic-workload`): Deploy any arbitrary Docker container (custom Python AI agents, CrewAI, AutoGen, microservices) with private Fargate microVM isolation and ALB host routing.
- [x] **Multi-Database & `pgvector` Provisioning**: RDS Lambda dual-mode orchestrator supporting *Schema-per-tenant* (`CREATE SCHEMA`) and *Database-per-tenant* (`CREATE DATABASE`) with native `vector` extension setup.
- [x] **Integrated Web Monorepo (`web/` & `make web`)**: Vite/React dashboard with workload selection, real-time Step Function terminal logs, and customer self-service.
- [x] **Production Starter Adapters**:
  - **n8n Workflow Engine**: Hardened with Postgres schema scoping, unique encryption keys, and Resend SMTP.
  - **Dify AI Studio**: Enterprise multi-agent platform with dedicated database and native `pgvector` RAG (`terraform/tenant_dify.tf.example`).
- [ ] **Langflow Adapter**: Visual agent workflow runner.
- [ ] **Custom Container Image Registry**: Direct pull integration with private ECR and Docker Hub secrets.

### 2. Platform & FinOps Capabilities
- [x] **Infracost Integration (`make cost`)**: Forecast exact monthly infrastructure and tenant costs via open-source Infracost.
- [ ] **Container Auto-Idling (Scale-to-Zero)**: Automatically scale down inactive tenant Fargate tasks to 0 and wake on incoming HTTP webhooks (slashing compute bills by up to 80%).
- [ ] **Custom Domain Management**: Allow tenants to bring their own apex domains via CNAME with automated ACM SSL issuance.
- [ ] **Multi-Cloud Adapters**: Google Cloud (Cloud Run + Cloud SQL) and Azure (Container Apps).

---

## 📄 License & Disclaimer

### License
This project is licensed under the **Apache License 2.0** - see the [LICENSE](LICENSE) file for details.

### Disclaimer & n8n Fair-Code Notice
- **TryBase** is an independent, community-driven open-source project and is not affiliated with, endorsed by, or sponsored by n8n GmbH.
- `n8n` is a registered trademark of n8n GmbH.
- n8n software is distributed under its Fair-Code [Sustainable Use License](https://n8n.io/legal/sustainable-use-license). While this repository provides infrastructure code for self-hosting n8n instances, anyone intending to offer n8n as a commercial SaaS service to third parties should consult n8n GmbH regarding their commercial licensing terms.
