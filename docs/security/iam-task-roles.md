# Per-Tenant IAM Task Roles

> [!NOTE]
> In TryBase, every workload receives an isolated AWS IAM Task Role. Shared IAM roles across multiple customer workloads are strictly prohibited.

---

## 1. Why Dedicated Task Roles Matter

In standard cloud setups, all containers in an ECS cluster share a single IAM Execution Role. If Tenant A requires access to Bedrock and Tenant B requires access to an S3 bucket, both tenants receive permissions for both resources.

TryBase provisions a **dedicated IAM Task Role per tenant**:

```hcl
resource "aws_iam_role" "tenant_task_role" {
  name = "trybase-${var.tenant_id}-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}
```

---

## 2. Least-Privilege Policy Boundaries

Permissions are scoped strictly to the tenant's operational needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowKeylessBedrockInvocation",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:eu-west-2::foundation-model/anthropic.claude-3-5-sonnet-*"
    },
    {
      "Sid": "AllowIsolatedTenantS3Storage",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::trybase-workload-artifacts/${var.tenant_id}/*"
    }
  ]
}
```

---

## 3. Non-Repudiable CloudTrail Auditing

Every foundation model invocation, S3 upload, or STS token generation is recorded in **AWS CloudTrail**:

```json
{
  "eventTime": "2026-10-27T01:15:00Z",
  "eventName": "InvokeModel",
  "eventSource": "bedrock.amazonaws.com",
  "userIdentity": {
    "type": "AssumedRole",
    "arn": "arn:aws:sts::656876168893:assumed-role/trybase-fast-sam-soars-task-role/task-id"
  },
  "sourceIPAddress": "10.0.10.142"
}
```

Security teams can audit exact token consumption and tool usage per tenant with complete non-repudiation.

---

[Next: Workload Adapter Specification →](../adapters/specification.md)
