# Unix Domain Sockets, Shared Volumes & `SO_PEERCRED`

> [!IMPORTANT]
> Never expose local sidecar daemons or inter-process communication over localhost TCP ports (`127.0.0.1`). Any compromised process within the container network namespace can scan, query, and abuse open TCP ports. TryBase replaces TCP with kernel-mediated Unix Domain Sockets over shared in-memory volumes.

---

## 1. The Core Question: How Do Containers Talk Without a Network?

A common question in modern container architecture is:
> *"When you bind a sidecar to the application container, do they share the same filesystem, or are they linked by a network? How does data travel without network packets if they are two separate services?"*

The answer lies in how **AWS ECS Tasks (and Kubernetes Pods)** actually run on Linux hypervisors.

### The Big Realization: They Run on the Same MicroVM

In AWS ECS Fargate, a "Task" runs multiple containers within **AWS's documented task-level hardware virtualization boundary, sharing the same Linux kernel**:

```
┌─────── AWS ECS FARGATE TASK (Task-Level Hardware Virtualization Boundary) ───────┐
│                                                                           │
│   ┌────────────────────────┐                   ┌───────────────────────┐  │
│   │ Container A:           │                   │ Container B:          │  │
│   │ App (Laravel / Django) │                   │ TryBase Daemon        │  │
│   │                        │                   │ (Rust sidecar)        │  │
│   │ Own root filesystem (/)│                   │ Own root filesystem(/)│  │
│   └───────────┬────────────┘                   └───────────┬───────────┘  │
│               │                                            │              │
│               │ Mounts: /var/run/trybase                   │ Mounts:      │
│               │                                            │ /var/run/    │
│               ▼                                            ▼ trybase      │
│     ┌────────────────────────────────────────────────────────────┐        │
│     │            SHARED IN-MEMORY VOLUME (tmpfs RAM)             │        │
│     │               /var/run/trybase/secrets.sock                │        │
│     └────────────────────────────────────────────────────────────┘        │
│                                   │                                       │
│ ══════════════════════════════════╪══════════════════════════════════════ │
│                     LINUX KERNEL MEMORY SPACE                             │
│                                   │                                       │
│                     Direct kernel queue pointers                          │
│                   (ZERO network packets, ZERO TCP)                        │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 3 Steps of Non-Network IPC

### Step 1: Isolated Root Filesystems + One Shared Directory
Each container retains its own private root filesystem (`/`). Laravel has its PHP files; the TryBase daemon has its compiled Rust binary. Neither can browse the other's private system files.

However, in the ECS Task Definition, we declare an **in-memory shared volume**:

```hcl
# terraform/modules/tenant/main.tf
resource "aws_ecs_task_definition" "tenant" {
  family                   = "trybase-${var.tenant_id}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"

  # Shared in-memory volume between co-located containers
  volume {
    name = "trybase-socket-share"
  }

  container_definitions = jsonencode([
    # Sidecar: The TryBase Anti-Leak Rust Daemon
    {
      name  = "trybase-daemon"
      image = "ghcr.io/trybase/daemon:latest"
      mountPoints = [
        {
          sourceVolume  = "trybase-socket-share"
          containerPath = "/var/run/trybase"
        }
      ]
    },
    # Workload: Application Container
    {
      name  = "app"
      image = var.container_image
      mountPoints = [
        {
          sourceVolume  = "trybase-socket-share"
          containerPath = "/var/run/trybase"
        }
      ]
    }
  ])
}
```

Both containers mount this same volume at `/var/run/trybase`.

### Step 2: The Socket File is a "Rendezvous Inode"
When the TryBase daemon boots, it binds to the path:
```rust
let listener = UnixListener::bind("/var/run/trybase/secrets.sock")?;
```

In the Linux Virtual File System (VFS), this creates a special file of type `S_IFSOCK`.
- **It consumes 0 bytes on disk.**
- It acts merely as a **rendezvous point** (a name tag) so another process in a different mount namespace can find the daemon's socket in the kernel.

### Step 3: Kernel-Mediated Communication
When the application connects to `/var/run/trybase/secrets.sock`, the Linux kernel establishes the peer connection:
- In the Linux kernel networking subsystem (`net/unix/af_unix.c`), endpoints reference each other via `unix_peer(sk)`.
- Data passes directly through kernel-managed socket queues (`sk_receive_queue`) in volatile RAM.
- **Zero network packets are created. Zero IP routing. Zero loopback (`lo`) traversal.**

---

## 3. Comparative Architecture: TCP vs Unix Domain Socket

| Dimension | Localhost TCP (`127.0.0.1:8100`) | TryBase Shared Socket (`AF_UNIX`) |
| :--- | :--- | :--- |
| **Addressing** | IP address & TCP port number | Filesystem rendezvous path (`/var/run/trybase/...`) |
| **Data Path** | Packetized, IP stack, TCP handshake, checksums | Direct memory transfer in kernel socket queues |
| **Latency** | ~0.5ms – 1.0ms | **~0.05ms (10x lower latency)** |
| **Port Scanning** | Any container process can scan `127.0.0.1` | No network ports exist. Guarded by Linux file permissions |
| **Caller Identity** | Untrusted (caller can forge headers like `X-Forwarded-For`) | **Kernel-verified (`SO_PEERCRED` socket credentials)** |
| **Binary Verification** | Impossible over standard TCP | **Executable path inspection via `/proc/<pid>/exe`** |

---

## 4. Kernel Peer Verification (`SO_PEERCRED`)

When an application connects to the socket, the TryBase Rust daemon queries the Linux kernel for the caller's credentials:

```rust
// daemon/src/peer.rs
let ucred = nix::sys::socket::getsockopt(&fd, nix::sys::socket::sockopt::PeerCredentials)?;
```

The Linux kernel inspects the caller's internal process credentials and passes the caller's **PID**, **UID**, and **GID** directly to the daemon. The caller cannot forge these socket credentials over the wire. Note that in multi-container task definitions, sharing the process tree across containers requires enabling task-level process sharing (such as `pid_mode = "task"`).

---

## 5. Executable Path Filtering via `/proc/<pid>/exe`

Once the daemon receives the caller's PID from the kernel, it resolves the caller's executable path via `/proc/<pid>/exe`:

```rust
let binary_path = std::fs::read_link(format!("/proc/{}/exe", ucred.pid()))?;
```

The daemon inspects the executable path and rejects unauthorized clients (such as paths containing `bash` or `curl` in the reference implementation):

| Calling Executable | `/proc/<pid>/exe` Path | TryBase Daemon Action | Verified Boundary |
| :--- | :--- | :--- | :--- |
| **PHP Worker** | `/usr/local/bin/php-fpm` | ✅ Served | Allows configured application process |
| **Python Service** | `/usr/local/bin/python3` | ✅ Served | Allows configured application process |
| **Interactive Shell** | `/bin/bash` | 🚨 Dropped | Rejects process paths containing "bash" |
| **CLI Transfer Utility** | `/usr/bin/curl` | 🚨 Dropped | Rejects process paths containing "curl" |

> [!IMPORTANT]
> **Executable path inspection is not binary integrity verification.** Verifying that a process is `/usr/local/bin/python3` proves which interpreter opened the socket, but does not prove which script it runs or whether that script has been compromised.

---

## 6. TryBase v1 Security Scope & Threat Model

### TryBase v1 security scope

TryBase delivers configured secrets over a Unix-domain socket into application memory, avoiding the need to store those secrets in production .env files or inject them into process environment variables.

This reduces exposure through secret-file disclosure, environment dumps and automatic environment inheritance by child processes. The daemon applies implemented peer-verification rules before returning secrets.

These controls do not establish that an authorised interpreter is executing trusted application code. Malicious code running inside the authorised application may access delivered secrets and exercise the application’s permissions. Secrets may also leak through application logging, debugging or configuration caching unless those paths are controlled.

Tenant containment depends on correctly configured database permissions, IAM policies and workload isolation. Shared database infrastructure retains shared resource and availability risks.

Host/kernel compromise and privileged process inspection are outside this mechanism’s protection.

### Explorations (Roadmap)
* **Credential-isolating proxy and operation-level policy enforcement**: Exploring proxying and operation-level policy enforcement so that applications can interact with external services without storing long-lived raw secrets in application memory.
* **In-kernel enforcement and behavioural detection**: Exploring in-kernel policy caching and behavioural anomaly detection within the daemon.

---

## 7. Implementation: The Production Rust Daemon

Here is how the TryBase daemon implements this in production:

```rust
// daemon/src/main.rs
use std::fs;
use std::os::unix::fs::PermissionsExt;
use tokio::net::UnixListener;
use nix::sys::socket::{getsockopt, sockopt::PeerCredentials};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let socket_path = "/var/run/trybase/secrets.sock";

    // Bind Unix Domain Socket on shared volume
    let listener = UnixListener::bind(socket_path)?;

    // Set permissions to 0666 so non-root container users (e.g. www-data) can connect
    fs::set_permissions(socket_path, fs::Permissions::from_mode(0o666))?;

    loop {
        let (stream, _) = listener.accept().await?;
        let fd = stream.as_raw_fd();

        // 1. Kernel-verified caller identity
        let ucred = getsockopt(&BorrowedFd::borrow_raw(fd), PeerCredentials)?;

        // 2. Inspect calling binary via procfs
        let exe = fs::read_link(format!("/proc/{}/exe", ucred.pid()))?;

        if exe.to_string_lossy().contains("bash") || exe.to_string_lossy().contains("curl") {
            eprintln!("SECURITY ALERT: Blocked unauthorized binary: {:?}", exe);
            drop(stream);
            continue;
        }

        // 3. Serve authenticated in-memory secrets and ephemeral RDS IAM tokens
        tokio::spawn(handle_connection(stream));
    }
}
```

---

[Next: Passwordless RDS IAM Authentication →](./rds-iam-auth.md)
