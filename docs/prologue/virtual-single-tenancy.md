# Virtual Single-Tenancy: The Death of the `tenant_id` Column

> [!NOTE]
> **Virtual Single-Tenancy** is the design pattern where application developers write simple, single-tenant code (zero `tenant_id` database columns or query scoping middleware), while the underlying infrastructure platform orchestrates dedicated hardware-isolated microVMs, scoped database schemas, and isolated secret vaults per tenant.

---

## 1. The Multi-Tenancy Lie

For over 15 years, SaaS architecture books, blog posts, and cloud tutorials have preached one universal dogma:

> *"Put a `tenant_id` on every table. Add tenant middleware. Filter every query."*

This approach—**Application-Level Multi-Tenancy**—is fundamentally broken for three reasons:

```
APPLICATION-LEVEL MULTI-TENANCY (THE TRADITIONAL SAAS TRAP)
┌─────────────────────────────────────────────────────────────┐
│  One Shared Application Instance                           │
│  - Leaky middleware setting tenant context in request state │
│  - Every query requires: WHERE tenant_id = ?                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  One Giant Shared PostgreSQL Database                       │
│  - Table: users (all customers intermingled)                │
│  - Table: orders (all customers intermingled)               │
│  - Table: payments (all customers intermingled)             │
│                                                             │
│  🚨 ONE missed query scope = Customer A sees Customer B     │
│  🚨 ONE heavy query = Noisy neighbor locks database for all │
│  🚨 ONE customer wants backup = Impossible surgical recovery │
└─────────────────────────────────────────────────────────────┘
```

1. **The Human Vulnerability**: No engineering team is immune to mistakes. A single missed `where('tenant_id', ...)` in a complex join, a forgotten global scope in an ORM migration, or an unvetted background job leaks customer data.
2. **The Noisy Neighbor Catastrophe**: If an enterprise customer runs a massive CSV export or an expensive vector query, the shared database CPU spikes to 100%, degrading performance for every other customer on the platform.
3. **Disaster Recovery Nightmare**: If Customer A accidentally deletes their team's data and asks for a restore, the platform team cannot simply restore last night's database backup—because doing so would rewind the clock for all other 500 customers! Teams must write complex, risky surgical SQL recovery scripts.

---

## 2. Virtual Single-Tenancy: How It Works

Instead of forcing developers to manage tenancy in code, **TryBase makes multi-tenancy a native infrastructure primitive**:

```
                       VIRTUAL SINGLE-TENANCY IN TRYBASE
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        ▼                                                             ▼
  acme.yourplatform.com                               wayne.yourplatform.com
        │                                                             │
        ▼ Host-Header ALB Route                                       ▼ Host-Header ALB Route
┌───────────────────────────────┐             ┌───────────────────────────────┐
│ Container: acme-corp          │             │ Container: wayne-enterprises  │
│ - Dedicated Fargate MicroVM   │             │ - Dedicated Fargate MicroVM   │
│ - Standard single-tenant code │             │ - Standard single-tenant code │
│ - ZERO `tenant_id` columns    │             │ - ZERO `tenant_id` columns    │
│ - Secret Vault: secrets/acme  │             │ - Secret Vault: secrets/wayne │
└───────────────┬───────────────┘             └───────────────┬───────────────┘
                │ IAM Role: role_acme                         │ IAM Role: role_wayne
                ▼                                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ SHARED GRAVITON RDS POSTGRESQL (WITH NATIVE PGVECTOR)                       │
│                                                                             │
│  ┌─────────────────────────┐               ┌─────────────────────────────┐  │
│  │ Schema: "schema_acme"   │               │ Schema: "schema_wayne"      │  │
│  │ - Users (no tenant_id)  │               │ - Users (no tenant_id)      │  │
│  │ - Orders                │               │ - Orders                    │  │
│  │ - Invoices              │               │ - Invoices                  │  │
│  │ Owned by: user_acme     │               │ Owned by: user_wayne        │  │
│  └─────────────────────────┘               └─────────────────────────────┘  │
│                                                                             │
│  🛡️ Physical Cryptographic Isolation: user_acme cannot read schema_wayne    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The 5 Superpowers of Virtual Single-Tenancy

### 1. Write Clean Code Again
* Your database tables are simple: `CREATE TABLE users (id, name, email)`.
* Your ORM queries are clean: `User::all()` or `User.objects.all()`.
* You eliminate hundreds of lines of fragile multi-tenant middleware, context managers, and tenant resolution hacks.

### 2. Cryptographic Blast-Radius Containment
* Customer A’s container runs with its own dedicated AWS IAM Task Role.
* Customer A’s database user (`user_acme`) only has permissions on `schema_acme`.
* Even if an attacker achieves root remote code execution inside Customer A’s container, **they physically cannot query, read, or alter Customer B’s database schema.**

### 3. True 1-Click Tenant Disaster Recovery
* Backing up a customer is as simple as: `pg_dump -n schema_acme | gzip > s3://backups/acme.sql.gz`.
* Restoring Customer A takes 5 seconds and has **zero impact** on Wayne Enterprises or any other tenant on the cluster.

### 4. Fleet GitOps & Parallel Migrations
* When you push code updates (`git push origin main`), the TryBase Step Functions orchestrator uses AWS Distributed Map to run migrations across all tenant schemas in parallel with canary rings.
* If a migration fails on one tenant, that tenant is isolated and alerted without stalling or breaking the rest of your fleet.

### 5. Multi-Tenant Economics ($50/mo vs $5,000/mo)
* Traditional single-tenancy required 50 separate EC2 servers and 50 separate RDS databases, costing thousands of dollars per month.
* In TryBase, all tenant microVMs and schemas share the same underlying hyperscaler primitives (shared Graviton RDS cluster, shared ALB, scale-to-zero compute).
* Your baseline cost for the entire platform is **~$50 to $65/month**.

---

[Next: The Anti-Leak Standard →](./anti-leak-standard.md)
