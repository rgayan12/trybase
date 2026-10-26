# TryBase Architecture & Design Manifesto
## The Autonomous Cloud Engine for AI Agents & Workflows

> **Core Thesis:** Anyone can write a `Dockerfile` and run a container. Container images are a commodity.  
> The trillion-dollar challenge in modern software is **the operational, security, and financial harness around the container**: keyless identity, unforgeable kernel isolation, live observability, automated disaster recovery, scale-to-zero scheduling, and autonomous AI-driven management.

---

## 1. Executive Summary: Why Existing Cloud Platforms Fail AI Agents

Modern AI agent frameworks (**OpenClaw**, **Dify**, **Langflow**, **CrewAI**, **n8n**) require high-privilege access:
* Large language model API keys (OpenAI, Anthropic, Bedrock).
* Third-party integrations (Stripe, GitHub, Slack, Jira, Salesforce).
* Vector databases with persistent embeddings (`pgvector`).
* In-memory caches and message brokers (Redis, Celery).

Traditional platforms (Heroku, Railway, Render, Docker Compose) force developers into an obsolete 2015 security model:
1. Paste 30 plaintext API keys into an `.env` file or web form.
2. Store those secrets in a central database encrypted with "AES-256 at rest".
3. Inject them at container boot into `process.env` / `os.environ`.

### The Railway Breach Case Study (October 2026)
In late October 2026, attackers breached Railway’s internal infrastructure:
* Railway’s database **was** encrypted with AES-256 at rest.
* However, because Railway's backend services must possess the decryption key to inject `.env` files into containers, the attackers compromised internal credentials, gained decryption capabilities, and harvested raw AI API keys across roughly **100,000 workspaces**.
* The attackers explicitly hunted for **OpenAI and Anthropic API keys** to run large-scale model distillation attacks and drained cryptocurrency private keys stored in environment variables.

**The Lesson:** Centralized honey pots of static API keys are an existential risk. TryBase replaces this with **Zero-Static-Secret Architecture, Kernel-Enforced Isolation, and Autonomous Operations.**

---

## 2. The 5 Core Pillars of TryBase

```
                     ┌────────────────────────────────────────────────────────┐
                     │                     TRYBASE FLEET                      │
                     │                                                        │
┌────────────────────┼───────────────────────────┐                            │
│  1. SECURITY       │  2. OBSERVABILITY         │  3. DISASTER RECOVERY      │
│  - Zero .env files │  - Real-time Log Stream   │  - Tenant-scoped S3 Dumps  │
│  - SO_PEERCRED UDS │  - CloudWatch Insights    │  - 1-Click Snapshot Restore│
│  - Passwordless DB │  - Latency & Status Gauges│  - 30-Day Encrypted DR     │
│  - Ephemeral STS   │  - CPU/RAM Burn Curves    │                            │
└────────────────────┼───────────────────────────┴────────────────────────────┘
                     │
┌────────────────────┼────────────────────────────────────────────────────────┐
│  4. FINOPS SCHEDULING                          5. MCP AUTONOMOUS SRE        │
│  - 65% Savings via Business-Hour Sleep         - Anthropic Model Context    │
│  - Scale-to-Zero MicroVM Execution             - Agent-managed Scaling      │
│  - Scheduled Cron Batch Workloads              - Auto-Remediating Crashes   │
└────────────────────┴────────────────────────────────────────────────────────┘
```

---

## Pillar 1: Enterprise Security & Zero-Static-Secret Architecture

### A. You Cannot Steal What Does Not Exist
TryBase completely eliminates the centralized honey pot of customer cloud credentials:
* **AWS Cross-Account Role Delegation (`sts:AssumeRole`)**: When a tenant accesses AWS Bedrock, S3, or DynamoDB, the customer grants our ECS Task Role permission in their own AWS account with an unforgeable `ExternalId`. TryBase never holds, stores, or sees an `AWS_SECRET_ACCESS_KEY`.
* **Passwordless PostgreSQL (RDS IAM Authentication)**: Application containers connect to PostgreSQL without a database password. The container uses its link-local Task Role to mint a temporary 15-minute token signed by AWS STS.
* **Cryptographic Tenant Sharding**: There is no "Master Key". Each tenant gets an independent AWS Secrets Manager vault and scoped IAM policy. Tenant A's task role physically cannot decrypt Tenant B's secrets.

### B. The In-Task Secret Daemon (Eliminating `.env` Files)
Application containers run with `process.env` and `os.environ` **100% empty**. 
* If a vulnerable npm package, rogue Python pip library, or model dependency executes `console.log(process.env)`, it finds nothing.
* Secrets are fetched directly into application memory over an internal IPC channel.

