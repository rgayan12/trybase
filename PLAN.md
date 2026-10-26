# Project Plan: Multi-Tenant n8n Hosting SaaS

This document tracks the development plan, our current progress, and the strategic positioning for the business.

## Phase 1: Minimum Viable Product (MVP) - [COMPLETED]

**Goal:** Create a functioning system that can automatically provision and de-provision a dedicated n8n instance for a new tenant.

### Key Steps
- [x] **1. Initial Design & Scoping:** Architecture decided (Shared VPC, Fargate per tenant).
- [x] **2. Project & Terraform Setup:** Modules created, remote state locked in S3.
- [x] **3. Develop Shared Infrastructure:** VPC, ALB, and RDS Postgres online.
- [x] **4. Develop Tenant Module:** ECS Service, IAM roles, and target groups.

## Phase 2: Automation & Production Hardening - [COMPLETED]

**Goal:** Remove humans from the loop. A tenant must be provisioned instantly via an API call.

- [x] **5. Automate Tenant Provisioning Pipeline**
  - [x] Designed AWS Step Functions orchestrator.
  - [x] Created `create-schema` Lambda (fixed arm64 architecture for Graviton performance).
  - [x] Created CodeBuild pipeline to dynamically inject `tenant_id` and unique encryption keys into Terraform.
  - [x] Exposed `POST /provision` via API Gateway.
- [x] **6. End-to-End Verification**
  - [x] Successfully dispatched provisioning for `neat-byte-spins`.
  - [x] Verified full handshake: Browser -> API -> Step Function -> RDS Schema -> Supabase Notification.

## Phase 3: Marketing & Frontend UX - [COMPLETED]

**Goal:** Create a high-converting front door that targets B2B/agencies and accurately prices the underlying AWS isolation.

- [x] **7. Brand & Strategy Setup**
  - [x] Confirmed premium positioning strategy. Focus heavily on Fargate container isolation and dedicated DB schemas vs. "shared hosting" alternatives.
- [x] **8. Build the Landing Page**
  - [x] Created React + Vite single-page app in `nexscale-web/`.
  - [x] Styled cinematic dark-mode glassmorphism UI with mobile-responsive navigation.
  - [x] Built the "Cinematic Flow Demo" showing live provisioning steps.
- [x] **9. Go-To-Market Pricing Strategy**
  - [x] Implemented a **"Trust Ramp"** strategy based on PLG economics.
  - [x] 7-Day Free Trials with countdown timer urgency.

## Phase 4: Production Polish & Security - [COMPLETED]

**Goal:** Shield the provisioning API from abuse and ensure a snappy, "instant" user experience.

- [x] **10. Dashboard Experience**
  - [x] Implemented **Optimistic UI Updates** in the dashboard. The workspace claims its ID and shows the provisioning terminal instantly.
  - [x] Added "Targeted Provisioning" to ensure license slots are mapped correctly to infrastructure.
- [x] **11. Infrastructure Security & Fixes**
  - [x] Implemented Independent Encryption Key generation per tenant in CodeBuild.
  - [x] Relaxed Lambda validation to support hyphenated IDs (e.g., `cloud-data-flows`).
  - [x] Hardened Supabase RLS policies to allow authenticated user updates.
  - [x] Fixed Realtime subscription racing issues during React Strict Mode re-mounts.

## Phase 5: Go-Live Checklist - [COMPLETED]

- [x] **12. Final Control Plane Lockdown & Fixes**
  - [x] **Realtime Fix**: Enable `workspaces` in the `supabase_realtime` publication.
  - [x] **Email Fix**: Ensure `RESEND_API_KEY` is set in Supabase Secrets (`supabase secrets set`).
  - [x] Re-enable the JWT Authorizer in `apigateway.tf`.
  - [x] Add rate-limiting to the `$default` stage in API Gateway.
- [x] **13. Deployment & Launch**
  - [x] Deploy static frontend to Vercel/Netlify.
  - [x] Link production domain (`trybase.io`).
  - [x] Post to communities (Indie Hackers, Product Hunt, Reddit).

## Phase 6: Autonomous AI Agent Platform & Open-Source Launch - [ACTIVE]

**Goal:** Expand TryBase beyond single-purpose automation into the premier open-source cloud infrastructure engine for autonomous AI agents and workflows.

* 📋 **Architecture & Moats**: Fully documented in [`adhoc/design-notes.md`](adhoc/design-notes.md).
* 📋 **Launch Roadmap & Execution**: Fully tracked in [`ROADMAP.md`](ROADMAP.md).
* [x] **Workload Archetype Battery**: Verified `hello`, `agent` (link-local STS Bedrock), `n8n` (schema-per-tenant), and `dify` (dedicated DB, `pgvector`, Redis sidecar).
* [x] **Teardown Automation**: Automated `make clean-test-tenants` (purging 85 test resources cleanly).
* [x] **Adapter Contribution Guide**: Standardized specification in `CONTRIBUTING.md` and `terraform/tenant_adapter_template.tf.example`.
* [ ] **Public Launch Package**: Overhaul `readme.md` and build the `openclaw` adapter.
* [ ] **Core Product Moats**: Implement TryBase MCP Server, Live CloudWatch Log Streaming, and `SO_PEERCRED` Zero-Env Secret Daemon.

---

> [!NOTE]
> For active engineering priorities and milestone tracking, refer to [`ROADMAP.md`](ROADMAP.md).
