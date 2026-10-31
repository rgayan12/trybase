# Environment Configuration

> [!TIP]
> TryBase separates infrastructure variables (`terraform/terraform.tfvars`) from web console secrets (`web/.env.local`). Maintain these configurations in separate version-controlled environments.

---

## 1. Terraform Variables Configuration

Navigate to the `terraform/` directory and create your personal variable configuration:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` to define your target AWS region, base domain, and wildcard SSL certificate ARN:

```hcl
# AWS Region & Project Info
aws_region   = "eu-west-2"
project_name = "trybase"
environment  = "prod"

# Domain & Wildcard SSL (ACM) Configuration
# Each tenant receives an isolated subdomain: https://<tenant-slug>.<base_domain>
base_domain         = "apps.yourdomain.com"
acm_certificate_arn = "arn:aws:acm:eu-west-2:123456789012:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Terraform Remote State S3 Bucket (created during 'make bootstrap')
state_bucket_name = "your-terraform-state-bucket"

# Supabase Control Plane Integration (auto-populated by 'make control-plane')
supabase_url   = "https://<your-project-ref>.supabase.co"

# API Gateway CORS (Frontend URLs that can call /provision)
cors_allowed_origins = [
  "http://localhost:5173",
  "https://app.yourdomain.com"
]

# Bastion Jump Box (Optional - set to true only if you need an SSH jump host for PostgreSQL RDS)
enable_bastion       = false
bastion_key_name     = ""
bastion_allowed_cidr = "0.0.0.0/0"
```

---

## 2. Generating an AWS ACM Wildcard SSL Certificate

TryBase provisions virtual single-tenant workloads with dedicated HTTPS subdomains (e.g., `acme.apps.yourdomain.com` or `agent-1.trybase.io`). The shared AWS Application Load Balancer terminates TLS on port 443 and requires an **AWS Certificate Manager (ACM) Wildcard Certificate**.

> [!IMPORTANT]
> The ACM certificate **must be created in the same AWS region** as your infrastructure (e.g. `eu-west-2` London or `us-east-1` N. Virginia). ACM certificates are free and renew automatically.

You can request and validate your wildcard certificate using either the **AWS CLI** (recommended) or the **AWS Management Console**.

---

### Option A: Generate via AWS CLI (Fastest — 60 Seconds)

#### Step 1: Request the Wildcard Certificate
Run `aws acm request-certificate` in your target region. Include both the wildcard `*.<domain>` and the base `<domain>`:

```bash
aws acm request-certificate \
  --domain-name "*.apps.yourdomain.com" \
  --subject-alternative-names "apps.yourdomain.com" \
  --validation-method DNS \
  --region eu-west-2
