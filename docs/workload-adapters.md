# Workload Adapters Specification

A **Workload Adapter** is a declarative specification that packages an autonomous AI agent runtime or orchestration studio into TryBase's multi-tenant cloud fabric.

Instead of hand-crafting individual VPCs, DNS entries, and database connections for every new framework, an adapter maps the framework's runtime requirements to TryBase's standardized hyperscaler resources.

---

## The Workload Adapter Contract

Every Workload Adapter satisfies four architectural contracts:

| Contract | Implementation | Guarantee |
| :--- | :--- | :--- |
| **1. Compute Hypervisor** | AWS Fargate Graviton ARM64 | MicroVM isolation, independent CPU/RAM scaling |
| **2. Traffic Ingress** | ALB Host-Header Routing Rule | Wildcard TLS termination, automatic subdomain routing |
| **3. Vector Memory** | RDS PostgreSQL with `pgvector` | Dedicated schema, HNSW indexed embeddings |
| **4. In-Task Caching** | Local Redis sidecar container | `127.0.0.1:6379`, 0.05ms loopback latency, $0 extra cost |

---

## Writing Keyless Agent Workloads

When developing autonomous agents to run on TryBase, never configure hardcoded AWS credentials or pass secret environment variables. Leverage standard AWS SDK credential discovery.

### Python (FastAPI + boto3)

```python
import os
import json
import boto3
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="TryBase Autonomous Agent")

# ZERO STATIC API KEYS!
# boto3 automatically discovers the link-local STS metadata agent
bedrock = boto3.client("bedrock-runtime", region_name=os.getenv("AWS_REGION", "eu-west-2"))

class PromptRequest(BaseModel):
    prompt: str

@app.post("/v1/chat")
def generate_response(req: PromptRequest):
    try:
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": req.prompt}]
        })

        response = bedrock.invoke_model(
            modelId="anthropic.claude-3-5-sonnet-20240620-v1:0",
            body=body
        )
        payload = json.loads(response["body"].read())
        return {"reply": payload["content"][0]["text"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/healthz")
def healthcheck():
    return {"status": "healthy", "engine": "trybase-fargate"}
```

### TypeScript (@aws-sdk/client-bedrock-runtime)

```typescript
import express, { Request, Response } from "express";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const app = express();
app.use(express.json());

// Credentials automatically resolved from container environment
const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "eu-west-2"
});

app.post("/v1/chat", async (req: Request, res: Response) => {
  try {
    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
      contentType: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1024,
        messages: [{ role: "user", content: req.body.prompt }]
      })
    });

    const response = await bedrock.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));
    res.json({ reply: result.content[0].text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/healthz", (_, res) => res.json({ status: "healthy" }));
app.listen(8080, () => console.log("Agent listening on port 8080"));
```

---

## Supported Starter Adapters

TryBase ships with pre-configured workload definitions for prominent autonomous runtimes:

### 1. Custom Agent Container (`agent`)
* **Container Port**: `8080`
* **Health Check**: `GET /healthz`
* **Features**: Dedicated IAM Task Role with Bedrock invocation policy, PostgreSQL `pgvector` access.

### 2. Dify AI Studio (`dify`)
* **Container Port**: `5001`
* **Health Check**: `GET /health`
* **Features**: Dedicated PostgreSQL database (`db_tenant_slug`), local Redis 7 sidecar for Celery queues.

### 3. n8n Automation (`n8n`)
* **Container Port**: `5678`
* **Health Check**: `GET /healthz`
* **Features**: Dedicated PostgreSQL schema (`tenant_slug`), workflow execution logs.

---

## Contributing a New Adapter

To add a new adapter for an AI agent runtime (e.g. Langflow, AutoGen, CrewAI, Flowise):

### Step 1: Copy Universal Adapter Template
Copy the boilerplate from `terraform/tenant_adapter_template.tf.example`:

```bash
cp terraform/tenant_adapter_template.tf.example terraform/adapters/crewai_adapter.tf
```

### Step 2: Configure Workload Variables
Define the container image, container port, and health check path:

```hcl
locals {
  workload_image = "crewai/studio:latest"
  container_port = 8000
  health_check_path = "/api/v1/health"
}
```

### Step 3: Wire Environment & Sidecars
If your framework requires caching, include the Redis sidecar block in the task definition:

```json
{
  "name": "redis-sidecar",
  "image": "redis:7-alpine",
  "essential": true,
  "memoryReservation": 128
}
```

### Step 4: Run Verification Tests
Verify that the provisioning test suite passes:

```bash
make test-provision WORKLOAD=crewai
```

Submit your pull request following the guidelines in [CONTRIBUTING.md](../CONTRIBUTING.md).
