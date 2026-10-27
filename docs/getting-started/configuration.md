# Environment Configuration

> [!TIP]
> TryBase separates infrastructure variables (`terraform.tfvars`) from web console secrets (`.env.local`). Maintain these configurations in separate version-controlled environments.

---

## 1. Terraform Variable Setup

Navigate to the `terraform/` directory and create your personal variable configuration:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
# AWS Region & Environment
aws_region       = "eu-west-2"
environment      = "production"

# Root Domain & DNS Ingress
root_domain      = "trybase.yourdomain.com"
route53_zone_id  = "Z0123456789ABCDEF"

# Database Configuration (Graviton ARM64)
rds_master_user   = "postgres"
db_instance_class = "db.t4g.micro"
allocated_storage = 20

# VPC Network CIDR
vpc_cidr = "10.0.0.0/16"
```

### Key Configuration Variables Explained

| Variable | Default | Description |
| :--- | :--- | :--- |
| `aws_region` | `eu-west-2` | Target AWS region (must support Bedrock & Fargate Graviton) |
| `root_domain` | Required | Fully qualified root domain for wildcard SSL (e.g. `trybase.io`) |
| `route53_zone_id` | Required | Route 53 Public Hosted Zone ID for DNS validation |
| `db_instance_class`| `db.t4g.micro` | Graviton database sizing (`db.t4g.micro`, `db.t4g.small`, `db.r6g.large`) |
| `vpc_cidr` | `10.0.0.0/16` | Private CIDR block allocated for the TryBase VPC |

---

## 2. Web Console & Control Plane Setup

The TryBase Web Console connects directly to Supabase and the AWS Step Functions API Gateway endpoint.

Navigate to `web/` and configure `.env.local`:

```bash
cd web
cp .env.example .env.local
```

Populate the required credentials:

```bash
# Supabase Backend
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AWS API Gateway Provisioning Endpoint
VITE_API_GATEWAY_URL=https://api.trybase.yourdomain.com/v1
```

> [!NOTE]
> In the open-source version, billing and Stripe variables are completely disabled. Any authenticated administrator can provision unlimited workloads on your private AWS fleet.

---

[Next: Pre-Deploy FinOps Audit →](./finops-audit.md)
