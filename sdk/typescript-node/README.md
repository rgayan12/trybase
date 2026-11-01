# @trybase/client

Zero-dependency standard Node.js & TypeScript client for the TryBase anti-leak secret daemon.

Provides kernel-authenticated in-memory secret loading and dynamic passwordless AWS RDS IAM database authentication over Linux Unix Domain Sockets (`/var/run/trybase/secrets.sock`).

---

## Features

- **TryBase Session-Token Protocol**: Negotiates short-lived session tokens (`PUT /latest/api/token`) with in-memory caching to minimize socket roundtrips.
- **Fail-Closed in Production**: Verifies daemon presence when `NODE_ENV=production` and fails closed on connection or authentication errors.
- **Scoped Blast Radius**: Supports `TRYBASE_SECRET_KEYS` to fetch only the declared subset of keys.
- **Dynamic RDS IAM Tokens for `pg` (node-postgres)**: Uses `getPgPoolConfig()` to hook into `password: async () => token` so connection pools automatically refresh the 15-minute token on reconnect.
- **Certificate-Verifying TLS**: Configures `rejectUnauthorized: true` with AWS RDS CA bundles (`rds-combined-ca-bundle.pem` or system store).
- **Zero Runtime Dependencies**: Uses Node.js native `http` and `fs` modules.

---

## Usage

### Secret Loading
```typescript
import { loadSecrets, TryBaseClient } from '@trybase/client';

// Loads secrets into memory (and optionally process.env)
const secrets = await loadSecrets();
console.log(secrets.STRIPE_SECRET);
```

### Passwordless PostgreSQL Pool (node-postgres)
```typescript
import { Pool } from 'pg';
import { TryBaseClient } from '@trybase/client';

const trybase = new TryBaseClient();

// Automatically configures dynamic password refresh and TLS
const pool = new Pool(trybase.getPgPoolConfig({
  host: 'postgres.internal.cluster',
  port: 5432,
  user: 'usr_tenant',
  database: 'trybase_db',
  max: 20,
}));

// Connections automatically receive freshly minted 15-minute IAM tokens
const res = await pool.query('SELECT NOW()');
```
