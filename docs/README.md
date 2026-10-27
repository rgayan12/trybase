# TryBase Documentation

<p align="center">
  <img src="./assets/logo.png" alt="TryBase Logo" width="100" />
</p>

<p align="center">
  <strong>The Open-Source Cloud Infrastructure Engine for Autonomous AI Agents & Automations</strong>
</p>

<p align="center">
  <a href="./getting-started.md">Getting Started</a> •
  <a href="./architecture.md">Architecture</a> •
  <a href="./security.md">Security Standard</a> •
  <a href="./workload-adapters.md">Workload Adapters</a> •
  <a href="./finops.md">FinOps & Costs</a> •
  <a href="./api-reference.md">API Reference</a>
</p>

---

## Introduction

TryBase is an open-source cloud infrastructure engine purpose-built for deploying, isolating, and scaling autonomous AI agent workloads on AWS. 

Instead of deploying AI agents to fragile single-container platforms with static API keys in `.env` files, TryBase provisions a dedicated **AWS Fargate Graviton MicroVM**, an isolated **IAM Task Role**, a scoped **PostgreSQL pgvector schema**, and an optional **in-task Redis sidecar** for every tenant or agent workload.

### Why TryBase?

* **Zero Static Secrets**: MicroVMs obtain short-lived cryptographic credentials via the link-local STS metadata agent (`169.254.170.2`). Even with a shell escape, no permanent keys exist to steal.
* **Unix Domain Sockets (`SO_PEERCRED`)**: Local sidecar daemons communicate over kernel-authenticated Unix sockets rather than listening on localhost TCP ports.
* **100% Private VPC Fleet**: Workload containers have zero public IP addresses (`0 Public IPs`). Ingress is routed through an Application Load Balancer with wildcard TLS.
* **Zero-Cost Redis Sidecars**: Workloads requiring cache (e.g. Celery queues, session buffers) run a local Redis container inside the task's shared network namespace at `127.0.0.1:6379`.
* **FinOps Governance**: Every resource change is audited before deployment with Infracost.

---

## Documentation Index

### 1. [Getting Started](./getting-started.md)
* [System Prerequisites](./getting-started.md#prerequisites)
* [Environment Configuration](./getting-started.md#environment-configuration)
* [Pre-Deploy FinOps Audit (`make cost`)](./getting-started.md#pre-deploy-finops-audit)
* [One-Command Infrastructure Deployment](./getting-started.md#deploying-the-fleet)
* [Control Plane Setup & Console](./getting-started.md#launching-the-web-console)

### 2. [Architecture Topology](./architecture.md)
* [High-Level Topology](./architecture.md#high-level-topology)
* [Private VPC & Subnet Design](./architecture.md#vpc--network-boundaries)
* [AWS Fargate Graviton ARM64 Hypervisor](./architecture.md#fargate-graviton-microvms)
* [Application Load Balancer & Wildcard TLS Routing](./architecture.md#traffic-ingress--routing)
* [RDS PostgreSQL 16.3 & Native pgvector](./architecture.md#vector-memory-subsystem)
* [Link-Local In-Task Redis Sidecar](./architecture.md#in-task-redis-sidecar)

### 3. [Security & Zero-Trust IAM](./security.md)
* [The Anti-Leak Standard (Lessons from Railway Breach)](./security.md#the-anti-leak-standard)
* [Keyless STS Authentication Loop (`169.254.170.2`)](./security.md#keyless-sts-authentication)
* [Unix Domain Sockets with Linux `SO_PEERCRED`](./security.md#unix-domain-sockets-with-so_peercred)
* [Passwordless RDS IAM Authentication](./security.md#passwordless-rds-iam-authentication)
* [Per-Tenant IAM Task Role Isolation](./security.md#per-tenant-iam-isolation)

### 4. [Workload Adapters Specification](./workload-adapters.md)
* [The Workload Adapter Contract](./workload-adapters.md#the-workload-adapter-contract)
* [Writing Custom Agent Workloads (Python / FastAPI / TypeScript)](./workload-adapters.md#custom-agent-workloads)
* [Deploying Visual Studios (n8n & Dify)](./workload-adapters.md#orchestration-adapters)
* [Step-by-Step Adapter Contribution Guide](./workload-adapters.md#contributing-an-adapter)

### 5. [FinOps & Cost Governance](./finops.md)
* [Infracost Pre-Deploy Auditing](./finops.md#infracost-audits)
* [Resource Breakdown & Baseline Run-Rate](./finops.md#baseline-run-rate)
* [Scale-to-Zero Architecture](./finops.md#scale-to-zero)

### 6. [API Reference & Orchestration](./api-reference.md)
* [Provisioning Endpoint (`POST /provision`)](./api-reference.md#provisioning-api)
* [AWS Step Functions State Machine](./api-reference.md#step-functions-orchestrator)
* [Supabase Realtime Database Schema](./api-reference.md#database-schema)
* [Makefile Command Reference](./api-reference.md#makefile-cheatsheet)

---

## Community & Contribution

TryBase is licensed under the [Apache 2.0 License](../LICENSE). We welcome community contributions, adapter submissions, and security audits.

* **GitHub Repository**: [github.com/rgayan12/trybase](https://github.com/rgayan12/trybase)
* **Contribution Guide**: [CONTRIBUTING.md](../CONTRIBUTING.md)
* **Roadmap**: [ROADMAP.md](../ROADMAP.md)
