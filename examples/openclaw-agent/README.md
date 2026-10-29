# OpenClaw Autonomous Agent Runner on TryBase

This is a production-ready **OpenClaw Autonomous Agent Runner** built for TryBase's Virtual Single-Tenancy architecture.

## Architecture

```
                  ┌─────────────────────────────┐
                  │    Inbound Webhook / API    │
                  └──────────────┬──────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────┐
│              OpenClaw Agent Task (MicroVM)                    │
│                                                               │
│   ┌───────────────────────┐       ┌───────────────────────┐   │
│   │   FastAPI Runner      │ ◄───► │  In-Task Redis (0ms)  │   │
│   │   (main.py:8000)      │       │  (127.0.0.1:6379)     │   │
│   └───────────┬───────────┘       └───────────────────────┘   │
│               │                                               │
│               │ Reads 15-min ephemeral lease                  │
│               ▼                                               │
│   ┌───────────────────────┐                                   │
│   │  Anti-Leak Sidecar    │                                   │
│   │  (/var/run/trybase)   │                                   │
│   └───────────────────────┘                                   │
└───────────────┬───────────────────────────────┬───────────────┘
                │                               │
                ▼ (Internal VPC Mesh)           ▼ (Internal VPC Mesh)
   ┌─────────────────────────┐     ┌─────────────────────────┐
   │       Dify Agent        │     │      n8n Workflow       │
   │   (dify.internal:5001)  │     │   (workflow.internal)   │
   └─────────────────────────┘     └─────────────────────────┘
```

## Features
- **Anti-Leak Standard**: Zero `.env` files. Secrets are requested from the local Unix Domain Socket (`/var/run/trybase/secrets.sock`) with caller PID attestation.
- **In-Task Working Memory**: Injects a local Redis sidecar (`127.0.0.1:6379`) for fast task state without external cache bills.
- **Mesh Orchestration**: Co-located on the same organization network as your Dify studio and n8n workflows (`dify.internal` / `workflow.internal`).
- **Keyless AWS Bedrock IAM**: If enabled, invokes Claude 3.5 Sonnet directly via AWS STS tokens with zero hardcoded API keys.

## Deployment via TryBase CLI

```bash
# Deploy to your organization fleet
trybase fleet deploy trybase.fleet.yml
```
