# Quickstart: Deploy First Workload

> [!TIP]
> In under 90 seconds, you can provision an isolated AWS Fargate MicroVM running a keyless AI agent container connected to Amazon Bedrock and pgvector.

---

## Method A: Deploy via Web Console

### 1. Launch the Local Web Console

```bash
cd web
npm install
npm run dev
```

Visit `http://localhost:5173`.

### 2. Authenticate
Sign in with your administrator credentials. The open-source console routes you directly to your fleet dashboard.

### 3. Click "+ Deploy Workload"
1. **Choose Engine**: Select **Custom AI Container / Agent**.
2. **Subdomain Slug**: Accept the generated name (e.g. `fast-sam-soars`) or customize it.
3. **Click "Deploy Infrastructure"**.

The interactive terminal displays real-time provisioning logs as AWS Step Functions provisions the task definition, ALB target group, and pgvector schema.

---

## Method B: Deploy via CLI (cURL)

You can also trigger provisioning directly via the API Gateway endpoint:

```bash
curl -X POST https://api.trybase.yourdomain.com/v1/provision \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "fast-sam-soars",
    "workload_type": "agent",
    "alb_listener_rule_priority": 14250,
    "cpu": "512",
    "memory": "1024"
  }'
```

Response (`200 OK`):

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

## 3. Verify Live Workload

Once Step Functions completes health verification, test the live agent endpoint:

```bash
curl https://fast-sam-soars.agent.trybase.yourdomain.com/healthz
```

Output:

```json
{
  "status": "healthy",
  "engine": "trybase-fargate",
  "architecture": "aarch64",
  "bedrock_sts": "enabled",
  "pgvector_status": "connected"
}
```

Test generating an AI response via Amazon Bedrock (keyless Claude 3.5 Sonnet):

```bash
curl -X POST https://fast-sam-soars.agent.trybase.yourdomain.com/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain Firecracker MicroVMs in two sentences."}'
```

---

[Next: Hyperscaler Topology →](../architecture/topology.md)
