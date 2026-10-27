# Unix Domain Sockets & `SO_PEERCRED`

> [!IMPORTANT]
> Never expose local sidecar daemons or inter-process communication over localhost TCP ports (`127.0.0.1`). Any process within the container namespace can scan and abuse open TCP ports.

---

## 1. The Localhost TCP Vulnerability

When deploying local background sidecars (such as monitoring agents, vector sync daemons, or MCP sidecars), standard architectures bind to a localhost TCP port:

```
[Attacker RCE in Web Framework]
              │
              ▼ connects to 127.0.0.1:9000
[Local Daemon: "Unauthenticated Root Control"]
```

Because Linux network namespaces share the loopback interface, any compromised process running with low privileges (e.g. `www-data` or `nobody`) can connect to `127.0.0.1:9000`, send commands, and elevate privileges.

---

## 2. Kernel-Enforced Unix Domain Sockets

TryBase enforces **Unix Domain Sockets** using the Linux `SO_PEERCRED` socket option:

```
[Client Process (UID: 1000)]
              │ connects to /var/run/trybase.sock
              ▼
┌────────────────────────────────────────────────────────┐
│  Linux Kernel Socket Layer                             │
│  Kernel directly populates: UID = 1000, GID = 1000     │
└─────────────────────┬──────────────────────────────────┘
                      │
                      ▼ getsockopt(SOL_SOCKET, SO_PEERCRED)
┌────────────────────────────────────────────────────────┐
│  TryBase Sidecar Daemon                                │
│  if (cred.uid != ALLOWED_UID) { close(fd); }           │
└────────────────────────────────────────────────────────┘
```

### Why `SO_PEERCRED` Cannot Be Spoofed
Unlike HTTP headers (`X-User-ID`), API tokens, or user-space variables, `SO_PEERCRED` is populated **directly by the Linux kernel** from the process task structure. User-space applications physically cannot forge or alter this metadata.

---

## 3. Implementation Code

### C / Systems Daemon

```c
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>

void handle_connection(int client_fd) {
    struct ucred cred;
    socklen_t len = sizeof(struct ucred);

    // Retrieve kernel-verified caller credentials
    if (getsockopt(client_fd, SOL_SOCKET, SO_PEERCRED, &cred, &len) == -1) {
        close(client_fd);
        return;
    }

    // Reject callers that do not match the expected tenant UID
    if (cred.uid != 1000) {
        // Drop immediately; unauthorized caller
        close(client_fd);
        return;
    }

    // Process authenticated request...
}
```

### Python Sidecar Server

```python
import socket
import struct

sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
sock.bind("/var/run/trybase.sock")
sock.listen(5)

while True:
    client_sock, _ = sock.accept()
    # SO_PEERCRED (struct ucred: pid_t, uid_t, gid_t)
    ucred = client_sock.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, struct.calcsize("3i"))
    pid, uid, gid = struct.unpack("3i", ucred)

    if uid != 1000:
        client_sock.close()
        continue

    # Process trusted request...
```

---

[Next: Passwordless RDS IAM Authentication →](./rds-iam-auth.md)