### C. Kernel-Enforced IPC: Unix Domain Sockets + `SO_PEERCRED`
Traditional sidecars bind to TCP localhost (`127.0.0.1:8100`). This is vulnerable: any compromised process or SSRF vulnerability on localhost can query the secret port.

TryBase replaces TCP with a **Unix Domain Socket** (`/var/run/trybase/secrets.sock`):
1. **Zero Network Surface**: Communicates purely through kernel memory buffers—no TCP ports, no packet routing, 2x lower latency.
2. **Filesystem Permission Gate**: File mode `0660` owned by `trybase-daemon:trybase-app`. Rogue users cannot open the socket.
3. **The `SO_PEERCRED` Kernel Guarantee**:
   When a process connects to the socket, the TryBase daemon calls `getsockopt(fd, SOL_SOCKET, SO_PEERCRED, &ucred)`.
   * The Linux kernel—not the caller—populates the caller’s PID, UID, and GID from its internal task structure.
   * **Unforgeable:** Even an attacker with root inside the container cannot spoof what the kernel reports.
4. **Binary Validation via `/proc/<pid>/exe`**:
   The daemon inspects the calling binary. If an attacker spawns `/bin/bash`, `/bin/sh`, or `/usr/bin/curl` to probe the socket, the daemon detects an unauthorized binary, terminates the connection immediately, and triggers a security alert.
5. **IMDSv2 Handshake**: Mandatory `PUT` request with `X-TryBase-Token-TTL-Seconds: 60` and `X-Forwarded-For` rejection, defeating SSRF attacks.

---

## Pillar 2: Live Observability & Telemetry

Every tenant container automatically routes stdout/stderr to AWS CloudWatch Logs (`/aws/ecs/<service_name>`) and feeds native CloudWatch metrics.

### TryBase Telemetry Dashboard:
1. **Real-Time Log Streamer**: A zero-latency dark-mode log viewer inside the web console tailing container stdout/stderr with full-text search, regex filtering, and pause/resume.
2. **Performance Gauges**: Visualizing p50/p95/p99 latency, request volume, and HTTP status distribution (2xx, 4xx, 5xx) via ALB metrics.
3. **Resource Burn Curves**: Live CPU and Memory utilization graphs with automated warnings when tasks approach 85% memory limits (preventing Out-Of-Memory kills).

---

## Pillar 3: Automated Backups & Disaster Recovery

Managed cloud database snapshots take an all-or-nothing image of the entire cluster. TryBase introduces **Tenant-Scoped Disaster Recovery**:

1. **Logical Schema & Database Snapshots**:
   * A daily scheduled Lambda runs `pg_dump` targeting strictly `schema_<tenant_id>` (for n8n) or `db_<tenant_id>` (for Dify).
   * Backups are compressed (`.sql.gz`), encrypted using the tenant’s dedicated Secrets Manager key, and uploaded to an S3 backup bucket with a 30-day lifecycle expiration.
2. **1-Click Rollback & Export**:
   * Tenants can download their encrypted database export at any time.
   * One-click rollback restores an agent’s workflows and memory to any previous snapshot in seconds.

---

## Pillar 4: FinOps & Intelligent Scheduling (Scale-to-Zero)

Running idle AI agents 24/7 wastes 60–70% of cloud spend.

1. **Business-Hours Scheduling**:
   * Tenants can configure working schedules (e.g., *Run Monday–Friday 8 AM to 6 PM; scale to 0 overnight*).
   * Fargate tasks scale down to `desired_count = 0` during off-hours, **slashing customer cloud costs by up to 65%**.
2. **Cron Batch Execution**:
   * For periodic research or scraping agents, TryBase boots the microVM on a cron trigger, executes the task, archives the logs, and terminates the container immediately upon completion.

---

## Pillar 5: TryBase MCP Server (Model Context Protocol)
### The Autonomous Cloud SRE

By implementing an Anthropic **Model Context Protocol (MCP)** server, TryBase turns AI assistants (Claude Desktop, Cursor, OpenClaw, or autonomous agents) into **Autonomous Cloud SREs**.

### Exposed MCP Tools:
| Tool Name | Parameters | Action |
| :--- | :--- | :--- |
| `trybase_list_workloads` | `status_filter` | Returns all running tenant workloads, health state, and CPU/RAM allocations. |
| `trybase_deploy_workload` | `framework, name, config` | Dispatches a Step Function execution to provision a new isolated workload. |
| `trybase_get_container_logs` | `tenant_id, lines, filter` | Tails CloudWatch container logs for real-time debugging. |
| `trybase_scale_workload` | `tenant_id, cpu, memory` | Adjusts Fargate compute allocations and restarts the task definition. |
| `trybase_create_backup` | `tenant_id` | Triggers an immediate point-in-time PostgreSQL snapshot to S3. |
| `trybase_restart_workload` | `tenant_id` | Restarts unhealthy containers and verifies the ALB `/health` response. |

