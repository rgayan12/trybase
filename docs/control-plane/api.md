# Provisioning REST API

> [!NOTE]
> Workloads are provisioned through an authenticated REST endpoint on Amazon API Gateway, which kicks off the AWS Step Functions orchestration workflow.

---

## Endpoint Specification

```http
POST /v1/provision
Host: api.trybase.yourdomain.com
Authorization: Bearer <SUPABASE_JWT_TOKEN>
Content-Type: application/json
```

---

## Request Headers

| Header | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `Authorization` | String | **Yes** | Active Supabase user JWT token |
| `Content-Type` | String | **Yes** | Must be `application/json` |

---

## Request Body

```json
{
  "tenant_id": "fast-sam-soars",
  "workload_type": "agent",
  "alb_listener_rule_priority": 14250,
  "cpu": "512",
  "memory": "1024"
}
```

### Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `tenant_id` | String | **Yes** | Lowercase alphanumeric slug (3–63 chars, hyphens allowed) |
| `workload_type` | String | **Yes** | Workload archetype: `agent`, `dify`, or `n8n` |
| `alb_listener_rule_priority`| Integer | **Yes** | Integer between `100` and `49100` for ALB listener routing |
| `cpu` | String | No | CPU units (`256`, `512`, `1024`, `2048`). Default: `512` |
| `memory` | String | No | RAM in MiB (`512`, `1024`, `2048`, `4096`). Default: `1024` |

---

## Response (`200 OK`)

```json
{
  "status": "provisioning_started",
  "execution_arn": "arn:aws:states:eu-west-2:656876168893:execution:trybase-orchestrator:fast-sam-soars-1714152000",
  "tenant_id": "fast-sam-soars",
  "endpoint": "https://fast-sam-soars.agent.trybase.yourdomain.com",
  "estimated_time_seconds": 90
}
```

---

[Next: AWS Step Functions Orchestrator →](./step-functions.md)
