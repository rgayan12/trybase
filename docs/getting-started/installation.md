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

## 2. Automated Environment Check

TryBase provides an automated pre-flight validation target in the Makefile:

```bash
make check-env
```

Expected output:

```text
Checking workstation dependencies...
[OK] terraform found: Terraform v1.8.2
[OK] aws cli found: aws-cli/2.15.30 Python/3.11.8 Darwin/23.4.0
[OK] docker found: Docker version 26.0.0, build 2ae903e
[OK] infracost found: Infracost v0.10.35
[OK] node found: v20.12.2
[OK] jq found: jq-1.7.1
All dependencies satisfied. Ready to deploy TryBase.
```

If any dependency is missing, install it via Homebrew on macOS:

```bash
brew install terraform awscli docker infracost node jq
```

---

## 3. AWS Account Permissions

TryBase provisions core AWS infrastructure and requires an IAM identity with permissions for:
* **Amazon VPC**: VPCs, subnets, route tables, internet gateways, NAT gateways, security groups.
* **Amazon ECS**: ECS clusters, task definitions, Fargate services.
* **Amazon RDS**: DB instances, subnet groups, parameter groups.
* **Elastic Load Balancing**: Application Load Balancers, target groups, HTTPS listener rules.
* **AWS Certificate Manager (ACM)**: Wildcard SSL/TLS certificates.
* **AWS IAM**: Roles, policies, STS assume role permissions.
* **AWS Step Functions**: State machines, executions.
* **Amazon API Gateway**: REST APIs, integrations, deployments.

Authenticate your AWS CLI session:

```bash
aws configure
```

Verify your active identity and account ID:

```bash
aws sts get-caller-identity
```

---

[Next: Environment Configuration →](./configuration.md)