#### Real-World Agent Autonomous Workflow:
```
[CloudWatch Alarm: OutOfMemory (137) on tenant 'acme-agent']
                           │
                           ▼
[Autonomous AI Agent via TryBase MCP]
  1. Calls `trybase_get_container_logs("acme-agent", lines=50)`
     ↳ Discovers: "JavaScript heap out of memory during PDF embedding."
  2. Calls `trybase_create_backup("acme-agent")`
     ↳ Takes safety snapshot of database.
  3. Calls `trybase_scale_workload("acme-agent", cpu=1024, memory=2048)`
     ↳ Updates Fargate task definition from 512MB to 2048MB.
  4. Calls `trybase_restart_workload("acme-agent")`
     ↳ Probes `/health` endpoint until HTTP 200 OK is confirmed.
  5. Sends Slack notification to team:
     "Remediated OOM crash on acme-agent. Scaled RAM to 2GB. Service healthy."
```

---

## 3. Developer Experience (DX): "Secure by Default, Invisible by Design"

### Pattern A: The Native TryBase SDK
```python
# Python (FastAPI, CrewAI, LangChain, AutoGen)
from trybase import secrets, database
from langchain_openai import ChatOpenAI

# 1. Fetch secret directly into memory (os.environ is 100% empty!)
llm = ChatOpenAI(
    api_key=secrets.get("OPENAI_API_KEY"),
    model="gpt-4o"
)

# 2. Connect to PostgreSQL with zero static password
# Automatically uses the Firecracker Task Role to mint an ephemeral 15-minute STS token
db = database.connect()

def process_event(event):
    # Dynamic secret rotation: updating the key in the TryBase UI 
    # updates this read immediately without restarting the container!
    stripe_key = secrets.get("STRIPE_SECRET_KEY")
```

```typescript
// TypeScript / Node.js (OpenClaw, Flowise, Next.js)
import { secrets, database } from '@trybase/sdk';
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: await secrets.get('ANTHROPIC_API_KEY')
});

const pool = await database.createPool();
```

### Pattern B: The Zero-Code Injected Wrapper (For Unmodified Docker Images)
For third-party open-source applications (unmodified n8n, Dify, OpenClaw containers):
```dockerfile
# Wrap any existing image with zero code changes
ENTRYPOINT ["/usr/local/bin/trybase-entrypoint"]
CMD ["node", "server.js"]
```
* `trybase-entrypoint` performs the kernel handshake with `/var/run/trybase/secrets.sock`.
* Injects secrets exclusively into the child process memory of `node server.js`.
* Wipes its own memory and hands over PID 1 execution.

---

## 4. Workload Adapters Ecosystem

Adapters in TryBase are modular definitions that plug into this operational harness.

| Workload | Role | Architecture Highlights |
| :--- | :--- | :--- |
| **`hello`** | Generic Container | Minimal private Fargate container (`nginxdemos/hello`). |
| **`agent`** | Keyless Bedrock Agent | IAM Task Role, link-local STS (`169.254.170.2`), zero API keys. |
| **`n8n`** | Workflow Automation | Schema-per-tenant on Graviton RDS, per-tenant Secrets Manager keys. |
| **`dify`** | AI Agent Studio | Headless Flask REST API, dedicated DB, native `pgvector`, in-task Redis sidecar. |
| **`openclaw`** | Conversational Agent | Messaging gateway (Telegram/Slack/Discord), CPU-only Fargate, zero GPU required. |

---

## 5. Summary: The TryBase Moat

| Dimension | Traditional Cloud (Heroku / Railway / Docker Compose) | TryBase Autonomous Engine |
| :--- | :--- | :--- |
| **Secret Storage** | Plaintext `.env` files / central database honey pot. | **Zero-Static-Secret Architecture** via STS and kernel sockets. |
| **Database Access** | Static passwords stored in config strings. | **Passwordless RDS IAM Authentication**. |
| **Inter-Process Security** | Open TCP localhost (`127.0.0.1`). | **Unix Domain Sockets with Linux `SO_PEERCRED` & binary checks**. |
| **Hardware Boundary** | Shared Linux host kernels (Docker/K8s). | **Firecracker MicroVMs per tenant** (AWS Fargate). |
| **Observability** | Third-party paid agents (Datadog/Sentry). | **Native CloudWatch streaming log tail & metrics**. |
| **Disaster Recovery** | Manual whole-cluster exports. | **Tenant-scoped automated S3 dumps with 1-click restore**. |
| **Management Interface** | Human clicking in web dashboards. | **Anthropic MCP Server (Autonomous AI SRE)**. |
