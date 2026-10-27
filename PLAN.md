# Project Plan: TryBase — The Autonomous Cloud Engine for AI Agents & Workflows

This document tracks development progress, our architectural reality check, and the phased roadmap for implementing TryBase's core engineering moats.

---

## 🔍 Ground Truth & Reality Check: Where Are We Today?

| Capability | Documented Vision | Code Status | Notes |
| :--- | :--- | :--- | :--- |
| **Multi-Tenant Fargate Fleet** | Isolated Firecracker MicroVMs per tenant | ✅ **100% Live in Code** | VPC, ALB with Wildcard SSL, Subnets, Security Groups |
| **RDS Schema Isolation** | Dedicated schema/database per tenant | ✅ **100% Live in Code** | `create-schema` Lambda creates schemas & scoped credentials |
| **Step Functions Orchestrator** | Asynchronous durable provisioning pipeline | ✅ **100% Live in Code** | Full validation, target groups, listener rules, health checks |
| **Workload Battery (4 Archetypes)** | Hello, Agent (Bedrock), n8n, Dify | ✅ **100% Live in Code** | Passing end-to-end tests in `<90s` |
| **Teardown Automation** | Safe cleanup of ephemeral resources | ✅ **100% Live in Code** | `make clean-test-tenants` purges all orphaned resources |
| **Interactive In-App Documentation** | Laravel-style 35-chapter reader with Mermaid | ✅ **100% Live in Code** | Live in `/docs`, SVG zoom, pan, fullscreen lightbox |
| **The Anti-Leak Standard (UDS)** | Zero `.env`, `/var/run/trybase/secrets.sock` + `SO_PEERCRED` | 📋 *Documented / Vision* | Containers currently receive standard ECS environment variables |
| **TryBase MCP Server** | Model Context Protocol for Claude / Cursor / Agents | 📋 *Documented / Vision* | Tool specs written; code implementation pending |
| **Live CloudWatch Log Streaming** | Real-time container stdout/stderr in UI | 📋 *Documented / Vision* | Dashboard shows orchestrator events; CloudWatch tailing pending |
| **Tenant-Scoped S3 Backups & DR** | Automated `pg_dump` Lambda with 1-click restore | 📋 *Documented / Vision* | Documented in Pillar 3; Lambda implementation pending |
| **FinOps Scale-to-Zero Scheduling** | Auto-scale to 0 on idle + rehydration on traffic | 📋 *Documented / Vision* | Documented in Pillar 4; Alarm & rehydration wiring pending |

---

## Phase 1: MVP & Multi-Tenant Infrastructure — [COMPLETED]
- [x] Initial design & scoping (Shared VPC, Fargate per tenant).
- [x] Terraform foundation with remote state in S3.
- [x] Shared infrastructure: VPC, ALB, Wildcard ACM SSL, and RDS PostgreSQL online.
- [x] Tenant ECS Service, IAM roles, and target group wiring.

## Phase 2: Automation & Orchestration Pipeline — [COMPLETED]
- [x] AWS Step Functions orchestrator state machine.
- [x] `create-schema` Lambda (arm64 Graviton) with scoped PostgreSQL user provisioning.
- [x] CodeBuild pipeline for dynamic infrastructure execution.
- [x] End-to-end verification of `hello`, `n8n`, `agent`, and `dify` workloads.

## Phase 3: Control Plane & Dynamic Documentation — [COMPLETED]
- [x] Supabase authentication & workspace tracking.
- [x] Dashboard console with provisioning status and real-time state listeners.
- [x] Complete 35-chapter documentation suite in `docs/`.
- [x] Interactive in-app documentation reader (`web/src/views/Docs.jsx`) with live SVG Mermaid diagrams, pan/zoom canvas, and fullscreen lightbox modal.

---

## Phase 4: The 5 Deep-Tech Value Pillars (The "Fun Stuff") — [ACTIVE]

**Goal:** Turn our architectural whitepaper into concrete, defensible engineering moats.

```
                              THE 5 VALUE PILLARS SPRINT MAP
                                            │
         ┌──────────────────┬───────────────┼───────────────┬──────────────────┐
         ▼                  ▼               ▼               ▼                  ▼
    SPRINT 4.1         SPRINT 4.2      SPRINT 4.3      SPRINT 4.4         SPRINT 4.5
   TryBase MCP       The Anti-Leak     Live CloudWatch  Tenant S3 DR       Scale-to-Zero
     Server              Daemon         Log Streaming   (pg_dump Lambda)    (FinOps Idle)
(Autonomous SRE)     (SO_PEERCRED)     (Web Console)    (1-Click Restore)  (Sleep / Wake)
```

