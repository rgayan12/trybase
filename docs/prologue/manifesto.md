# Architecture Manifesto

<p align="center">
  <img src="https://trybase.io/logo.png" alt="TryBase Logo" width="80" />
</p>

> [!NOTE]
> This manifesto establishes the foundational engineering principles of TryBase. Every architectural decision, code contribution, and workload adapter must uphold these core tenets.

---

## 1. The Autonomous Agent Shift

The industry is undergoing a transition from traditional web applications to autonomous AI agent systems. Unlike deterministic CRUD services, autonomous agents exhibit unique runtime characteristics:

* **Unpredictable Execution Paths**: Agents query external tools, spawn subagents, execute code in sandboxes, and run indeterminate loops.
* **Sensitive Tool Access**: Agents hold direct access to internal databases, vector stores, third-party APIs, and cloud infrastructure.
* **Prolonged Execution**: Agent tasks may run for seconds, minutes, or hours, requiring resilient state management and caching.

Deploying autonomous agents onto legacy PaaS hosting or unisolated Kubernetes namespaces introduces catastrophic supply-chain and credential exposure. TryBase was conceived to provide the **hardened infrastructure layer** required for enterprise-grade autonomous agents.

---

## 2. Core Engineering Tenets

### I. Hypervisor Isolation Over Shared Kernels
Multi-tenant container platforms running on standard Docker daemons share a single Linux kernel. Vulnerabilities in kernel subsystems (such as Linux namespace escapes or dirty COW exploits) allow malicious or compromised workloads to inspect sibling processes.

TryBase rejects shared kernel multi-tenancy. Every workload executes inside an **AWS Fargate Firecracker MicroVM**, backed by hardware virtualization with dedicated CPU registers and memory boundaries.

### II. Ephemeral Credentials Over Static Secrets
In traditional DevOps, applications receive static access keys (`AKIA...`), database passwords, and third-party API tokens via `.env` files or container environment variables. When a workload is breached, these keys are exfiltrated and reused indefinitely.

TryBase mandates **Zero Static Secrets**. Containers obtain short-lived cryptographic tokens via the link-local STS metadata agent (`169.254.170.2`). Database connections utilize temporary IAM auth tokens valid for 15 minutes. If a container's memory or environment is dumped, no persistent credentials exist to compromise the platform.

### III. Kernel-Enforced IPC Over Localhost Ports
Background sidecar daemons (such as vector sync daemons, telemetry collectors, and MCP agents) traditionally bind to localhost TCP ports (e.g. `127.0.0.1:9000`). Because network namespaces are shared within a container group, any process can connect to and abuse these internal ports.

TryBase enforces **Unix Domain Sockets with Linux `SO_PEERCRED`**. Daemons do not bind TCP ports. The Linux kernel cryptographically verifies the caller's UID and GID at the socket layer before processing requests.

### IV. Transparent FinOps Over Bill Shock
Unchecked autonomous agent scaling on cloud infrastructure can generate tens of thousands of dollars in surprise cloud bills.

TryBase integrates **Infracost** directly into the deployment pipeline. Every Terraform resource addition or instance resize is audited before deployment. Workloads support automated **Scale-to-Zero**, suspending idle tasks and rehydrating them reactively upon inbound HTTP traffic.

---

## 3. The Hyperscaler Trinity

TryBase combines three hyperscaler technologies into a unified multi-tenant engine:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        THE HYPERSCALER TRINITY                         │
├─────────────────────────┬─────────────────────────┬────────────────────┤
│   COMPUTE HYPERVISOR    │   FOUNDATION GATEWAY    │   VECTOR MEMORY    │
│                         │                         │                    │
│   AWS Fargate Graviton  │   Amazon Bedrock        │   PostgreSQL 16.3  │
│   ARM64 Firecracker     │   Keyless STS Access    │   Native pgvector  │
│   0 Public IP Exposure  │   Claude 3.5 Sonnet     │   1,536-dim HNSW   │
└─────────────────────────┴─────────────────────────┴────────────────────┘
```

By standardizing on this foundation, developers can build multi-tenant AI products with guaranteed data sovereignty, compliance, and enterprise security posture.

---

[Next: The Anti-Leak Standard →](./anti-leak-standard.md)
