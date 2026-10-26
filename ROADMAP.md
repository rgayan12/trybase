# TryBase Engineering Roadmap & Launch Strategy
## The Path to Open-Source Adoption & Autonomous Cloud Operations

> **Vision:** Establish TryBase as the definitive open-source cloud infrastructure engine for autonomous AI agents and automations.  
> We compete not on commodity container images, but on the **enterprise security, observability, disaster recovery, FinOps scheduling, and autonomous AI-driven management (MCP)** around the workload.

---

```
                       STRATEGIC ROADMAP OVERVIEW
                                   │
     ┌─────────────────────────────┴─────────────────────────────┐
     ▼                                                           ▼
PHASE 1: THE STAR MAGNET                                    PHASE 2: THE CORE MOATS
(Immediate Launch & Community Traction)                     (Engineering Deep Defensibility)
  1.1. Root README.md Overhaul                                2.1. TryBase MCP Server (Autonomous SRE)
  1.2. OpenClaw Workload Adapter                              2.2. Live Log Streaming in Web Dashboard
  1.3. 60-Second Terminal GIF Demo                            2.3. Zero-Env Kernel Daemon (SO_PEERCRED)
  1.4. Public Launch Kit (Show HN / Reddit / X)               2.4. Tenant-Scoped S3 Backups & DR
                                                              2.5. FinOps Scale-to-Zero Scheduling
```

---

## Phase 1: The "Star Magnet" (Immediate Launch Package)

**Goal:** Publish on GitHub, Hacker News ("Show HN"), Reddit (`r/selfhosted`, `r/LocalLLaMA`), and X to drive fast developer adoption and GitHub stars.

### 1.1. Root `README.md` Overhaul
* Re-align the front page from legacy single-purpose messaging to:
  * **"TryBase: The Open-Source Cloud Infrastructure Engine for Autonomous AI Agents & Workflows"**
* Prominently showcase the **5 Architectural Moats**:
  1. **Zero-Static-Secret Architecture**: Lessons from the Railway breach; why TryBase eliminates honey pots.
  2. **Kernel-Enforced Isolation**: Unix Domain Sockets + Linux `SO_PEERCRED` caller UID/PID verification.
  3. **Zero-Cost Redis Sidecars**: In-task private Redis on `127.0.0.1:6379` ($0 managed cache bill).
  4. **Hardware MicroVMs**: Dedicated Firecracker isolation per tenant via AWS ECS Fargate.
  5. **Model Context Protocol (MCP)**: AI agents managing their own cloud infrastructure.
* Visual architecture diagrams (Mermaid + clean ASCII).
* 90-second quickstart guide (`make test-provision WORKLOAD=agent`).

### 1.2. Official OpenClaw Workload Adapter
* OpenClaw is currently the fastest-growing open-source AI agent project. Providing an official, 1-command deployment turns the entire OpenClaw community into immediate TryBase users.
* **Deliverables**:
  * `terraform/tenant_openclaw.tf.example`: Configured for Telegram/Slack/Discord webhooks.
  * CodeBuild dynamic generator hook in `terraform/codebuild.tf`.
  * Automated end-to-end test case in `tests/test_api_provisioning.sh`.
  * Verified CPU-only Fargate execution with zero GPU requirements.

### 1.3. Visual Demo Artifacts
* Record a 60-second high-resolution terminal GIF (`vhs`) demonstrating:
  * Running `make test-provision WORKLOAD=agent`.
  * Instant orchestration: Step Functions $\rightarrow$ CodeBuild $\rightarrow$ Fargate task $\rightarrow$ ALB SSL route $\rightarrow$ `HTTP 200` in <90s.
  * Cleaning up with `make clean-test-tenants`.

### 1.4. Public Launch Kit
* Prepared copy and technical breakdown for:
  * **Hacker News**: *"Show HN: TryBase – Open-source cloud engine for autonomous AI agents"* (focus on `SO_PEERCRED`, link-local STS, and avoiding the Railway breach).
  * **Reddit**: Posts tailored for `r/selfhosted`, `r/LocalLLaMA`, and `r/DevOps`.
  * **X / Twitter**: Technical thread highlighting the architecture manifesto.

---

## Phase 2: The Core Product Moats (Engineering the Moat)

**Goal:** Build the deep technical differentiators that make TryBase impossible for traditional container hosting platforms to replicate.

