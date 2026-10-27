# Database Schema & Realtime State

> [!TIP]
> TryBase uses Supabase PostgreSQL for workspace management and WebSocket-based Realtime status updates in the Web Console.

---

## 1. Schema Definition

```sql
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  tenant_id text unique,
  workload_type text default 'agent' check (workload_type in ('agent', 'dify', 'n8n', 'generic')),
  status text default 'unprovisioned' check (status in ('unprovisioned', 'provisioning', 'active', 'failed', 'suspended')),
  alb_listener_rule_priority integer unique,
  provisioning_started_at timestamptz,
  provisioned_at timestamptz,
  created_at timestamptz default now()
);
```

---

## 2. Row-Level Security (RLS) Policies

To guarantee that administrators only manage their authorized workloads:

```sql
-- Enable RLS
alter table public.workspaces enable row level security;

-- Policy: Select & Manage Own Workspaces
create policy "Users can view and manage their own workspaces"
  on public.workspaces for all
  using (auth.uid() = user_id);
```

---

## 3. Realtime Publication

To enable the Web Console to receive live provisioning status updates without polling:

```sql
-- Add workspaces table to realtime publication
alter publication supabase_realtime add table public.workspaces;
```

When Step Functions completes deployment and updates `status = 'active'`, the client UI updates in real time via WebSockets.

---

[Next: Makefile & CLI Cheatsheet →](./cli.md)
