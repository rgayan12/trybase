# Fargate Graviton MicroVMs

> [!NOTE]
> TryBase standardizes compute on AWS Fargate powered by AWS Graviton (ARM64) processors. Each workload runs in a dedicated Firecracker MicroVM.

---

## 1. Firecracker Hypervisor Isolation

Unlike legacy container engines that share the host Linux kernel, AWS Fargate provisions a dedicated **Firecracker MicroVM** for every task.

```
TRADITIONAL CONTAINER HOST:
┌────────────────────────────────────────────────────────┐
│  Shared Linux Kernel (Risk of Kernel Exploits)         │
│  ├─ Container A (Tenant 1)                             │
│  └─ Container B (Tenant 2)                             │
└────────────────────────────────────────────────────────┘

AWS FARGATE FIRECRACKER MICROVM:
┌────────────────────────────────────────────────────────┐
│  Firecracker Hypervisor Boundary                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Guest Kernel A (Dedicated Memory & Registers)    │  │
│  │ Task A: Tenant 1                                 │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Guest Kernel B (Dedicated Memory & Registers)    │  │
│  │ Task B: Tenant 2                                 │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

Firecracker provides:
* **Minimalist Device Model**: Emulates only 5 essential hardware devices, minimizing attack surface.
* **Hardware Virtualization**: Backed by KVM (Kernel-based Virtual Machine) with hardware memory isolation.
* **Sub-second Boot Times**: Allows rapid auto-scaling and reactive rehydration.

---

## 2. AWS Graviton (ARM64) Performance

TryBase task definitions specify Graviton ARM64 runtime architecture:

```hcl
runtime_platform {
  operating_system_family = "LINUX"
  cpu_architecture        = "ARM64"
}
```

### Advantages of Graviton for AI Agents
1. **Up to 40% Better Price-Performance**: Graviton processors feature dedicated physical cores (no SMT/hyperthreading sharing), providing consistent CPU execution for LLM token streaming and vector math.
2. **Optimized Cryptography**: Native hardware acceleration for SHA-256 and AES cipher suites used in TLS termination and database encryption.
3. **Lower Carbon Footprint**: Up to 60% less energy consumption compared to x86_64 instances.

---

## 3. Sizing Matrix

| Profile | CPU Units | Memory (MiB) | Hourly Cost | Ideal For |
| :--- | :--- | :--- | :--- | :--- |
| **Micro** | `256` (0.25 vCPU) | `512` | $0.008 | Lightweight webhook routers & simple agents |
| **Standard** | `512` (0.50 vCPU) | `1024` | $0.016 | **Default agent workloads (FastAPI + Bedrock)** |
| **Performance** | `1024` (1.00 vCPU)| `2048` | $0.032 | Visual agent studios (Dify, n8n) & Celery workers |
| **High Memory** | `2048` (2.00 vCPU)| `4096` | $0.065 | High-concurrency RAG pipelines & document parsing |

---

[Next: ALB & Wildcard TLS Ingress →](./alb-routing.md)
