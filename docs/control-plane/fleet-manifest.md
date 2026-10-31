# Declarative Fleet Manifests (`trybase.fleet.yml`)

> [!NOTE]
> TryBase supports declarative **Infrastructure-as-Code (IaaS)** for multi-workload AI platforms. A single `trybase.fleet.yml` manifest orchestrates an interconnected ecosystem of agents, workflow engines, and backend services under a shared organization namespace.

---

## 1. The Fleet Concept

In modern production deployments, an organization rarely runs a single container. A complete AI platform typically requires:
1. A **Workflow Automation Engine** (e.g. n8n)
2. A **Knowledge & Prompt Studio** (e.g. Dify)
3. An **Autonomous Execution Runner** (e.g. OpenClaw with AWS Bedrock)
4. A **Browser / Sandbox Computer Environment** (e.g. OpenMuse)
5. A **Custom API Backend** (e.g. Laravel, FastAPI, or Go)

Instead of provisioning these services individually, TryBase allows you to declare the entire topology in `trybase.fleet.yml` and deploy it with a single command.

---

## 2. Manifest Schema & Example

Create `trybase.fleet.yml` in your project root:

```yaml
# ==============================================================================
# TryBase Multi-Workload Fleet Manifest
# ==============================================================================

organization: acme-corp
version: "1.0"

workloads:
  # 1. Workflow Automation Engine (n8n)
  - name: workflow
    archetype: n8n
    subdomain: workflow.acme.apps.trybase.io
    cpu: 1024
    memory: 2048
    secrets:
      N8N_BASIC_AUTH_ACTIVE: "true"
      WEBHOOK_URL: "https://workflow.acme.apps.trybase.io/"

  # 2. Knowledge & Prompt Studio (Dify)
  - name: knowledge
    archetype: dify
    subdomain: dify.acme.apps.trybase.io
    cpu: 1024
    memory: 2048
    secrets:
      MODE: "api"
      VECTOR_STORE: "pgvector"

  # 3. Autonomous Execution Runner (OpenClaw / Bedrock Agent)
  - name: runner
    archetype: openclaw
    subdomain: agent.acme.apps.trybase.io
    cpu: 1024
    memory: 2048
    secrets:
      WORKSPACE_DIR: "/workspace"
      ENABLE_ANTI_LEAK: "true"

  # 4. Agent Computer / Browser Sandbox (OpenMuse)
  - name: computer
    archetype: openmuse
    subdomain: muse.acme.apps.trybase.io
    cpu: 1024
    memory: 2048
    secrets:
      SANDBOX_TIMEOUT_SEC: "1800"
      ENABLE_ANTI_LEAK: "true"

  # 5. Core REST Backend API (Laravel / FastAPI / Go)
  - name: core-api
    archetype: laravel
    subdomain: api.acme.apps.trybase.io
    cpu: 512
    memory: 1024
    secrets:
      APP_ENV: "production"
      APP_DEBUG: "false"
```

---

## 3. Configuration Reference

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `organization` | String | Yes | Unique organization identifier (namespaces database schemas & secrets). |
| `version` | String | Yes | Manifest version (currently `"1.0"`). |
| `workloads[].name` | String | Yes | Unique service name within the organization (e.g. `workflow`, `runner`). |
| `workloads[].archetype` | Enum | Yes | Workload runtime archetype (see below). |
| `workloads[].subdomain` | String | Yes | Full HTTPS subdomain registered on the shared Application Load Balancer. |
| `workloads[].cpu` | Integer | No | Allocated CPU units: `256` (0.25 vCPU), `512` (0.5 vCPU), `1024` (1 vCPU), `2048` (2 vCPU). Default `512`. |
| `workloads[].memory` | Integer | No | Allocated RAM in MiB (`512`, `1024`, `2048`, `4096`). Default `1024`. |
| `workloads[].secrets` | Map | No | Key-value secrets injected into AWS Secrets Manager (Anti-Leak Standard). |

### Supported Archetypes
- **`n8n`**: Automated node-based workflow orchestration.
- **`dify`**: Visual AI application builder, prompt engineering, and RAG knowledge base.
- **`openclaw`**: Autonomous AI agent runner with AWS Bedrock execution permissions.
- **`openmuse`**: Browser sandbox and desktop interaction runtime for agent computer use.
- **`laravel`**: Production PHP 8.3 framework with Artisan CLI and PostgreSQL schema bindings.
- **`django`**: Python web framework with asynchronous workers.
- **`custom`**: Any arbitrary container image specified via `imageTag`.

---

## 4. Deploying the Fleet

### Method A: Via the TryBase CLI
Validate the manifest syntax first:
```bash
trybase fleet deploy trybase.fleet.yml --dry-run
```

Deploy all workloads across your AWS fleet:
```bash
trybase fleet deploy trybase.fleet.yml
```

Inspect active fleet status and allocations:
```bash
trybase status -o acme-corp
```

---

### Method B: Via AI Coding Assistants (Claude / Cursor MCP)
Because TryBase ships with an integrated Model Context Protocol (MCP) server (`@trybase/mcp`), you can deploy fleet manifests directly from your AI editor:

> *"Deploy our multi-workload fleet manifest trybase.fleet.yml and verify container health"*

The AI assistant invokes the `trybase_deploy_fleet` tool, initiates Step Functions pipelines, and reports status in chat.

---

### Method C: Via REST API
Send an authenticated `POST` request to your API Gateway endpoint:
```bash
curl -X POST "https://<API_GATEWAY_URL>/provision/fleet" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  --data-binary @trybase.fleet.json
```

---

## 5. Security & Isolation Guarantees

Even though workloads are declared in a single file:
1. **Physical MicroVM Isolation**: Each workload runs inside its own isolated AWS Fargate MicroVM.
2. **Schema-per-Tenant Isolation**: Databases are partitioned into dedicated PostgreSQL schemas (`schema_acme_corp_workflow`, `schema_acme_corp_core_api`).
3. **Anti-Leak Standard**: All `secrets` are encrypted directly into AWS Secrets Manager and exposed exclusively via the local Unix Domain Socket (`/var/run/trybase/secrets.sock`). Zero `.env` files are written to disk.

---

[Next: Makefile & CLI Cheatsheet →](./cli.md)
