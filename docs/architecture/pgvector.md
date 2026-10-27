# Vector Memory & pgvector Subsystem

> [!NOTE]
> TryBase utilizes RDS PostgreSQL 16.3 with the native `pgvector 0.7.0` extension to provide high-speed, isolated semantic memory for autonomous agents.

---

## 1. Why PostgreSQL + pgvector?

Autonomous agents require both **structured relational state** (user profiles, audit logs, tool execution history) and **unstructured semantic memory** (document embeddings, semantic search).

Deploying a standalone vector database (such as Pinecone, Milvus, or Qdrant) alongside a relational database creates:
* Dual billing ($$$)
* Distributed transaction failures (relational write succeeds, vector upsert fails)
* Operational synchronization lag

`pgvector` solves this by co-locating relational records and vector embeddings in the exact same ACID-compliant database transaction.

---

## 2. Multi-Tenant Schema Isolation

Rather than provisioning a separate RDS database instance for every tenant, TryBase provisions **isolated PostgreSQL schemas**:

```sql
-- Executed automatically during tenant provisioning
CREATE SCHEMA tenant_fast_sam_soars;

CREATE TABLE tenant_fast_sam_soars.agent_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536), -- 1,536 dimensions for Claude/Titan/OpenAI
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW Vector Index for sub-5ms cosine similarity search
CREATE INDEX ON tenant_fast_sam_soars.agent_memories 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

---

## 3. High-Performance HNSW Indexing

TryBase uses **HNSW (Hierarchical Navigable Small World)** graphs over legacy IVFFlat indexes:

| Metric | IVFFlat Index | HNSW Index (TryBase Default) |
| :--- | :--- | :--- |
| **Search Latency (P95)** | ~25ms | **< 4.8ms** |
| **Recall Accuracy** | ~85% - 90% | **> 98.5%** |
| **Index Build Time** | Requires pre-training | Dynamic real-time graph updates |
| **Data Size Threshold** | Degrades under small datasets | High recall at any dataset size |

### Querying Tenant Memory

```sql
SELECT id, content, 1 - (embedding <=> $1) AS similarity
FROM tenant_fast_sam_soars.agent_memories
WHERE session_id = 'session-123'
ORDER BY embedding <=> $1
LIMIT 5;
```

---

[Next: In-Task Redis Sidecar Pattern →](./redis-sidecar.md)
