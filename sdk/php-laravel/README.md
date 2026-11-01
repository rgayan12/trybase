# TryBase Laravel Service Provider

Hardened, in-memory secret injection and dynamic passwordless AWS RDS IAM database authentication for Laravel applications.

Eliminates persistent cloud credentials and static database passwords in production containers.

---

## Key Features

1. **Fail-Closed in Production**: If the TryBase daemon socket is missing or fails to respond in production, the application immediately aborts startup to prevent running unauthenticated. Local fallback (`.env`) is explicitly permitted for local development.
2. **Safe with `config:cache`**: Automatically detects `php artisan config:cache` during build/deployment and skips runtime secret injection, ensuring secrets are **never** serialized to disk in `bootstrap/cache/config.php`.
3. **Queue Worker Dynamic RDS IAM Refresh**: Binds a custom `TryBasePostgresConnector` that mints a fresh 15-minute SigV4 RDS IAM token whenever PDO opens or recycles a connection. Long-running queue workers (`php artisan queue:work`) automatically purge stale connections before token expiry.
4. **Certificate-Verifying TLS**: Enforces `sslmode=verify-full` with AWS RDS CA bundles (`rds-combined-ca-bundle.pem` or system CA store) to prevent man-in-the-middle attacks.
5. **Scoped Secret Access**: Supports fetching only the declared subset of secrets (`TRYBASE_SECRET_KEYS`) via individual `GET /latest/secrets/{key}` queries, minimizing blast radius.
6. **TryBase Session-Token Protocol**: Negotiates short-lived caller-bound tokens (`PUT /latest/api/token`) verified against kernel socket peer credentials (`SO_PEERCRED`).

---

## Installation

### Option A: Standalone Drop-in
Copy `TryBaseServiceProvider.php` into your Laravel application's `app/Providers/` directory.

In Laravel 11 (`bootstrap/providers.php`):
```php
return [
    App\Providers\AppServiceProvider::class,
    App\Providers\TryBaseServiceProvider::class,
];
```

In Laravel 10 (`config/app.php`):
```php
'providers' => [
    // ...
    App\Providers\TryBaseServiceProvider::class,
],
```

---

## Configuration

| Environment Variable | Default | Description |
| :--- | :--- | :--- |
| `TRYBASE_SOCKET_PATH` | `/var/run/trybase/secrets.sock` | Path to TryBase daemon Unix Domain Socket. |
| `TRYBASE_FAIL_CLOSED` | `true` in prod, `false` otherwise | Abort application boot if TryBase is unreachable. |
| `TRYBASE_LOCAL_FALLBACK` | `false` in prod, `true` otherwise | Allow fallback to `.env` if socket does not exist. |
| `TRYBASE_SECRET_KEYS` | *(empty = fetch all)* | Comma-separated list of keys to fetch (e.g. `APP_KEY,STRIPE_SECRET`). |
| `TRYBASE_RDS_IAM` | `true` | Enable passwordless RDS IAM authentication. |
| `DB_SSLMODE` | `verify-full` | PostgreSQL SSL mode for RDS IAM. |
| `DB_SSLROOTCERT` | `/etc/ssl/certs/rds-combined-ca-bundle.pem` | Path to AWS RDS CA bundle. |

---

## Queue Workers & Long-Running Processes

Laravel queue workers run indefinitely. Because RDS IAM tokens expire after 15 minutes, standard static configuration will cause PAM authentication failures upon reconnection.

`TryBaseServiceProvider` automatically registers a `Queue::looping` callback that purges connections older than 10 minutes (600s). The next job executed by the worker triggers `TryBasePostgresConnector::connect()`, seamlessly obtaining a freshly minted token from the daemon without manual intervention.
