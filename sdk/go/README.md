# TryBase Go Client

Zero-dependency standard library Go client for the TryBase anti-leak secret daemon.

Provides kernel-authenticated in-memory secret loading and dynamic passwordless AWS RDS IAM database authentication over Linux Unix Domain Sockets (`/var/run/trybase/secrets.sock`).

---

## Features

- **TryBase Session-Token Protocol**: Negotiates short-lived caller-bound tokens (`PUT /latest/api/token`) with thread-safe (`sync.RWMutex`) in-memory token caching.
- **Fail-Closed in Production**: Verifies socket availability and fails closed when running in `production` or `staging`.
- **Scoped Blast Radius**: Supports `TRYBASE_SECRET_KEYS` to load only declared keys individually.
- **Dynamic RDS IAM Tokens for `pgx` and `database/sql`**: Provides `GetDatabasePasswordHook()` to integrate directly with `pgxpool.Config.BeforeConnect` so connection pools refresh 15-minute tokens automatically on reconnect.
- **Certificate-Verifying TLS**: Enforces `verify-full` TLS with AWS RDS CA bundles.
- **Zero External Dependencies**: Pure Go standard library (`net`, `net/http`, `sync`, `encoding/json`).

---

## Usage

### Loading Secrets
```go
package main

import (
	"fmt"
	"log"

	"github.com/trybase/sdk-go"
)

func main() {
	// Loads secrets into memory, failing closed in production
	secrets, err := trybase.LoadSecrets()
	if err != nil {
		log.Fatalf("TryBase initialization failed: %v", err)
	}

	fmt.Println("Stripe Secret:", secrets["STRIPE_SECRET"])
}
```

### Passwordless Connection with pgxpool
```go
package main

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/trybase/sdk-go"
)

func main() {
	client := trybase.NewClient()

	config, err := pgxpool.ParseConfig("postgres://usr_tenant@postgres.internal.cluster:5432/trybase_db?sslmode=verify-full&sslrootcert=/etc/ssl/certs/rds-combined-ca-bundle.pem")
	if err != nil {
		log.Fatal(err)
	}

	// Dynamic password hook: runs before each connection in the pool is opened!
	config.BeforeConnect = func(ctx context.Context, cc *pgx.ConnConfig) error {
		token, err := client.GetDatabaseToken()
		if err != nil {
			return err
		}
		cc.Password = token.AuthToken
		return nil
	}

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
}
```
