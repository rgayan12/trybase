# Architecture Manifesto: Why We Built TryBase

> [!NOTE]
> This manifesto explains the origin of TryBase, the frustration that sparked it, and why we are proposing a fundamentally different way to build and deploy applications in the AI era.

---

## 1. The Frustration: Building Production Systems the Hard Way

If you have built software for more than five minutes, you have probably run into the two most exhausting problems in cloud architecture:

### Problem 1: The "Multi-Tenancy Code Tax"
The moment you decide to serve multiple companies or clients from your application, the industry tells you to build multi-tenancy inside your code:
* You slap a `tenant_id` column on *every single database table* (`users`, `invoices`, `teams`, `documents`).
* You write complex global query scopes and middleware in Laravel, Django, or Express (`WHERE tenant_id = ?`).
* You live in constant anxiety that a junior developer or a rogue ORM query will accidentally omit a scope and leak Customer A’s private data to Customer B.
* You spend weeks configuring tenant-scoped cache keys, background worker queues, and custom logic instead of building features your users actually want.

### Problem 2: The Production `.env` File Lie
Every cloud tutorial teaches developers to decrypt production secrets into environment variables:
* An engineer accidentally runs `git add .` and commits production database passwords into GitHub history.
* A staging server with `DEBUG=True` crashes, and Django's yellow screen or Laravel's Ignition debugger prints the entire `os.environ` / `$_ENV` table to the browser.
* A compromised third-party npm or pip dependency runs `print(os.environ)` and silently exfiltrates your master AWS access keys and Stripe tokens to an attacker.
* A misconfigured Nginx rule exposes `https://app.com/.env` to automated bot scanners.

---

## 2. The Dilemma: Why Didn't We Just Use Single-Tenancy?

In an ideal world, every customer would get their own isolated environment:
* Customer A gets their own server.
* Customer A gets their own database.
* Customer A gets their own secret vault.
* If Customer A gets hacked, Customer B doesn't even exist in Customer A's universe.

**Why didn't everyone do this? Because historically, single-tenancy was an operational nightmare:**
1. **The Cost Barrier**: Running 50 separate EC2 servers, 50 RDS databases, and 50 load balancers cost **$5,000 to $10,000 every single month**. For an early-stage startup or agency, this was financial suicide.
2. **The Deployment Nightmare**: Pushing code updates meant running 50 separate deployments, managing 50 migration scripts, and SSH'ing into 50 boxes when something broke.

So the entire industry compromised. We gave up isolation, accepted the security risks of shared databases and `.env` files, and called it "modern SaaS."

**We decided to fix this.**

---

## 3. The Two Principles We Coined

TryBase is built around two fundamental architectural innovations:

### I. Virtual Single-Tenancy
> **Write your application like it is an internal tool for a single company. Let the infrastructure layer handle multi-tenancy.**

With Virtual Single-Tenancy:
* **In Application Code**: You write ordinary code. No `tenant_id` columns. No scoping middleware. Plain `SELECT * FROM users`.
* **In the Cloud**: TryBase automatically provisions dedicated, isolated **AWS Fargate Firecracker MicroVMs**, dedicated PostgreSQL schemas (`schema_acme`), and isolated AWS Secrets Manager vaults per tenant.
* **In Your Cloud Bill**: Instead of paying $5,000/month for separate infrastructure, everything runs on shared, highly efficient hyperscaler primitives (shared Graviton RDS cluster, shared ALB, scale-to-zero compute). Your baseline platform cost is **~$50 to $65/month total**.
* **In Deployments (Fleet GitOps)**: A single `git push` runs migrations across all 50 isolated customer schemas in parallel with canary safety.

---

### II. The Anti-Leak Standard
> **Never write plaintext `.env` files to production disk, and keep `process.env` completely empty.**

With the Anti-Leak Standard:
* **On Your Laptop**: You keep the convenience of your local `.env.production` file.
* **Pushing Secrets**: You run `trybase env push .env.production --tenant acme`. The CLI encrypts the values and stores them directly in the tenant's dedicated AWS Secrets Manager vault. No web UI forms, no plaintext files uploaded to servers.
* **In Container Runtime**:
  - The application container starts with **100% empty `process.env`**.
  - A 5MB lightweight Rust sidecar daemon (`trybase-daemon`) binds to a shared in-memory volume at `/var/run/trybase/secrets.sock`.
  - When the app boots, it connects over the Unix Domain Socket.
  - The Linux kernel directly informs the daemon of the caller's verified PID and UID using **`SO_PEERCRED`** (which cannot be forged, even by root in a container).
  - The daemon inspects `/proc/<pid>/exe` to ensure the caller is your legitimate app (e.g. `/usr/local/bin/php-fpm` or `python`), immediately blocking reverse shells, `/bin/bash`, or `curl`.
  - The daemon serves secrets **directly into application RAM** and issues an ephemeral **15-minute AWS STS / RDS IAM database auth token**.

Even if an attacker gains arbitrary code execution inside your container, **there are no `.env` files on disk to read, no persistent database passwords, and no static AWS access keys.**

---

## 4. What We Are Proposing to Anyone Writing Applications

Whether you are building in **Laravel, Django, Python, Go, Node.js, or creating autonomous AI agents**:

1. **Stop writing multi-tenancy code into your models**: Let your app be simple, maintainable, and clean.
2. **Stop copying `.env` files to production servers**: Treat secrets as ephemeral runtime memory, not static disk artifacts.
3. **Give AI Agents real sandboxes with teeth**: Let agents execute code inside isolated MicroVMs without giving them keys that can destroy your AWS account.
4. **Embrace Autonomous SRE via MCP**: Let AI assistants (Claude, Cursor) monitor container logs, take backups, and scale resources over the Model Context Protocol.

TryBase is the open-source bridge between the simplicity of single-tenant software and the power of multi-tenant cloud infrastructure.

---

[Next: The Anti-Leak Standard Deep Dive →](./anti-leak-standard.md)
