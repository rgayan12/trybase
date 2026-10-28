# Summary

[TryBase Documentation](README.md)

### Prologue
* [Architecture Manifesto](prologue/manifesto.md)
* [Virtual Single-Tenancy](prologue/virtual-single-tenancy.md)
* [The Anti-Leak Standard](prologue/anti-leak-standard.md)
* [TryBase vs Traditional PaaS](prologue/comparative-analysis.md)

### Getting Started
* [Installation & Prerequisites](getting-started/installation.md)
* [Environment Configuration](getting-started/configuration.md)
* [Pre-Deploy FinOps Audit](getting-started/finops-audit.md)
* [Fleet Deployment](getting-started/deployment.md)
* [Quickstart: Deploy First Workload](getting-started/quickstart.md)

### Core Architecture
* [Hyperscaler Topology](architecture/topology.md)
* [Private VPC & Network Boundaries](architecture/networking.md)
* [Fargate Graviton MicroVMs](architecture/fargate-graviton.md)
* [ALB & Wildcard TLS Ingress](architecture/alb-routing.md)
* [Vector Memory & pgvector Subsystem](architecture/pgvector.md)
* [In-Task Redis Sidecar Pattern](architecture/redis-sidecar.md)

### Security & Zero-Trust
* [Keyless STS Authentication Loop](security/keyless-sts.md)
* [Unix Domain Sockets & SO_PEERCRED](security/unix-sockets.md)
* [Passwordless RDS IAM Authentication](security/rds-iam-auth.md)
* [Scoped Tenant Database Isolation](security/database-isolation.md)
* [Per-Tenant IAM Task Roles](security/iam-task-roles.md)

### Workload Adapters
* [Workload Adapter Specification](adapters/specification.md)
* [Custom Agent: Python & FastAPI](adapters/python-agent.md)
* [Custom Agent: TypeScript & Node](adapters/typescript-agent.md)
* [Adapter: Dify AI Studio](adapters/dify.md)
* [Adapter: n8n Automation](adapters/n8n.md)
* [Authoring a New Workload Adapter](adapters/authoring.md)

### FinOps & Governance
* [Infracost Auditing](finops/infracost.md)
* [Baseline Cloud Run-Rate](finops/run-rate.md)
* [Scale-to-Zero Architecture](finops/scale-to-zero.md)

### Operations & Control Plane
* [Provisioning REST API](control-plane/api.md)
* [AWS Step Functions Orchestrator](control-plane/step-functions.md)
* [Database Schema & Realtime State](control-plane/database.md)
* [Makefile & CLI Cheatsheet](control-plane/cli.md)
