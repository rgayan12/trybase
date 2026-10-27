# API Reference & Orchestration

This reference documents TryBase's control plane REST endpoints, AWS Step Functions provisioning workflow, database schema, and Makefile CLI targets.

---

## Provisioning API

Workloads are deployed by issuing an authenticated `POST` request to the API Gateway provisioning endpoint.

### Endpoint
```http
POST /provision
Authorization: Bearer <SUPABASE_JWT_TOKEN>
Content-Type: application/json
```

### Request Headers
| Header | Type | Description |
| :--- | :--- | :--- |
| `Authorization` | String | Bearer token from active Supabase user session |
| `Content-Type` | String | Must be `application/json` |

### Request Body
```json
{
  "tenant_id": "fast-wolf-runs",
  "workload_type": "agent",
  "alb_listener_rule_priority": 14250,
  "cpu": "512",
  "memory": "1024"
}
```

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `tenant_id` | String | Yes | Unique subdomain slug for the workload (3–63 lowercase alphanumeric/hyphen characters) |
| `workload_type` | String | Yes | Workload engine: `agent`, `dify`, or `n8n` |
| `alb_listener_rule_priority` | Integer | Yes | Unique integer priority between `100` and `49100` for the ALB rule |
| `cpu` | String | No | Fargate CPU units (`256`, `512`, `1024`, `2048`). Default: `512` |
| `memory` | String | No | Fargate RAM in MiB (`512`, `1024`, `2048`, `4096`). Default: `1024` |

### Success Response (`200 OK`)
```json
{
  "status": "provisioning_started",
  "execution_arn": "arn:aws:states:eu-west-2:656876168893:execution:trybase-orchestrator:fast-wolf-runs-1714152000",
  "tenant_id": "fast-wolf-runs",
  "endpoint": "https://fast-wolf-runs.agent.yourdomain.com",
  "estimated_time_seconds": 90
}
```

---

## Step Functions Orchestrator

The provisioning lifecycle is managed as an asynchronous state machine:

```mermaid
graph TD
    Start([POST /provision]) --> Validate[Validate Parameters & Check Slug Clashes]
    Validate --> DBInit[Run Schema Bootstrap Lambda: create-schema]
    DBInit --> IAMRole[Generate Dedicated IAM Task Role]
    IAMRole --> ECSDef[Register Fargate Task Definition]
    ECSDef --> ALBTarget[Create ALB Target Group & Health Check]
    ALBTarget --> ALBRule[Bind ALB Listener Rule with Host Header]
    ALBRule --> ECSService[Launch ECS Fargate Service]
    ECSService --> HealthWait{Poll ALB Target Health}
    HealthWait -->|Target Healthy (HTTP 200)| Complete[Update Supabase Workspace Status to active]
    HealthWait -->|Timeout > 180s| Rollback[Trigger Rollback State & Alert]
```

### Execution Steps
1. **Schema Bootstrap**: A lightweight Lambda function connects to PostgreSQL and executes `CREATE SCHEMA tenant_slug;` with scoped user permissions.
2. **Task Registration**: The orchestrator registers a task definition with the workload image, link-local STS credentials, and optional Redis sidecar.
3. **Ingress Wiring**: A target group is created on port `8080` (or `5001`/`5678`) and registered to the ALB HTTPS listener.
4. **Health Verification**: Step Functions polls target health until the container returns `HTTP 200` on `/healthz`.
5. **Realtime Broadcast**: Upon completion, the database record updates to `status: active`, instantly updating the user's web console.

---

## Database Schema

TryBase uses Supabase PostgreSQL for workspace metadata and realtime state subscriptions:

```sql
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  tenant_id text unique,
  workload_type text default 'agent',
  status text default 'unprovisioned' check (status in ('unprovisioned', 'provisioning', 'active', 'failed', 'suspended')),
  alb_listener_rule_priority integer unique,
  provisioning_started_at timestamptz,
  provisioned_at timestamptz,
  created_at timestamptz default now()
);

-- Row-Level Security (RLS)
alter table public.workspaces enable row level security;

create policy "Users can view and manage their own workspaces"
  on public.workspaces for all
  using (auth.uid() = user_id);
```

---

## Makefile Cheatsheet

All common infrastructure tasks are exposed through unified Make targets:

| Command | Description |
| :--- | :--- |
| `make check-env` | Verifies local dependencies (`terraform`, `aws`, `docker`, `jq`) |
| `make bootstrap` | Sets up remote S3 state bucket and DynamoDB lock table |
| `make cost` | Runs Infracost pre-deploy cost estimation |
| `make deploy` | Applies Terraform to stand up the cloud fleet |
| `make control-plane` | Applies database migrations and edge orchestration functions |
| `make sync-tenants` | Re-synchronizes active ECS tasks with database state |
| `make destroy` | Tears down cloud resources with automatic ENI cleanup |
