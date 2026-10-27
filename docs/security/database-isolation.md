# Scoped Tenant Database Isolation

> [!WARNING]
> Multi-tenant applications must never grant workloads superuser privileges or shared schema access. TryBase isolates every tenant at the database permission layer.

---

## 1. The 2-Second Bootstrap Lambda

To prevent application containers from ever seeing the RDS master password, TryBase uses an ephemeral **Bootstrap Lambda** (`create-schema`):

1. **Triggered by Step Functions**: The Lambda executes exclusively during the provisioning workflow.
2. **Temporary Master Access**: The Lambda retrieves master credentials from AWS Secrets Manager in memory.
3. **Mints Scoped Tenant User**: Creates a dedicated PostgreSQL user and isolated schema.
4. **Destroys Connection**: The execution context terminates in under 2 seconds.

---

## 2. PostgreSQL Hardening Script

The bootstrap Lambda executes the following permission isolation statements:

```sql
-- 1. Create dedicated tenant user
CREATE USER user_tenant_slug WITH PASSWORD 'RANDOM_CRYPTOGRAPHIC_PASSWORD';

-- 2. Create isolated schema
CREATE SCHEMA tenant_slug AUTHORIZATION user_tenant_slug;

-- 3. Lock search path to tenant schema only
ALTER ROLE user_tenant_slug SET search_path TO tenant_slug;

-- 4. Revoke public schema access
REVOKE ALL ON SCHEMA public FROM user_tenant_slug;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM user_tenant_slug;

-- 5. Grant permissions strictly on tenant schema
GRANT ALL ON SCHEMA tenant_slug TO user_tenant_slug;
GRANT ALL ON ALL TABLES IN SCHEMA tenant_slug TO user_tenant_slug;
GRANT ALL ON ALL SEQUENCES IN SCHEMA tenant_slug TO user_tenant_slug;
```

---

## 3. Defense Against Cross-Tenant Queries

If an attacker executes an arbitrary SQL injection attack inside Tenant A's container:

```sql
-- Attacker attempts to list other tenant tables
SELECT * FROM information_schema.tables WHERE table_schema != 'tenant_slug';
```

PostgreSQL immediately returns an empty result set or permission denied. The tenant user physically cannot query, read, or modify tables outside their authorized schema.

---

[Next: Per-Tenant IAM Task Roles →](./iam-task-roles.md)