### 2.1. The TryBase MCP Server (`trybase-mcp`)
* Implement an Anthropic **Model Context Protocol (MCP)** server enabling AI assistants (Claude Desktop, Cursor, OpenClaw, autonomous agents) to act as an **Autonomous Cloud SRE**.
* **Tools Implemented**:
  * `trybase_list_workloads`: Inspect active tenants, health states, and resource allocations.
  * `trybase_deploy_workload`: Dispatch automated Step Function provisioning.
  * `trybase_get_container_logs`: Fetch real-time CloudWatch stdout/stderr logs.
  * `trybase_scale_workload`: Dynamically adjust vCPU and memory allocations.
  * `trybase_create_backup`: Trigger on-demand point-in-time PostgreSQL snapshots to S3.
  * `trybase_restart_workload`: Restart unhealthy containers and verify `/health` responses.
* **Autonomous Remediation Loop**:
  * An agent detects an Out-Of-Memory (137) crash $\rightarrow$ inspects logs $\rightarrow$ creates a safety backup $\rightarrow$ scales memory from 512MB to 1024MB $\rightarrow$ verifies health check is back to `HTTP 200`.

### 2.2. Live Container Log Streaming & Telemetry Dashboard
* Wire the React console ([`web/src/views/Dashboard.jsx`](file:///Volumes/Dev/blymo-spinout/web/src/views/Dashboard.jsx)) directly to AWS CloudWatch Logs Insights.
* **Features**:
  * Zero-latency dark-mode log streamer tailing container stdout/stderr.
  * Full-text search and regex filtering.
  * p50/p95/p99 latency curves and HTTP 2xx/4xx/5xx distribution gauges.
  * Memory and CPU utilization burn charts with proactive 85% threshold alerts.

### 2.3. The Zero-Env Secret Daemon (`trybase-agent` & `SO_PEERCRED`)
* Eliminate plaintext `.env` files and environment variable dumps across the platform.
* **Architecture**:
  * 5MB Rust/Go sidecar listening exclusively on `/var/run/trybase/secrets.sock`.
  * Linux `SO_PEERCRED` caller UID/PID verification.
  * `/proc/<pid>/exe` binary validation (blocking `/bin/bash`, `curl`, and injected reverse shells).
  * IMDSv2-style PUT token handshakes.
  * **Passwordless PostgreSQL**: Containers connect to RDS using ephemeral 15-minute IAM tokens via `rds-db:connect` (zero database passwords exist on disk or wire).
  * **Zero-Code Injected Wrapper** (`trybase-entrypoint`) for unmodified open-source images.

### 2.4. Tenant-Scoped Automated Backups & Disaster Recovery
* Move beyond whole-cluster snapshots to granular, tenant-isolated disaster recovery.
* **Architecture**:
  * Scheduled daily Lambda running `pg_dump` targeting strictly `schema_<tenant_id>` or `db_<tenant_id>`.
  * Compressed (`.sql.gz`), encrypted with the tenant's Secrets Manager key, and saved to S3.
  * 30-day automated lifecycle rules.
  * 1-click restore and raw SQL export via UI and MCP tool.

### 2.5. FinOps & Intelligent Scheduling (Scale-to-Zero)
* AI agents should not incur 24/7 cloud costs when idle.
* **Architecture**:
  * **Business-Hours Scheduling**: Automatically scale tasks down to `desired_count = 0` outside business hours, **cutting customer cloud bills by 65%**.
  * **Cron Batch Workloads**: Wake-on-schedule execution for periodic sync/scraping agents, automatically terminating compute immediately upon task completion.

---

## 3. Progress Tracking & Milestone Status

| Milestone | Target | Status | Deliverable |
| :--- | :--- | :--- | :--- |
| **Multi-Workload Fleet** | Hello, Agent, n8n, Dify | ✅ **Complete** | Verified 4/4 archetypes passing in <90s. |
| **Teardown Automation** | Ephemeral test cleaning | ✅ **Complete** | `make clean-test-tenants` (85 resources purged). |
| **Adapter Contribution Guide** | Community framework spec | ✅ **Complete** | `CONTRIBUTING.md` + `tenant_adapter_template.tf.example`. |
| **Architecture Manifesto** | Deep-tech whitepaper | ✅ **Complete** | `adhoc/design-notes.md` (Security, Railway analysis, Moats). |
| **Strategic Roadmap** | Execution plan | ✅ **Complete** | `ROADMAP.md`. |
| **Root README Overhaul** | Public launch front page | ⏳ *Next* | `readme.md` positioning & quickstart. |
| **OpenClaw Adapter** | 5th viral archetype | ⏳ *Next* | `tenant_openclaw.tf.example` + CodeBuild hook. |
| **TryBase MCP Server** | Autonomous Cloud SRE | 📋 *Planned* | `trybase-mcp` package. |
| **Live Log Streaming** | Observability UI | 📋 *Planned* | React dashboard CloudWatch tailing. |
| **Zero-Env Daemon** | `SO_PEERCRED` sidecar | 📋 *Planned* | In-task Unix socket secret daemon. |