```

**Output:**
```json
{
    "CertificateArn": "arn:aws:acm:eu-west-2:123456789012:certificate/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

Copy the `CertificateArn`. You will paste this into `terraform.tfvars`.

#### Step 2: Retrieve the DNS Validation CNAME Record
AWS ACM uses a DNS CNAME record to verify domain ownership. Fetch the required record:

```bash
aws acm describe-certificate \
  --certificate-arn "arn:aws:acm:eu-west-2:123456789012:certificate/a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  --region eu-west-2 \
  --query "Certificate.DomainValidationOptions[0].ResourceRecord"
```

**Output:**
```json
{
    "Name": "_a79865eb4cd1a6ab990a45779b4e0b96.apps.yourdomain.com.",
    "Type": "CNAME",
    "Value": "_x2.acm-validations.aws."
}
```

#### Step 3: Add the CNAME to Your DNS Provider
Add this CNAME record into your DNS provider (Cloudflare, Route 53, GoDaddy, Namecheap, Hostinger):

| Record Type | Host / Name | Value / Points To | TTL | Proxy Status |
| :--- | :--- | :--- | :--- | :--- |
| **CNAME** | `_a79865eb4cd1a6ab990a45779b4e0b96.apps` | `_x2.acm-validations.aws.` | Auto | **DNS Only** (Gray Cloud) |

*(Note: In Cloudflare, make sure the proxy status is set to **DNS only**, not proxied).*

#### Step 4: Verify Validation Status
Once added, AWS will validate the domain within 1 to 3 minutes. Check the status:

```bash
aws acm describe-certificate \
  --certificate-arn "arn:aws:acm:eu-west-2:123456789012:certificate/a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  --region eu-west-2 \
  --query "Certificate.Status" --output text
```

When it outputs `ISSUED`, your certificate is live and ready for traffic!

---

### Option B: Generate via AWS Management Console

1. Navigate to the **AWS Certificate Manager (ACM)** console: [console.aws.amazon.com/acm](https://console.aws.amazon.com/acm).
2. Ensure your top-right region selector matches your target region (e.g. `Europe (London) eu-west-2`).
3. Click **Request a certificate** → select **Request a public certificate** → click **Next**.
4. In **Domain names**:
   - **Fully qualified domain name**: `*.apps.yourdomain.com` (or `*.yourdomain.com`)
   - Click **Add another name to this certificate**: `apps.yourdomain.com` (or `yourdomain.com`)
5. In **Validation method**: Select **DNS validation (recommended)**.
6. In **Key algorithm**: Select **RSA 2048**.
7. Click **Request**.
8. Click on your newly created certificate in the list, scroll down to the **Domains** table:
   - If using **AWS Route 53**: Click the 1-click **Create records in Route 53** button.
   - If using **external DNS (Cloudflare, Namecheap, GoDaddy)**: Copy the **CNAME name** and **CNAME value** into your DNS dashboard.
9. Wait 1–3 minutes until the Certificate status turns green (**Issued**).
10. Copy the **ARN** displayed at the top of the details panel.

---

### ACM Configuration Examples in `terraform.tfvars`

#### Example 1: Dedicated Subdomain Namespace (e.g., `*.apps.yourdomain.com`)
Best for adding TryBase to an existing corporate website or platform:

```hcl
base_domain         = "apps.yourdomain.com"
acm_certificate_arn = "arn:aws:acm:eu-west-2:123456789012:certificate/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```
*Tenant endpoints: `https://acme.apps.yourdomain.com`, `https://tenant2.apps.yourdomain.com`*

#### Example 2: Apex / Root Domain (e.g., `*.trybase.io` or `*.yourdomain.com`)
Best for dedicated SaaS or staging environments:

```hcl
base_domain         = "trybase.io"
acm_certificate_arn = "arn:aws:acm:eu-west-2:123456789012:certificate/f9e8d7c6-b5a4-3210-9876-543210fedcba"
```
*Tenant endpoints: `https://acme.trybase.io`, `https://analytics.trybase.io`*

---

## 3. Web Console & Control Plane Setup

The TryBase Web Console connects directly to Supabase and the AWS Step Functions API Gateway endpoint.

Navigate to `web/` and configure `.env.local`:

```bash
cd web
cp .env.example .env.local
```

Populate the required credentials:

```bash
# Supabase Backend (from Project Settings → API in Supabase)
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_... (or your anon public key)

# AWS API Gateway Provisioning Endpoint (from 'terraform output api_gateway_url' or make infra)
VITE_API_GATEWAY_URL=https://pweai7qxlh.execute-api.eu-west-2.amazonaws.com/provision
```

> [!NOTE]
> In the open-source version, billing and Stripe variables are completely optional. Any authenticated administrator can provision unlimited workloads on your private AWS fleet.

---

## 4. Declarative IaaS Configuration (`trybase.fleet.yml`)

TryBase treats workload provisioning as declarative **Infrastructure-as-a-Service (IaaS)**. Instead of manually clicking through cloud dashboards or configuring disparate provisioning APIs, teams define their desired multi-workload infrastructure in a version-controlled YAML manifest (`trybase.fleet.yml`).

### The IaaS Concept in TryBase

When users, client applications, or AI agents request infrastructure, they submit this manifest declaring:
- **Organization Namespace**: Groups related workloads under a common enterprise domain and database cluster (e.g. `organization: acme-corp`).
- **Workload Archetypes**: Pre-configured runtime environments including `n8n` (workflow automation), `dify` (AI studio/RAG), `openclaw` (autonomous Bedrock agent runner), `openmuse` (agent computer/browser sandbox), `laravel`, `django`, or `custom` Docker images.
- **Compute Sizing**: Explicit CPU (`256`, `512`, `1024`, `2048`) and RAM (`512`, `1024`, `2048`, `4096` MiB) allocations per MicroVM.
- **ALB Ingress & Subdomains**: Dedicated HTTPS subdomains routed automatically through your wildcard ACM certificate.
- **Anti-Leak Secrets**: Environment variables encrypted directly into AWS Secrets Manager and served over Unix Domain Sockets (`/var/run/trybase/secrets.sock`), preventing plaintext `.env` leakage.

### Example Manifest (`trybase.fleet.yml`)

```yaml
organization: acme-corp
version: "1.0"

workloads:
  # 1. Workflow Automation Engine
  - name: workflow
    archetype: n8n
    subdomain: workflow.acme.apps.yourdomain.com
    cpu: 1024
    memory: 2048
    secrets:
      N8N_BASIC_AUTH_ACTIVE: "true"

  # 2. Knowledge & AI Studio
  - name: knowledge
    archetype: dify
    subdomain: dify.acme.apps.yourdomain.com
    cpu: 1024
    memory: 2048
    secrets:
      MODE: "api"
      VECTOR_STORE: "pgvector"

  # 3. Autonomous Execution Runner
  - name: runner
    archetype: openclaw
    subdomain: agent.acme.apps.yourdomain.com
    cpu: 1024
    memory: 2048
    secrets:
      WORKSPACE_DIR: "/workspace"
      ENABLE_ANTI_LEAK: "true"
```

### How Users & Teams Request IaaS

Users can request infrastructure provisioning using three primary methods:

1. **TryBase CLI** (Recommended for developers & GitOps CI/CD):
   ```bash
   # Validate manifest syntax and resource allocations
   trybase fleet deploy trybase.fleet.yml --dry-run

   # Deploy the entire interconnected IaaS topology
   trybase fleet deploy trybase.fleet.yml
   ```

2. **AI Assistants via MCP Server** (Claude Desktop, Cursor, Windsurf):
   Because `@trybase/mcp` exposes the `trybase_deploy_fleet` tool, you can simply ask your AI assistant:
   > *"Deploy our fleet infrastructure using trybase.fleet.yml and verify container health."*

3. **HTTP REST API** (For SaaS control planes or automated tenant onboarding):
   ```bash
   curl -X POST "https://<API_GATEWAY_URL>/provision/fleet" \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -H "Content-Type: application/json" \
     --data-binary @trybase.fleet.json
   ```

> [!TIP]
> For the complete schema specification, CPU/RAM sizing matrices, and advanced options, refer to the [Declarative Fleet Manifest Reference](../control-plane/fleet-manifest.md).

---

[Next: Pre-Deploy FinOps Audit →](./finops-audit.md)

