# Custom Agent: Python & FastAPI

> [!TIP]
> This guide provides a complete, production-grade Python agent using FastAPI, `boto3` for keyless Bedrock inference, and `psycopg2` for pgvector semantic search.

---

## 1. Application Code (`main.py`)

```python
import os
import json
import boto3
import psycopg2
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="TryBase Python Agent")

# 1. Keyless Bedrock Client: Zero credentials in code or environment!
# boto3 automatically queries http://169.254.170.2 for short-lived STS tokens
bedrock = boto3.client("bedrock-runtime", region_name=os.getenv("AWS_REGION", "eu-west-2"))

# 2. Database Connection using environment variables passed from Fargate
def get_db_connection():
    return psycopg2.connect(
        host=os.environ.get("DB_HOST"),
        port=int(os.environ.get("DB_PORT", 5432)),
        dbname=os.environ.get("DB_NAME"),
        user=os.environ.get("DB_USER"),
        password=os.environ.get("DB_PASSWORD"),
        sslmode="require"
    )

class ChatRequest(BaseModel):
    prompt: str
    session_id: str = "default"

@app.post("/v1/chat")
def chat(req: ChatRequest):
    try:
        # Step A: Query tenant semantic memory from pgvector
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Generate prompt embedding via Amazon Titan
            emb_body = json.dumps({"inputText": req.prompt})
            emb_resp = bedrock.invoke_model(
                modelId="amazon.titan-embed-text-v1",
                body=emb_body
            )
            embedding = json.loads(emb_resp["body"].read())["embedding"]

            # Cosine similarity search in tenant schema
            cur.execute("""
                SELECT content, 1 - (embedding <=> %s::vector) AS score
                FROM agent_memories
                ORDER BY embedding <=> %s::vector
                LIMIT 3;
            """, (embedding, embedding))
            memories = [row[0] for row in cur.fetchall()]
        conn.close()

        # Step B: Generate inference with Claude 3.5 Sonnet
        context = "\n".join(memories)
        system_prompt = f"Relevant context:\n{context}\n\nAnswer the user's question accurately."

        payload = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1024,
            "system": system_prompt,
            "messages": [{"role": "user", "content": req.prompt}]
        })

        response = bedrock.invoke_model(
            modelId="anthropic.claude-3-5-sonnet-20240620-v1:0",
            body=payload
        )
        result = json.loads(response["body"].read())
        return {"reply": result["content"][0]["text"]}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/healthz")
def healthcheck():
    return {
        "status": "healthy",
        "engine": "trybase-fargate-graviton",
        "region": os.getenv("AWS_REGION", "eu-west-2")
    }
```

---

## 2. Dockerfile (ARM64 Optimized)

```dockerfile
FROM --platform=linux/arm64 python:3.11-slim

WORKDIR /app

# Install system dependencies for psycopg2 and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run unprivileged user for security
USER 1000:1000

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8080/healthz || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

---

[Next: Custom Agent: TypeScript & Node →](./typescript-agent.md)
