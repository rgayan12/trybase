# Project Plan: TryBase — The Autonomous Cloud Engine for AI Agents & Workflows

This document tracks development progress, our architectural reality check, and the phased roadmap for implementing TryBase's core engineering moats.

---

## 🔍 Ground Truth & Reality Check: Where Are We Today?

| Capability | Documented Vision | Code Status | Notes |
| :--- | :--- | :--- | :--- |
| **Multi-Tenant Fargate Fleet** | Isolated Firecracker MicroVMs per tenant | ✅ **100% Live in Code** | VPC, ALB with Wildcard SSL, Subnets, Security Groups |
| **RDS Schema Isolation** | Dedicated schema/database per tenant | ✅ **100% Live in Code** | `create-schema` Lambda creates schemas & scoped credentials |
| **Step Functions Orchestrator** | Asynchronous durable provisioning pipeline | ✅ **100% Live in Code** | Full validation, target groups, listener rules, health checks |
| **Teardown Automation** | Safe cleanup of ephemeral resources | ✅ **100% Live in Code** | `make clean-test-tenants` purges all orphaned resources |
| **Interactive In-App Documentation** | Laravel-style 35-chapter reader with Mermaid | ✅ **100% Live in Code** | Live in `/docs`, SVG zoom, pan, fullscreen lightbox |
| **The Anti-Leak Standard (UDS)** | Zero `.env`, `/var/run/trybase/secrets.sock` + `SO_PEERCRED` | ✅ **100% Live in Code** | Rust daemon (`trybase-daemon`), `trybase-entrypoint`, IMDSv2, RDS IAM, 9/9 tests passing |
| **TryBase MCP Server** | Model Context Protocol for Claude / Cursor / Agents | ✅ **100% Live in Code** | `@trybase/mcp`, 8 tools, 2 prompts, stdio transport, 7/7 tests passing |
| **Live CloudWatch Log Streaming** | Real-time container stdout/stderr in UI | 📋 *Documented / Vision* | Dashboard shows orchestrator events; CloudWatch tailing pending |
| **Tenant-Scoped S3 Backups & DR** | Automated `pg_dump` Lambda with 1-click restore | 📋 *Documented / Vision* | Documented in Pillar 3; Lambda implementation pending |
| **FinOps Scale-to-Zero Scheduling** | Auto-scale to 0 on idle + rehydration on traffic | 📋 *Documented / Vision* | Documented in Pillar 4; Alarm & rehydration wiring pending |
| **Fleet Migration & GitOps Orchestrator** | `git push` runs parallel migrations across tenant schemas | 📋 *Documented / Vision* | Documented in Sprint 4.6; Step Functions Distributed Map |

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

## Phase 4: The Deep-Tech Value Pillars (The "Fun Stuff") — [ACTIVE]

**Goal:** Turn our architectural whitepaper into concrete, defensible engineering moats.

```
                               THE VALUE PILLARS SPRINT MAP
                                             │
         ┌──────────────┬──────────────┬─────┴────────┬──────────────┬──────────────┐
         ▼              ▼              ▼              ▼              ▼              ▼
    SPRINT 4.1     SPRINT 4.2     SPRINT 4.3     SPRINT 4.4     SPRINT 4.5     SPRINT 4.6
   TryBase MCP   The Anti-Leak   Live Log Stream Tenant S3 DR   Scale-to-Zero   Fleet GitOps
      Server         Daemon      (Web Console)  (pg_dump S3)    (Sleep/Wake)    & Migrations
   [COMPLETED]    [COMPLETED]    [NEXT FOCUS]     (1-Click)        (FinOps)      (Single Push)
```

### Sprint 4.1: The TryBase MCP Server (`trybase-mcp`) — [COMPLETED]
*Implement the official Anthropic Model Context Protocol (MCP) server so AI assistants (Claude Desktop, Cursor, OpenClaw, and autonomous agents) can inspect, deploy, scale, and heal TryBase workloads.*
- [x] Initialize `packages/trybase-mcp` using the official `@modelcontextprotocol/sdk`.
- [x] Implement core tools:
  - `trybase_list_workloads`: Inspect running tenants, status, and health.
  - `trybase_deploy_workload`: Dispatch asynchronous Step Functions provisioning.
  - `trybase_get_container_logs`: Fetch recent container stdout/stderr.
  - `trybase_scale_workload`: Dynamically scale CPU & memory limits.
  - `trybase_create_backup`: Trigger point-in-time PostgreSQL snapshot.
  - `trybase_restart_workload`: Restart unhealthy container services.
  - `trybase_set_secrets`: Securely push encrypted secrets to a tenant's vault.
  - `trybase_run_migration`: Run isolated schema migrations with zero cross-tenant database locking.
- [x] Implement pre-configured autonomous prompts (`trybase_autonomous_sre`, `trybase_fleet_deploy`).
- [x] Author automated test suite passing 7/7 tests verifying autonomous self-healing (`npm test`).

### Sprint 4.2: The Anti-Leak Standard (`trybase-daemon` & UDS `SO_PEERCRED`) — [COMPLETED]
*Eliminate plaintext `.env` files and environment variable dumps across the platform.*
- [x] Build lightweight Rust daemon (`trybase-daemon`) listening on `/var/run/trybase/secrets.sock` with mode `0666`.
- [x] Implement Linux `SO_PEERCRED` caller UID/PID verification (`getsockopt(SOL_SOCKET, SO_PEERCRED)`).
- [x] Implement binary validation via `/proc/<pid>/exe` (blocking reverse shells, `curl`, `/bin/bash`).
- [x] Implement IMDSv2-style token handshakes (`PUT /latest/api/token` with TTL and SSRF defense).
- [x] Implement Passwordless PostgreSQL via 15-minute ephemeral RDS IAM database tokens.
- [x] Build zero-code injected wrapper (`trybase-entrypoint`) that scrubs `process.env` and injects secrets into application memory at startup.
- [x] Build client SDKs: Laravel (`TryBaseServiceProvider.php`), Python/Django (`trybase_secrets.py`), Go (`client.go`), and TypeScript/Node.js (`client.ts`).
- [x] Automated test battery passing 9/9 integration tests (`tests/test_anti_leak_daemon.sh`).

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

### Sprint 4.6: Fleet Migration & GitOps Orchestrator (Single-Tenant Code, Multi-Tenant Rollout)
*A single `git push` runs schema migrations and deploys zero-downtime rolling updates across the entire tenant fleet.*
- [ ] Build `FleetRolloutStateMachine` using AWS Step Functions **Distributed Map** (configurable concurrency, e.g. 20 tenants in parallel).
- [ ] Build Schema Migration Runner: one-off ephemeral container task with scoped `search_path = schema_<tenant_id>` running `artisan migrate` or `manage.py migrate`.
- [ ] Wire Canary Deployment Rings:
  - **Ring 0**: Internal dogfood tenant.
  - **Ring 1**: 5% of customer fleet.
- [ ] Integrate with TryBase Web Console for real-time fleet rollout matrix visualization.

---

## Phase 5: Ecosystem Expansion & Public Launch — [NEXT]

- [ ] **OpenClaw Workload Adapter**: Official `tenant_openclaw.tf` adapter for Telegram/Slack autonomous agents.
- [ ] **Root `README.md` Overhaul**: Position TryBase as the open-source infrastructure engine for autonomous AI agents.
- [ ] **Visual Terminal Demo**: Record high-res terminal walkthrough (`make test-provision`).
- [ ] **Community Release**: Product Hunt, Hacker News, r/selfhosted, and GitHub launch.
