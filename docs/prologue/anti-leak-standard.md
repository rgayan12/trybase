# The Anti-Leak Standard

> [!WARNING]
> Encrypting secrets at rest in AES-256 does not protect an application if secrets are decrypted into environment variables at runtime. When a container suffers a shell escape or remote code execution, static secrets are exfiltrated instantly.

---

## 1. Deconstructing Modern Cloud Breaches

In major platform security breaches (such as the 2026 Railway incident), organizations possessed robust database encryption at rest. Master secrets, third-party API keys, and IAM credentials were stored securely in encrypted databases.

However, the architecture contained a critical vulnerability: **Runtime Environment Injection**.

```
[Encrypted Database (AES-256)]
              │
              ▼ (Decrypted at startup)
[Plaintext Environment Variables (env)]
              │
              ▼
[Compromised Web / Agent Process] ──> Attackers execute: "env > /tmp/keys.txt"
                                      Attackers obtain: permanent AWS & DB credentials
```

When an attacker achieved Remote Code Execution (RCE) through an unpatched dependency or prompt injection vulnerability, they executed standard Linux introspection commands (`env`, `cat /proc/1/environ`, or `export`). The attacker immediately exfiltrated permanent AWS IAM Access Keys (`AKIA...`), database master passwords, and production API tokens.

Because these credentials were long-lived and broad in scope, the breach cascaded across the entire platform infrastructure.

---

## 2. The TryBase Anti-Leak Invariant

TryBase solves this vulnerability by establishing the **Anti-Leak Invariant**:

> **No persistent cloud credentials or master database passwords may ever be injected into application container environment variables.**

Instead of storing secrets in the environment, TryBase enforces short-lived, ephemeral credential minting at the kernel and hypervisor boundary:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TRYBASE ANTI-LEAK ARCHITECTURE                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  1. Container starts with ZERO AWS credentials in environment.         │
│  2. Application SDK initiates call to Amazon Bedrock or S3.            │
│  3. SDK queries link-local agent: http://169.254.170.2/credentials     │
│  4. AWS STS issues short-lived ASIA... token (valid 60 minutes).       │
│  5. Token is held solely in volatile memory and rotated automatically. │
│  6. Even with a full shell dump, attackers find ZERO persistent keys.  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Comparative Architecture

| Security Dimension | Traditional PaaS Hosting | TryBase Anti-Leak Standard |
| :--- | :--- | :--- |
| **Credential Storage** | Plaintext environment variables (`.env`) | Ephemeral in-memory STS tokens |
| **Credential Lifetime** | Permanent (months / years) | **60 minutes** (silent automatic rotation) |
| **Database Authentication** | Static plaintext master password | Temporary 15-minute IAM auth tokens |
| **Blast Radius of RCE** | Full platform AWS account compromise | Sandboxed to single microVM with expiring tokens |
| **Local Daemon Exposure** | Open `127.0.0.1:9000` TCP ports | Unix Domain Sockets with `SO_PEERCRED` UID checks |
| **Network IP Exposure** | Public IP per container | **0 Public IPs** (100% private VPC subnets) |
| **Audit Trails** | Generic shared credentials | Per-tenant IAM Task Role CloudTrail logs |

---

## 4. Defending Against Container Shell Escapes

Consider a scenario where an autonomous agent container suffers an unhandled buffer overflow or arbitrary shell execution:

```bash
# Attacker dumps environment variables
env
```

Output inside TryBase MicroVM:

```text
HOSTNAME=ip-10-0-10-142.eu-west-2.compute.internal
AWS_REGION=eu-west-2
AWS_CONTAINER_CREDENTIALS_RELATIVE_URI=/v2/credentials/a1b2c3d4-e5f6...
PORT=8080
WORKLOAD_TYPE=agent
```

Notice what is **completely missing**:
* No `AWS_ACCESS_KEY_ID`
* No `AWS_SECRET_ACCESS_KEY`
* No `DATABASE_URL=postgres://master:password@...`
* No `OPENAI_API_KEY`

If the attacker attempts to query the link-local metadata agent directly, the temporary token returned is valid only for that microVM's execution context and expires within minutes. Furthermore, the tenant's dedicated IAM Task Role strictly forbids access to sibling tenant resources.

---

[Next: TryBase vs Traditional PaaS →](./comparative-analysis.md)
