# Hyperscaler Topology

> [!NOTE]
> TryBase organizes cloud infrastructure into three isolated tiers: Public Edge Ingress, Private Compute Fleet, and Scoped Vector Data.

---

## 1. End-to-End Architectural Diagram

```mermaid
graph TD
    Client["Client / Agent Invocations"] -->|HTTPS / Port 443| Route53["Amazon Route 53 (Wildcard DNS)"]
    Route53 --> ALB["AWS Application Load Balancer (*.trybase.io)"]
    
    subgraph VPC ["AWS VPC: 10.0.0.0/16"]
        subgraph PublicSubnets ["Public Ingress Tier (Multi-AZ)"]
            ALB
            NAT1["NAT Gateway (AZ 1)"]
            NAT2["NAT Gateway (AZ 2)"]
        end
        
        subgraph PrivateWorkloads ["Private Workload Tier (0 Public IPs)"]
            subgraph MicroVM_1 ["MicroVM: fast-sam-soars"]
                Agent1["Custom Agent Container (FastAPI)"]
                Redis1["Redis Sidecar (127.0.0.1:6379)"]
                Agent1 <-->|awsvpc Loopback| Redis1
            end
            
            subgraph MicroVM_2 ["MicroVM: blue-fox-runs"]
                Dify2["Dify Studio Container"]
                Redis2["Redis Sidecar (127.0.0.1:6379)"]
                Dify2 <-->|awsvpc Loopback| Redis2
            end
        end
        
        subgraph PrivateData ["Private Database Tier (Isolated Subnets)"]
            RDS[("Graviton RDS PostgreSQL 16.3")]
            Schema1[("Schema: fast_sam_soars (pgvector)")]
            Schema2[("Database: db_blue_fox_runs")]
            RDS --- Schema1
            RDS --- Schema2
        end
    end
    
    ALB -->|Host: fast-sam-soars.agent.*| Agent1
    ALB -->|Host: blue-fox-runs.dify.*| Dify2
    
    Agent1 -->|Scoped IAM Auth| Schema1
    Dify2 -->|Scoped User Auth| Schema2
    
    Agent1 -.->|Link-Local STS 169.254.170.2| Bedrock["Amazon Bedrock (Claude 3.5 Sonnet)"]
```

---

## 2. Infrastructure Flow Breakdown

### 1. Ingress Request Journey
1. Inbound HTTPS traffic reaches the **Application Load Balancer** on TCP port 443.
2. The wildcard ACM certificate (`*.trybase.yourdomain.com`) terminates TLS.
3. The ALB evaluates host-header listener rules (e.g. `fast-sam-soars.agent.trybase.yourdomain.com`).
4. Traffic is forwarded over private subnets directly to the target Fargate task's private IP.

### 2. Compute Execution
1. The container runs on an **AWS Fargate Graviton ARM64 MicroVM**.
2. Outbound internet access (for webhooks or LLM APIs) routes through the **AWS NAT Gateway**.
3. Internal cache calls communicate with the local **Redis sidecar** over `127.0.0.1:6379` at 0.05ms latency.

### 3. Data & LLM Invocations
1. Foundation model inferences (Claude 3.5, Titan, Llama 3) invoke **Amazon Bedrock** keylessly via the link-local STS endpoint (`169.254.170.2`).
2. Vector embeddings and conversation history are read and written to **PostgreSQL 16.3 with pgvector 0.7** using dedicated tenant schemas.

---

[Next: Private VPC & Network Boundaries →](./networking.md)
