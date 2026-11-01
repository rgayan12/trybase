# TryBase Python & Django Client

Zero-dependency standard-library client for the TryBase anti-leak secrets daemon.

Provides kernel-authenticated in-memory secret loading and dynamic passwordless AWS RDS IAM database authentication over Linux Unix Domain Sockets (`/var/run/trybase/secrets.sock`).

---

## Features

- **TryBase Session-Token Protocol**: Negotiates short-lived session tokens (`PUT /latest/api/token`) with in-memory caching across request lifecycles.
- **Fail-Closed in Production**: Automatically verifies socket presence in production/staging and aborts startup on missing socket or protocol errors.
- **Scoped Blast Radius**: Supports `TRYBASE_SECRET_KEYS` to fetch only declared keys individually via `GET /latest/secrets/<key>`.
- **Dynamic RDS IAM Tokens**: Ephemeral 15-minute SigV4 tokens with certificate-verifying TLS (`sslmode=verify-full`).
- **Connection Pool Friendly**: Seamlessly integrates with Django (`CONN_MAX_AGE=600`), Celery, and `psycopg` connection pools.
- **Zero External Dependencies**: Implemented using pure Python 3 standard library (`http.client`, `socket`, `json`).
