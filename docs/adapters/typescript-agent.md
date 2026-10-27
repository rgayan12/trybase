# Custom Agent: TypeScript & Node

> [!NOTE]
> This guide demonstrates how to build a high-performance TypeScript agent with streaming inference using `@aws-sdk/client-bedrock-runtime` on AWS Fargate Graviton.

---

## 1. Application Code (`src/server.ts`)

```typescript
import express, { Request, Response } from "express";
import { 
  BedrockRuntimeClient, 
  InvokeModelWithResponseStreamCommand 
} from "@aws-sdk/client-bedrock-runtime";

const app = express();
app.use(express.json());

// AWS SDK automatically resolves credentials from the link-local STS agent
const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "eu-west-2"
});

// Streaming Chat Endpoint (Server-Sent Events)
app.post("/v1/chat/stream", async (req: Request, res: Response) => {
  const { prompt } = req.body;

  if (!prompt) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const command = new InvokeModelWithResponseStreamCommand({
      modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
      contentType: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const response = await bedrock.send(command);

    if (response.body) {
      for await (const chunk of response.body) {
        if (chunk.chunk?.bytes) {
          const parsed = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
          if (parsed.type === "content_block_delta" && parsed.delta?.text) {
            res.write(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`);
          }
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// Health check endpoint for ALB target group
app.get("/healthz", (_, res) => {
  res.json({ status: "healthy", runtime: "node-arm64" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`TryBase TypeScript agent listening on port ${PORT}`);
});
```

---

## 2. Dockerfile

```dockerfile
FROM --platform=linux/arm64 node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM --platform=linux/arm64 node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

USER node
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8080/healthz || exit 1

CMD ["node", "dist/server.js"]
```

---

[Next: Adapter: Dify AI Studio →](./dify.md)
