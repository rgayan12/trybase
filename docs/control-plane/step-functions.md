# AWS Step Functions Orchestrator

> [!NOTE]
> TryBase manages the provisioning lifecycle as a durable, asynchronous state machine orchestrated by AWS Step Functions.

---

## 1. State Machine Topology

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

---

## 2. Execution States

1. **Parameter Validation**: Verifies that the `tenant_id` does not conflict with existing workloads and that `alb_listener_rule_priority` is within the valid range.
2. **Schema Bootstrap (`create-schema`)**: Ephemeral Lambda connects to PostgreSQL, creates the schema, and provisions scoped user credentials.
3. **IAM Task Role Minting**: Generates the tenant's dedicated IAM execution and task roles.
4. **Task Registration**: Registers the multi-container Fargate task definition with Graviton ARM64 architecture.
5. **ALB Wiring**: Creates the target group and binds the Host-header listener rule.
6. **Service Launch**: Starts the ECS Fargate service in the private subnet.
7. **Health Polling**: Polls the target group every 10 seconds until `HTTP 200` is returned.
8. **Realtime Broadcast**: Updates the workspace status in Supabase to `active`, immediately alerting the web console.

---

[Next: Database Schema & Realtime State →](./database.md)
