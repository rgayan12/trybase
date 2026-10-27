# Keyless STS Authentication Loop

> [!WARNING]
> Storing static AWS access keys (`AKIA...`) in container configuration or `.env` files is an anti-pattern that violates the TryBase Anti-Leak Standard.

---

## 1. The Link-Local Metadata Agent (`169.254.170.2`)

AWS Fargate exposes a link-local metadata agent endpoint reachable exclusively from within the private microVM:

```text
http://169.254.170.2$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
```

When an agent initialized with AWS SDKs (`boto3` in Python, `@aws-sdk` in TypeScript) executes an operation, the SDK checks the environment:
1. Detects **no static AWS credentials** (`AWS_ACCESS_KEY_ID` is empty).
2. Automatically queries the link-local URI at `169.254.170.2`.
3. The AWS Fargate agent assumes the container's dedicated IAM Task Role.
4. AWS STS returns a temporary session token starting with `ASIA...`.

```
┌────────────────────────────────────────────────────────┐
│  Fargate MicroVM Container                             │
│                                                        │
│  boto3 / @aws-sdk                                      │
│         │                                              │
│         ▼ GET http://169.254.170.2/credentials         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ AWS Fargate Task Metadata Agent                  │  │
│  └──────────────────────┬───────────────────────────┘  │
└─────────────────────────┼──────────────────────────────┘
                          ▼ STS AssumeRole
┌────────────────────────────────────────────────────────┐
│  AWS Security Token Service (STS)                      │
│  Issues temporary ASIA... token (Valid for 60 min)     │
└────────────────────────────────────────────────────────┘
```

---

## 2. Silent In-Memory Rotation

The temporary STS token is never written to disk or container environment variables:

* **In-Memory Storage**: The SDK retains the token strictly in volatile process memory.
* **Proactive Refresh**: Approximately 10 to 15 minutes before token expiration, the SDK's internal credential provider queries `169.254.170.2` and swaps in a fresh token.
* **Zero Downtime**: The agent container never restarts, disconnects, or throws authentication errors.

---

## 3. Cryptographic IP & VPC Binding

Even if a malicious actor achieves code execution and dumps the process memory to inspect the active `ASIA...` token:
* The token is **cryptographically bound** to that microVM's execution context.
* Requests using that token from any external IP address or foreign VPC are immediately rejected by AWS IAM policy conditions.
* The token expires automatically within minutes.

---

[Next: Unix Domain Sockets & SO_PEERCRED →](./unix-sockets.md)
