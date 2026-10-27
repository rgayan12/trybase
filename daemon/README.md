# TryBase Anti-Leak Secret Daemon (`trybase-daemon`)

> **The Hardware-Isolated, Zero-Static-Secret Engine for Autonomous AI Agents**

The `trybase-daemon` is an ultra-lean systems security sidecar written in **Rust** (~4MB static binary, ~3MB runtime memory). It implements the **Anti-Leak Standard** across AWS Fargate Firecracker MicroVMs.

---

## 🛡️ Core Security Guarantees

1. **Zero `.env` Files on Disk**: Containers launch with completely empty `process.env`. Secrets exist solely in locked RAM buffers (`mlock`).
2. **Kernel Identity Verification (`SO_PEERCRED`)**: Communicates exclusively via Linux Unix Domain Sockets (`/var/run/trybase/secrets.sock`). The Linux kernel directly informs the daemon of the caller's PID, UID, and GID. Even root inside a compromised container cannot spoof these values.
3. **Binary Inspection (`/proc/<pid>/exe`)**: Resolves the calling executable. Probes from `/bin/bash`, `curl`, `wget`, `nc`, or reverse shells are dropped immediately with a security incident alert.
4. **IMDSv2-Style Handshake**: Requires a `PUT /latest/api/token` request with `X-TryBase-Token-TTL-Seconds`. Strictly rejects any `X-Forwarded-*` headers, neutralizing Server-Side Request Forgery (SSRF) and proxy injection attacks.
5. **Passwordless PostgreSQL (RDS IAM)**: Mints ephemeral 15-minute STS database passwords (`GET /latest/database/token`), eliminating static database passwords from container memory and logs.

---

## 📡 REST over Unix Domain Socket Protocol

| Method | Endpoint | Headers Required | Description |
| :--- | :--- | :--- | :--- |
| `PUT` | `/latest/api/token` | `X-TryBase-Token-TTL-Seconds: 60` | Issues an unforgeable IMDSv2 token bound to caller's kernel PID/UID. |
| `GET` | `/latest/secrets` | `X-TryBase-Token: <token>` | Returns all tenant secrets as JSON into application memory. |
| `GET` | `/latest/secrets/:key` | `X-TryBase-Token: <token>` | Returns a specific secret value as plain text. |
| `GET` | `/latest/database/token`| `X-TryBase-Token: <token>` | Generates an ephemeral 15-minute RDS IAM password token. |
| `GET` | `/healthz` | None | Daemon health check. |

---

## 🚀 Two Integration Paths

### 1. Zero-Code Injected Wrapper (`trybase-entrypoint`)
For unmodified open-source containers (n8n, Dify, OpenClaw):
```dockerfile
# In your Dockerfile:
COPY --from=trybase/daemon:latest /usr/local/bin/trybase-entrypoint /usr/local/bin/
ENTRYPOINT ["/usr/local/bin/trybase-entrypoint"]
CMD ["php-fpm"]
```

### 2. Native SDK Integration (In-Memory Boot)
* **Laravel (PHP)**: Add `App\Providers\TryBaseServiceProvider::class` in `config/app.php`.
* **Django (Python)**: Use `from trybase_secrets import load_secrets` in `settings.py`.
* **Go**: Use `trybase.NewClient().GetSecrets()`.
* **Node.js**: Use `import { loadSecrets } from '@trybase/sdk'`.

---

## 📦 Building the Daemon

```bash
# Multi-stage Docker build producing a ~4MB scratch container
docker build -t trybase/daemon:latest daemon/
```
