# Scale-to-Zero Architecture

> [!NOTE]
> Autonomous agents that execute periodic automations, webhooks, or batch tasks waste compute while standing idle. TryBase supports automated scale-to-zero.

---

## 1. The Scale-to-Zero Lifecycle

```mermaid
sequenceDiagram
    participant Traffic as Inbound Traffic
    participant ALB as Application Load Balancer
    participant Alarm as CloudWatch Alarm
    participant SFN as Step Functions
    participant ECS as ECS Fargate Service

    Note over ECS: Workload is Active (Desired Count = 1)
    Traffic->>ALB: No requests for 30 minutes
    ALB->>Alarm: RequestCountPerTarget == 0
    Alarm->>SFN: Trigger Scale-to-Zero Task
    SFN->>ECS: UpdateService (Desired Count = 0)
    Note over ECS: Workload Suspended ($0.00 compute cost)

    Traffic->>ALB: New Inbound HTTP Request
    ALB->>SFN: Route to Rehydration Lambda
    SFN->>ECS: UpdateService (Desired Count = 1)
    ECS-->>ALB: Container Healthy (HTTP 200 in 850ms)
    ALB->>Traffic: Forward Request to MicroVM
```

---

## 2. Rehydration Performance

Because AWS Fargate with Graviton uses **Firecracker MicroVMs**, cold start times are drastically lower than standard EC2 instances:

| Metric | Legacy EC2 Node Boot | Fargate Firecracker MicroVM |
| :--- | :--- | :--- |
| **Kernel Boot Time** | ~45 - 90 seconds | **< 1.2 seconds** |
| **Container Initialization** | ~15 - 30 seconds | **~2.5 seconds** |
| **Health Check Ready** | ~60 - 120 seconds | **< 4.5 seconds** |

---

[Next: Provisioning REST API →](../control-plane/api.md)
