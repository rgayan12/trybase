use std::os::unix::io::AsRawFd;
use std::path::PathBuf;
use tracing::{error, warn};

/// Credentials and binary identity extracted directly from the Linux kernel.
#[derive(Debug, Clone)]
pub struct PeerIdentity {
    pub pid: i32,
    pub uid: u32,
    pub gid: u32,
    pub binary_path: Option<PathBuf>,
}

/// Known binaries that must NEVER be allowed to query the secret socket.
/// This prevents attackers who gain command execution (reverse shells, command injection)
/// from probing the socket with standard reconnaissance tools.
const DISALLOWED_BINARIES: &[&str] = &[
    "sh", "bash", "zsh", "dash", "ash", "ksh",
    "curl", "wget", "nc", "netcat", "ncat", "socat",
    "perl", "ruby"
];

impl PeerIdentity {
    /// Extract caller credentials from the raw Unix socket file descriptor using the kernel.
    pub fn from_socket<T: AsRawFd>(stream: &T) -> Result<Self, String> {
        let fd = stream.as_raw_fd();

        #[cfg(target_os = "linux")]
        {
            use nix::sys::socket::{getsockopt, sockopt};
            use std::os::unix::io::BorrowedFd;

            let borrowed_fd = unsafe { BorrowedFd::borrow_raw(fd) };
            let ucred = getsockopt(&borrowed_fd, sockopt::PeerCredentials)
                .map_err(|e| format!("Failed to read SO_PEERCRED from kernel: {}", e))?;

            let pid = ucred.pid();
            let uid = ucred.uid();
            let gid = ucred.gid();

            let binary_path = resolve_binary_for_pid(pid);

            Ok(PeerIdentity {
                pid,
                uid,
                gid,
                binary_path,
            })
        }

        #[cfg(not(target_os = "linux"))]
        {
            // On macOS / non-Linux (local development)
            let mut pid: libc::pid_t = 0;
            let mut len = std::mem::size_of::<libc::pid_t>() as libc::socklen_t;

            let res = unsafe {
                libc::getsockopt(
                    fd,
                    libc::SOL_LOCAL,
                    libc::LOCAL_PEERPID,
                    &mut pid as *mut _ as *mut libc::c_void,
                    &mut len,
                )
            };

            let pid = if res == 0 { pid } else { std::process::id() as i32 };
            let binary_path = resolve_binary_for_pid(pid);

            Ok(PeerIdentity {
                pid,
                uid: unsafe { libc::getuid() },
                gid: unsafe { libc::getgid() },
                binary_path,
            })
        }
    }

    /// Validates whether the caller process is authorized to receive secrets.
    /// Rejects interactive shells, unauthorized network tools, or foreign binaries.
    pub fn is_authorized(&self, allowed_binary_name: Option<&str>) -> Result<(), String> {
        // 1. Inspect binary name
        if let Some(ref path) = self.binary_path {
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                // Check against hard blocklist
                for blocked in DISALLOWED_BINARIES {
                    if file_name == *blocked || file_name.starts_with(&format!("{}-", blocked)) {
                        let alert = format!(
                            "SECURITY ALERT: Blocked unauthorized binary '{}' (PID: {}, UID: {}) from querying secrets socket!",
                            path.display(),
                            self.pid,
                            self.uid
                        );
                        error!("{}", alert);
                        return Err(alert);
                    }
                }

                // If an explicit allowed binary is specified (e.g. "php-fpm" or "node")
                if let Some(expected) = allowed_binary_name {
                    if file_name != expected {
                        let alert = format!(
                            "SECURITY ALERT: Binary mismatch. Expected '{}' but caller is '{}' (PID: {})",
                            expected,
                            path.display(),
                            self.pid
                        );
                        warn!("{}", alert);
                        return Err(alert);
                    }
                }
            }
        }

        Ok(())
    }
}

/// Resolves the absolute path of the executing binary for a given PID.
/// On Linux: reads symlink `/proc/<pid>/exe`.
fn resolve_binary_for_pid(pid: i32) -> Option<PathBuf> {
    #[cfg(target_os = "linux")]
    {
        let proc_path = format!("/proc/{}/exe", pid);
        std::fs::read_link(&proc_path).ok()
    }

    #[cfg(target_os = "macos")]
    {
        let mut buf = vec![0u8; 4096];
        let ret = unsafe {
            libc::proc_pidpath(
                pid,
                buf.as_mut_ptr() as *mut libc::c_void,
                buf.len() as u32,
            )
        };
        if ret > 0 {
            let path_str = std::ffi::CStr::from_bytes_until_nul(&buf)
                .ok()?
                .to_str()
                .ok()?;
            Some(PathBuf::from(path_str))
        } else {
            None
        }
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        None
    }
}