### Sprint 4.1: The TryBase MCP Server (`trybase-mcp`)
*Implement the official Anthropic Model Context Protocol (MCP) server so AI assistants (Claude Desktop, Cursor, OpenClaw, and autonomous agents) can inspect, deploy, scale, and heal TryBase workloads.*
- [ ] Initialize `packages/trybase-mcp` using the official `@modelcontextprotocol/sdk`.
- [ ] Implement core tools:
  - `trybase_list_workloads`: Inspect running tenants, status, and health.
  - `trybase_deploy_workload`: Dispatch asynchronous Step Functions provisioning.
  - `trybase_get_container_logs`: Fetch recent container stdout/stderr.
  - `trybase_scale_workload`: Dynamically scale CPU & memory limits.
  - `trybase_create_backup`: Trigger point-in-time PostgreSQL snapshot.
  - `trybase_restart_workload`: Restart unhealthy container services.
- [ ] Author autonomous self-healing prompt scenario (detect OOM $\rightarrow$ scale RAM $\rightarrow$ backup $\rightarrow$ restore health).

### Sprint 4.2: The Anti-Leak Standard (`trybase-agent` & UDS `SO_PEERCRED`)
*Eliminate plaintext `.env` files and environment variable dumps across the platform.*
- [ ] Build lightweight Go/Rust daemon (`trybase-agent`) listening on `/var/run/trybase/secrets.sock`.
- [ ] Implement Linux `SO_PEERCRED` caller UID/PID verification (`getsockopt(SOL_SOCKET, SO_PEERCRED)`).
- [ ] Implement binary validation via `/proc/<pid>/exe` (blocking reverse shells, `curl`, `/bin/bash`).
- [ ] Implement IMDSv2-style token handshakes (`PUT` request with TTL).
- [ ] Build zero-code injected wrapper (`trybase-entrypoint`) that scrubs `process.env` and injects secrets into application memory at startup.

### Sprint 4.3: Live Observability & CloudWatch Log Streaming
*Connect the web dashboard directly to live container logs with zero latency.*
- [ ] Build backend API endpoint / Supabase Edge Function to stream AWS CloudWatch Logs (`/aws/ecs/<tenant>`).
- [ ] Wire the dark-mode terminal in `web/src/views/Dashboard.jsx` to live container stdout/stderr.
- [ ] Add log pause/resume, regex search, and severity filters (INFO, WARN, ERROR).
- [ ] Add performance gauges: p50/p95 latency and HTTP 2xx/4xx/5xx status distribution.

### Sprint 4.4: Tenant-Scoped Automated Backups & Disaster Recovery
*Granular, per-tenant disaster recovery without whole-database dumps.*
- [ ] Build `backup-tenant` Lambda running `pg_dump` targeting strictly `schema_<tenant_id>` or `db_<tenant_id>`.
- [ ] Compress (`.sql.gz`) and encrypt with tenant-specific KMS keys.
- [ ] Upload to `s3://trybase-backups-<account>/<tenant_id>/` with 30-day lifecycle rules.
- [ ] Add 1-click database export & restore button to Dashboard and MCP server.

### Sprint 4.5: FinOps Intelligent Scheduling (Scale-to-Zero)
*Cut customer cloud bills by 65% by terminating idle compute.*
- [ ] Create CloudWatch Metric Alarm for `RequestCountPerTarget == 0` over 30 minutes.
- [ ] Wire Step Function to scale ECS service to `desired_count = 0`.
- [ ] Build ALB Rehydration Lambda: on incoming HTTP traffic, intercept request, scale `desired_count = 1`, wait for container healthy, and forward traffic.

---

## Phase 5: Ecosystem Expansion & Public Launch — [NEXT]

- [ ] **OpenClaw Workload Adapter**: Official `tenant_openclaw.tf` adapter for Telegram/Slack autonomous agents.
- [ ] **Root `README.md` Overhaul**: Position TryBase as the open-source infrastructure engine for autonomous AI agents.
- [ ] **Visual Terminal Demo**: Record high-res terminal walkthrough (`make test-provision`).
- [ ] **Community Release**: Product Hunt, Hacker News, r/selfhosted, and GitHub launch.
