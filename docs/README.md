<p align="center">
  <img src="./assets/banner.png" alt="TryBase Cloud Engine" width="600" />
</p>

<p align="center">
  <strong>The Open-Source Cloud Infrastructure Engine for Autonomous AI Agents & Automations</strong>
</p>

<p align="center">
  <a href="https://github.com/rgayan12/trybase/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License" /></a>
  <a href="https://aws.amazon.com/fargate/"><img src="https://img.shields.io/badge/Compute-AWS%20Fargate%20Graviton-orange.svg" alt="AWS Fargate" /></a>
  <a href="https://github.com/pgvector/pgvector"><img src="https://img.shields.io/badge/Vector%20Memory-pgvector%200.7-green.svg" alt="pgvector" /></a>
  <a href="https://www.infracost.io/"><img src="https://img.shields.io/badge/FinOps-Infracost%20Audited-blueviolet.svg" alt="Infracost" /></a>
</p>

---

## Welcome to TryBase

TryBase is an open-source cloud infrastructure engine purpose-built for deploying, isolating, and scaling multi-tenant AI agents and workflow automations on AWS.

Traditional PaaS platforms deploy containers into shared networks where static API keys (`OPENAI_API_KEY`, `AWS_ACCESS_KEY_ID`, database passwords) reside in plain environment variables. In the event of a container escape, prompt injection RCE, or supply-chain corruption, permanent credentials leak immediately.

TryBase fundamentally re-architects the agent runtime:
* **Dedicated Firecracker MicroVMs**: Every agent workload executes on AWS Fargate Graviton ARM64 in a 100% private VPC subnet with **zero public IP addresses**.
* **Zero Static Secrets**: Containers obtain short-lived cryptographic tokens via the link-local STS metadata agent (`169.254.170.2`). Even with a full shell dump, no static credentials exist.
* **Kernel-Enforced Local IPC**: Local sidecar daemons communicate over Unix Domain Sockets using Linux `SO_PEERCRED` socket credentials, eliminating open localhost TCP ports.
* **Isolated Vector Memory**: Each workload receives an isolated PostgreSQL schema with native 1,536-dimensional HNSW-indexed `pgvector` memory.
* **Zero-Cost Redis Sidecars**: In-task Redis 7 containers share the task's network loopback namespace at `127.0.0.1:6379`, providing 0.05ms cache access without ElastiCache cluster bills.

---

## Documentation Navigation

### [1. Prologue](./prologue/manifesto.md)
* [Architecture Manifesto](./prologue/manifesto.md) — The engineering principles behind TryBase.
* [The Anti-Leak Standard](./prologue/anti-leak-standard.md) — Lessons from the Railway breach & the zero-static-secrets invariant.
* [TryBase vs Traditional PaaS](./prologue/comparative-analysis.md) — Architectural comparison against Heroku, Railway, and ECS defaults.

### [2. Getting Started](./getting-started/installation.md)
* [Installation & Prerequisites](./getting-started/installation.md) — Local tooling requirements (Terraform, AWS CLI, Docker, Infracost).
* [Environment Configuration](./getting-started/configuration.md) — Terraform variables, AWS regions, and domain setup.
* [Pre-Deploy FinOps Audit](./getting-started/finops-audit.md) — Auditing monthly cloud run-rate before provisioning.
* [Fleet Deployment](./getting-started/deployment.md) — Bootstrapping the VPC, ALB, Graviton RDS, and Step Functions engine.
* [Quickstart: Deploy First Workload](./getting-started/quickstart.md) — Deploying an agent container in under 3 minutes.

### [3. Core Architecture](./architecture/topology.md)
* [Hyperscaler Topology](./architecture/topology.md) — Full end-to-end network, compute, and data tier topology.
* [Private VPC & Subnet Design](./architecture/networking.md) — Public ALB subnets, private workload subnets, and NAT egress.
* [Fargate Graviton MicroVMs](./architecture/fargate-graviton.md) — Firecracker hypervisor isolation and ARM64 efficiency.
* [ALB & Wildcard TLS Ingress](./architecture/alb-routing.md) — Automatic host-header routing rules and certificate management.
* [Vector Memory & pgvector Subsystem](./architecture/pgvector.md) — Dedicated schemas, 1536-dim embeddings, and HNSW indexing.
* [In-Task Redis Sidecar Pattern](./architecture/redis-sidecar.md) — Loopback caching with zero cluster overhead.

### [4. Security & Zero-Trust IAM](./security/keyless-sts.md)
* [Keyless STS Authentication Loop](./security/keyless-sts.md) — Link-local metadata agent (`169.254.170.2`) and silent token rotation.
* [Unix Domain Sockets & `SO_PEERCRED`](./security/unix-sockets.md) — Closing localhost TCP ports with kernel-enforced process identity.
* [Passwordless RDS IAM Authentication](./security/rds-iam-auth.md) — Temporary 15-minute database connection tokens.
* [Scoped Tenant Database Isolation](./security/database-isolation.md) — Per-tenant users, restricted search paths, and automated bootstrapping.
* [Per-Tenant IAM Task Roles](./security/iam-task-roles.md) — Cryptographic workload boundaries and CloudTrail audit logs.

### [5. Workload Adapters](./adapters/specification.md)
* [Workload Adapter Specification](./adapters/specification.md) — The 4 contracts: Compute, Ingress, Vector, and Cache.
* [Custom Agent: Python & FastAPI](./adapters/python-agent.md) — Complete keyless implementation using `boto3`.
* [Custom Agent: TypeScript & Node](./adapters/typescript-agent.md) — Complete keyless implementation using `@aws-sdk`.
* [Adapter: Dify AI Studio](./adapters/dify.md) — Packaging Dify with dedicated databases and Redis sidecars.
* [Adapter: n8n Automation](./adapters/n8n.md) — Packaging n8n with PostgreSQL schema isolation.
* [Authoring a New Workload Adapter](./adapters/authoring.md) — Step-by-step contribution guide using the adapter template.

### [6. FinOps & Cloud Governance](./finops/infracost.md)
* [Infracost Auditing](./finops/infracost.md) — Integrating pre-commit and CI/CD cost checks.
* [Baseline Cloud Run-Rate](./finops/run-rate.md) — Standing cluster costs vs per-second task execution pricing.
* [Scale-to-Zero Architecture](./finops/scale-to-zero.md) — Reactive rehydration for intermittent workloads.

### [7. Operations & Control Plane](./control-plane/api.md)
* [Provisioning REST API](./control-plane/api.md) — API Gateway `POST /provision` contract and response format.
* [AWS Step Functions Orchestrator](./control-plane/step-functions.md) — State machine lifecycle, target group attachment, and rollbacks.
* [Database Schema & Realtime State](./control-plane/database.md) — Supabase schema, RLS policies, and realtime broadcast.
* [Makefile & CLI Cheatsheet](./control-plane/cli.md) — Complete CLI reference for all infrastructure lifecycle tasks.

---

## Interactive Console

TryBase includes a clean, calm web console powered by Supabase authentication that connects to your AWS Step Functions control plane. Authenticated administrators can deploy, monitor, and inspect workloads across their fleet without manual CLI commands.

To launch the local web console:

```bash
cd web
npm install
npm run dev
```

Visit `http://localhost:5173` to sign in and manage your private cloud fleet.
