# Deprovisioning Tenants (Manual Process)

As of Launch Phase 1, the infrastructure destruction process is **manual**. The automated Step Functions and CodeBuild pipelines are currently optimized for **provisioning only** to ensure maximum safety and prevent accidental deletion of production workloads.

## Why it is manual
- **Safety**: Automated destruction pipelines carry the risk of accidental triggers.
- **Data Retention**: Manual deprovisioning ensures you have a chance to back up or verify data before the final "purge".
- **RDS Schema**: The current `provision_tenant` logic creates a specific Postgres schema; destroying the infrastructure via Terraform preserves the shared RDS but requires a manual `DROP SCHEMA` to fully clean up.

## Quick Teardown for Test Tenants

To automatically tear down ephemeral test tenants created by `make test-provision` without touching the core infrastructure:

```bash
# Tear down all test-* tenants in one command:
make clean-test-tenants

# Or tear down a specific tenant:
./teardown-test-tenants.sh test-dify-5902
```

This command synchronizes the tenant configurations from S3, executes a targeted `terraform destroy` against the test modules, and cleans up both local and remote S3 configuration files.

## Step-by-Step Manual Deprovisioning (Production Tenants)

### 1. Destroy Infrastructure (Terraform)
Navigate to the terraform directory on a machine with AWS access and target the specific tenant module.

```bash
cd terraform
# Replace <TENANT_ID> with the actual slug (e.g., cloud-sam-beans)
terraform destroy -target="module.<TENANT_ID>"
```

> [!TIP]
> **If Terraform hangs** at the "Still destroying... [id=subnet-..., id=sg-...]" phase for more than 5 minutes, it is likely blocked by an orphaned ENI. Run the cleanup script from the root directory:
> `./cleanup-enis.sh`


### 2. Cleanup Database Schema
Since we use a shared RDS instance, Terraform will not automatically drop the Postgres schema. You must connect to the RDS instance (via the Bastion host) and run:

```sql
DROP SCHEMA "<TENANT_ID>" CASCADE;
```

### 3. Archive Configuration
Once destruction is confirmed, manually delete the auto-generated `.tf` file to keep the directory clean:

```bash
rm terraform/tenant_<TENANT_ID>.tf
```

---

> [!IMPORTANT]
> **Phase 2 Roadmap**: We plan to implement a `deprovision-tenant` Step Function that automates these steps after a 30-day "Suspended" grace period.
