"""
TryBase Zero-Secret Client for Python & Django (Standard Library Only - Zero External Dependencies)
Connects directly to /var/run/trybase/secrets.sock using Linux Unix Domain Sockets.
"""

import http.client
import json
import os
import socket
from typing import Any, Dict, Optional


class UnixSocketHTTPConnection(http.client.HTTPConnection):
    """HTTP Connection adapter that speaks over a Unix Domain Socket instead of TCP."""
    def __init__(self, socket_path: str, timeout: int = 5):
        super().__init__("localhost", timeout=timeout)
        self.socket_path = socket_path

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(self.socket_path)


class TryBaseClient:
    def __init__(self, socket_path: Optional[str] = None):
        self.socket_path = socket_path or os.environ.get(
            "TRYBASE_SOCKET_PATH", "/var/run/trybase/secrets.sock"
        )
        self._token: Optional[str] = None

    def _get_connection(self) -> UnixSocketHTTPConnection:
        return UnixSocketHTTPConnection(self.socket_path)

    def _get_token(self, ttl_seconds: int = 60) -> str:
        """Perform IMDSv2-style handshake to obtain a short-lived session token."""
        conn = self._get_connection()
        headers = {"X-TryBase-Token-TTL-Seconds": str(ttl_seconds)}
        conn.request("PUT", "/latest/api/token", headers=headers)
        res = conn.getresponse()
        
        if res.status != 200:
            raise RuntimeError(f"TryBase handshake failed: HTTP {res.status} - {res.read().decode()}")

        token = res.read().decode().strip()
        conn.close()
        return token

    def get_secrets(self) -> Dict[str, Any]:
        """Fetch all decrypted secrets into memory."""
        token = self._get_token()
        conn = self._get_connection()
        headers = {"X-TryBase-Token": token}
        conn.request("GET", "/latest/secrets", headers=headers)
        res = conn.getresponse()

        if res.status != 200:
            raise RuntimeError(f"Failed to fetch TryBase secrets: HTTP {res.status} - {res.read().decode()}")

        data = json.loads(res.read().decode())
        conn.close()
        return data

    def get_secret(self, key: str) -> Optional[str]:
        """Fetch a single secret value."""
        token = self._get_token()
        conn = self._get_connection()
        headers = {"X-TryBase-Token": token}
        conn.request("GET", f"/latest/secrets/{key}", headers=headers)
        res = conn.getresponse()

        if res.status == 404:
            conn.close()
            return None
        if res.status != 200:
            raise RuntimeError(f"Failed to fetch secret '{key}': HTTP {res.status}")

        val = res.read().decode()
        conn.close()
        return val

    def get_database_token(self) -> Dict[str, Any]:
        """Fetch an ephemeral 15-minute RDS IAM PostgreSQL authentication token."""
        token = self._get_token()
        conn = self._get_connection()
        headers = {"X-TryBase-Token": token}
        conn.request("GET", "/latest/database/token", headers=headers)
        res = conn.getresponse()

        if res.status != 200:
            raise RuntimeError(f"Failed to generate DB token: HTTP {res.status}")

        data = json.loads(res.read().decode())
        conn.close()
        return data


# Convenience singleton function
def load_secrets() -> Dict[str, Any]:
    """Helper to fetch secrets with automatic fallback to local environment during laptop development."""
    socket_path = os.environ.get("TRYBASE_SOCKET_PATH", "/var/run/trybase/secrets.sock")
    if os.path.exists(socket_path):
        client = TryBaseClient(socket_path)
        return client.get_secrets()
    # Fallback to local process.env on developer laptops
    return dict(os.environ)
