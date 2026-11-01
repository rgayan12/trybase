"""
TryBase Zero-Secret Client for Python & Django (Standard Library Only - Zero External Dependencies)
Connects directly to /var/run/trybase/secrets.sock using Linux Unix Domain Sockets.

Features:
- TryBase Session-Token Protocol with in-memory token caching.
- Fail-closed in production environments; explicit developer fallback for local laptops.
- Dynamic 15-minute RDS IAM passwordless token generation for web & Celery workers.
- Scoped secret fetching (TRYBASE_SECRET_KEYS) to minimize component blast radius.
- Enforced certificate-verifying TLS (verify-full) for PostgreSQL connections.
"""

import http.client
import json
import logging
import os
import socket
import time
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger("trybase")


class TryBaseError(RuntimeError):
    """Base exception for TryBase secret client failures."""
    pass


class UnixSocketHTTPConnection(http.client.HTTPConnection):
    """HTTP Connection adapter that speaks over a Linux Unix Domain Socket instead of TCP."""
    def __init__(self, socket_path: str, timeout: int = 4):
        super().__init__("localhost", timeout=timeout)
        self.socket_path = socket_path

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(self.socket_path)


class TryBaseClient:
    """Zero-dependency client for the TryBase Anti-Leak Daemon."""

    def __init__(self, socket_path: Optional[str] = None):
        self.socket_path = socket_path or os.environ.get(
            "TRYBASE_SOCKET_PATH", "/var/run/trybase/secrets.sock"
        )
        self._session_token: Optional[str] = None
        self._session_token_expires_at: float = 0.0

    def is_available(self) -> bool:
        """Checks if the TryBase Unix Domain Socket exists in the current environment."""
        return os.path.exists(self.socket_path)

    def should_fail_closed(self) -> bool:
        """Determines if the application must fail closed upon any TryBase failure."""
        env_fail_closed = os.environ.get("TRYBASE_FAIL_CLOSED")
        if env_fail_closed is not None:
            return env_fail_closed.strip().lower() in ("true", "1", "yes")

        # Explicit local fallback allowed
        if os.environ.get("TRYBASE_LOCAL_FALLBACK", "").strip().lower() in ("true", "1", "yes"):
            return False

        # Fail closed in production or staging environments
        env_name = (
            os.environ.get("ENVIRONMENT")
            or os.environ.get("ENV")
            or os.environ.get("DJANGO_ENV")
            or ""
        ).strip().lower()
        if env_name in ("production", "staging", "prod"):
            return True

        # In local or testing environments, only fail closed if explicitly required
        return os.environ.get("TRYBASE_REQUIRED", "").strip().lower() in ("true", "1", "yes")

    def _get_connection(self) -> UnixSocketHTTPConnection:
        return UnixSocketHTTPConnection(self.socket_path)

    def get_session_token(self, ttl_seconds: int = 60) -> str:
        """
        Obtains or reuses a caller-bound session token via PUT /latest/api/token.
        The daemon verifies kernel SO_PEERCRED credentials before minting the token.
        """
        # Reuse cached session token if valid (with 5-second buffer)
        if self._session_token and time.time() < (self._session_token_expires_at - 5):
            return self._session_token

        conn = self._get_connection()
        try:
            headers = {"X-TryBase-Token-TTL-Seconds": str(ttl_seconds)}
            conn.request("PUT", "/latest/api/token", headers=headers)
            res = conn.getresponse()
            body = res.read().decode().strip()

            if res.status != 200 or not body:
                raise TryBaseError(
                    f"TryBase Session-Token handshake failed: HTTP {res.status} - {body}"
                )

            self._session_token = body
            self._session_token_expires_at = time.time() + ttl_seconds
            return self._session_token
        except Exception as e:
            if self.should_fail_closed():
                raise TryBaseError(f"TryBase session handshake error: {e}") from e
            logger.warning("TryBase handshake warning: %s", e)
            raise
        finally:
            conn.close()

    def get_secrets(self) -> Dict[str, Any]:
        """Fetches all tenant secrets into memory: GET /latest/secrets."""
        token = self.get_session_token()
        conn = self._get_connection()
        try:
            headers = {"X-TryBase-Token": token}
            conn.request("GET", "/latest/secrets", headers=headers)
            res = conn.getresponse()
            body = res.read().decode()

            if res.status != 200:
                raise TryBaseError(
                    f"Failed to fetch TryBase secrets: HTTP {res.status} - {body}"
                )

            return json.loads(body)
        except Exception as e:
            if self.should_fail_closed():
                raise TryBaseError(f"TryBase secret loading failed: {e}") from e
            logger.warning("TryBase secret loading error: %s", e)
            raise
        finally:
            conn.close()

    def get_secret(self, key: str) -> Optional[str]:
        """Fetches a single secret: GET /latest/secrets/<key> (minimizes blast radius)."""
        token = self.get_session_token()
        conn = self._get_connection()
        try:
            headers = {"X-TryBase-Token": token}
            conn.request("GET", f"/latest/secrets/{key}", headers=headers)
            res = conn.getresponse()

            if res.status == 404:
                return None
            if res.status != 200:
                raise TryBaseError(
                    f"Failed to fetch secret '{key}': HTTP {res.status} - {res.read().decode()}"
                )

            return res.read().decode().strip()
        except Exception as e:
            if self.should_fail_closed():
                raise TryBaseError(f"TryBase secret lookup for '{key}' failed: {e}") from e
            logger.warning("TryBase single secret error for '%s': %s", key, e)
            raise
        finally:
            conn.close()

    def get_database_token(self) -> Dict[str, Any]:
        """
        Fetches an ephemeral 15-minute RDS IAM PostgreSQL authentication token.
        Returns dict containing: db_host, db_port, db_user, db_name, auth_token, expires_at.
        """
        token = self.get_session_token()
        conn = self._get_connection()
        try:
            headers = {"X-TryBase-Token": token}
            conn.request("GET", "/latest/database/token", headers=headers)
            res = conn.getresponse()
            body = res.read().decode()

            if res.status != 200:
                raise TryBaseError(
                    f"Failed to generate RDS IAM token: HTTP {res.status} - {body}"
                )

            data = json.loads(body)
            if not data.get("auth_token"):
                raise TryBaseError("TryBase database token response missing auth_token.")
            return data
        except Exception as e:
            if self.should_fail_closed():
                raise TryBaseError(f"RDS IAM token generation failed: {e}") from e
            logger.warning("TryBase DB token error: %s", e)
            raise
        finally:
            conn.close()

    def get_database_connection_params(
        self, base_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Builds dynamic connection parameters for psycopg/Django with explicit TLS verification.
        Refreshes the ephemeral 15-minute token immediately before opening a TCP connection.
        """
        token_info = self.get_database_token()
        params = dict(base_params or {})

        params["password"] = token_info["auth_token"]
        if token_info.get("db_host"):
            params["host"] = token_info["db_host"]
        if token_info.get("db_port"):
            params["port"] = token_info["db_port"]
        if token_info.get("db_user"):
            params["user"] = token_info["db_user"]
        if token_info.get("db_name"):
            params["database"] = token_info["db_name"]

        # Enforce certificate-verifying TLS
        params.setdefault("sslmode", os.environ.get("DB_SSLMODE", "verify-full"))

        ca_bundle = os.environ.get(
            "DB_SSLROOTCERT", "/etc/ssl/certs/rds-combined-ca-bundle.pem"
        )
        if os.path.exists(ca_bundle):
            params["sslrootcert"] = ca_bundle
        elif os.path.exists("/etc/ssl/certs/ca-certificates.crt"):
            params["sslrootcert"] = "/etc/ssl/certs/ca-certificates.crt"

        return params


def load_secrets() -> Dict[str, Any]:
    """
    Convenience loader that populates application secrets into memory.
    - Fails closed in production if TryBase socket is missing or errors out.
    - Respects TRYBASE_SECRET_KEYS to fetch only declared keys (minimizing blast radius).
    - Falls back to local environment variables on developer laptops if permitted.
    """
    client = TryBaseClient()

    if not client.is_available():
        if client.should_fail_closed():
            raise TryBaseError(
                f"TryBase socket not found at '{client.socket_path}'. "
                "Production workloads requiring TryBase must fail closed. "
                "Set TRYBASE_LOCAL_FALLBACK=true to permit local fallback."
            )
        # Fallback to local process environment on developer laptops
        return dict(os.environ)

    # Scoped secret loading if TRYBASE_SECRET_KEYS is specified
    scoped_keys_env = os.environ.get("TRYBASE_SECRET_KEYS")
    if scoped_keys_env:
        keys = [k.strip() for k in scoped_keys_env.split(",") if k.strip()]
        secrets = {}
        for key in keys:
            val = client.get_secret(key)
            if val is not None:
                secrets[key] = val
        return secrets

    return client.get_secrets()
