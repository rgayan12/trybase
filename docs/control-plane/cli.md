# Makefile & CLI Cheatsheet

> [!NOTE]
> All primary platform tasks are exposed through unified Make targets for consistent local and CI/CD execution.

---

## Command Reference

| Make Target | Description | Example Usage |
| :--- | :--- | :--- |
| `make check-env` | Verifies local dependencies (`terraform`, `aws`, `docker`, `jq`) | `make check-env` |
| `make bootstrap` | Sets up remote S3 state bucket and DynamoDB state lock table | `make bootstrap` |
| `make cost` | Runs Infracost pre-deploy cloud bill estimation | `make cost` |
| `make infra` | Applies Terraform configuration to stand up all cloud resources | `make infra` |
| `make control-plane` | Applies Supabase migrations and Edge orchestration functions | `make control-plane` |
| `make sync-tenants` | Re-synchronizes active ECS tasks with database state | `make sync-tenants` |
| `make test-provision`| Dispatches a test provisioning event for a workload archetype | `make test-provision WORKLOAD=agent` |
| `make teardown-test` | Destroys test tenant services and releases ALB priority rules | `make teardown-test` |
| `make destroy` | Tears down cloud resources with automatic ENI retries | `make destroy` |

---

## CLI Debugging Commands

### Inspect Active ECS Tasks
```bash
aws ecs list-tasks --cluster trybase-production-cluster --region eu-west-2
```

### Stream Task Logs from CloudWatch
```bash
aws logs tail /ecs/trybase-fast-sam-soars --follow --region eu-west-2
```

### Query Active ALB Listener Rules
```bash
aws elbv2 describe-rules --listener-arn <LISTENER_ARN> --region eu-west-2
```

---

[Back to Documentation Index →](../README.md)
