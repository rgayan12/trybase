# TryBase MCP Server (`@trybase/mcp`)

The official **Anthropic Model Context Protocol (MCP)** server for **TryBase: The Autonomous Cloud Engine for AI Agents & Workloads**.

`@trybase/mcp` connects AI assistants (Claude Desktop, Cursor, Windsurf, OpenClaw, and autonomous SRE loops) directly to your TryBase cloud fleet over standard JSON-RPC `stdio`.

---

## ⚡ Available Tools

| Tool | Description |
| :--- | :--- |
| `trybase_list_workloads` | Query running tenant microVMs, health status, CPU/RAM usage, and latency. |
| `trybase_deploy_workload` | Dispatch asynchronous Step Functions provisioning for isolated tenant containers. |
| `trybase_get_container_logs` | Stream stdout/stderr logs from CloudWatch with regex/severity filtering. |
| `trybase_scale_workload` | Dynamically scale vCPU & memory limits with zero-downtime rolling deploys. |
| `trybase_restart_workload` | Force a new deployment and verify `/healthz` healthchecks. |
| `trybase_create_backup` | Trigger an on-demand S3 logical backup (`pg_dump`) of a tenant PostgreSQL schema. |
| `trybase_set_secrets` | Push encrypted secrets directly into AWS Secrets Manager (zero `.env` on disk). |
| `trybase_run_migration` | Run isolated schema migrations (`artisan migrate` / `manage.py migrate`) with zero cross-tenant database locking. |
| `trybase_exec_command` | Execute interactive shell commands (`npm test`, `pytest`, `ls`) inside the isolated microVM sandbox with real-time stdout/stderr. |

---

## 🤖 Pre-Configured Autonomous Prompts

`@trybase/mcp` exposes pre-engineered autonomous prompt templates:

1. **`trybase_autonomous_sre`**:
   Directs the model to audit cluster health, find degraded workloads (e.g. high memory pressure / OOM risk), take a preventative S3 backup, scale task RAM, restart the service, and verify health recovery.
2. **`trybase_fleet_deploy`**:
   Coordinates canary ring deployments and parallel schema migrations across customer tenants upon `git push`.

---

## 🚀 Setup & Integration

### 1. Claude Desktop Setup

Add to your `claude_desktop_config.json`:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "trybase": {
      "command": "node",
      "args": ["/Volumes/Dev/blymo-spinout/packages/trybase-mcp/dist/index.js"],
      "env": {
        "TRYBASE_MODE": "mock"
      }
    }
  }
}
```

*For live AWS & Supabase production mode, provide:*
```json
{
  "mcpServers": {
    "trybase": {
      "command": "node",
      "args": ["/Volumes/Dev/blymo-spinout/packages/trybase-mcp/dist/index.js"],
      "env": {
        "TRYBASE_MODE": "aws",
        "AWS_REGION": "eu-west-2",
        "AWS_ACCESS_KEY_ID": "AKIA...",
        "AWS_SECRET_ACCESS_KEY": "...",
        "TRYBASE_SFN_ARN": "arn:aws:states:eu-west-2:...:stateMachine:n8n-provisioner",
        "SUPABASE_URL": "https://xyz.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "..."
      }
    }
  }
}
```

### 2. Cursor IDE Setup

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "trybase": {
      "command": "node",
      "args": ["packages/trybase-mcp/dist/index.js"]
    }
  }
}
```

---

## 🧪 Testing & Verification

Run the test suite:
```bash
npm test
```

Expected output:
```text
✔ TryBase MCP Tools Definition
✔ TryBase MCP Prompts Definition
✔ MockInfrastructureProvider - List and Inspect Workloads
✔ Tool Execution - Deploy Workload
✔ Tool Execution - Logs with Filter
✔ Tool Execution - Database Migration Scoped to Tenant Schema
✔ Autonomous SRE Scenario - Detect OOM, Backup, Scale, and Heal
ℹ tests 7
ℹ pass 7
```

---

## 📄 License
Apache-2.0
