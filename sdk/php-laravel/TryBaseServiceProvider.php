<?php

namespace App\Providers;

use Illuminate\Database\Connectors\PostgresConnector;
use Illuminate\Support\ServiceProvider;

/**
 * TryBase Session-Token Protocol Service Provider for Laravel
 *
 * Provides kernel-authenticated, in-memory secret injection and dynamic RDS IAM
 * authentication over Linux Unix Domain Sockets (/var/run/trybase/secrets.sock).
 *
 * Security Guarantees:
 * 1. Fails closed in production environments when TryBase is unavailable.
 * 2. Never writes runtime secrets to disk during 'config:cache'.
 * 3. Enforces certificate-verifying TLS (verify-full) for RDS database connections.
 * 4. Transparently refreshes 15-minute RDS IAM tokens for long-running queue workers.
 * 5. Supports scoped secret fetching to reduce component blast radius.
 */
class TryBaseServiceProvider extends ServiceProvider
{
    protected string $socketPath;
    protected ?string $sessionToken = null;
    protected int $sessionTokenExpiresAt = 0;

    public function __construct($app)
    {
        parent::__construct($app);
        $this->socketPath = env('TRYBASE_SOCKET_PATH', '/var/run/trybase/secrets.sock');
    }

    public function register(): void
    {
        // 1. Prevent 'config:cache' from persisting runtime secrets to disk
        if ($this->isConfigCaching()) {
            if ($this->app->bound('log')) {
                logger()->info('TryBase: Skipping secret injection during config:cache to prevent disk serialization.');
            }
            return;
        }

        // 2. Check if TryBase Unix Domain Socket exists
        if (!file_exists($this->socketPath)) {
            if ($this->shouldFailClosed()) {
                throw new \RuntimeException(
                    "TryBase socket not found at '{$this->socketPath}'. " .
                    "Production workloads requiring TryBase must fail closed. " .
                    "Set TRYBASE_LOCAL_FALLBACK=true to permit local fallback."
                );
            }
            // Local developer fallback: Continue using .env
            return;
        }

        try {
            // 3. Register TryBase client in service container
            $this->app->singleton('trybase', fn() => $this);

            // 4. Register custom PostgresConnector for dynamic RDS IAM token refresh
            if (class_exists(PostgresConnector::class)) {
                $this->app->bind('db.connector.pgsql', fn() => new TryBasePostgresConnector($this));
            }

            // 5. Fetch configured secrets (scoped keys if specified, or all)
            $secrets = $this->loadSecrets();

            // 6. In-Memory Configuration Overrides (Zero secrets written to disk)
            $this->applySecretsToConfig($secrets);

            // 7. Configure Passwordless RDS IAM Database Connection if enabled
            if (filter_var(env('TRYBASE_RDS_IAM', true), FILTER_VALIDATE_BOOLEAN)) {
                $this->configureDatabase();
            }

            // 8. Register hook for long-running queue workers (reconnect on stale token)
            $this->registerQueueWorkerHooks();

        } catch (\Throwable $e) {
            if ($this->shouldFailClosed()) {
                throw new \RuntimeException("TryBase initialization failed: " . $e->getMessage(), 0, $e);
            }
            if ($this->app->bound('log')) {
                logger()->warning('TryBase secret loading encountered an error: ' . $e->getMessage());
            }
        }
    }

    /**
     * Determines if the application must fail closed upon any TryBase failure.
     */
    protected function shouldFailClosed(): bool
    {
        // Explicit override via environment
        if (env('TRYBASE_FAIL_CLOSED') !== null) {
            return filter_var(env('TRYBASE_FAIL_CLOSED'), FILTER_VALIDATE_BOOLEAN);
        }

        // If local fallback is explicitly allowed, do not fail closed
        if (filter_var(env('TRYBASE_LOCAL_FALLBACK', false), FILTER_VALIDATE_BOOLEAN)) {
            return false;
        }

        // Fail closed in production/staging environments by default
        if ($this->app->environment('production', 'staging')) {
            return true;
        }

        // In other environments (local, testing), only fail closed if explicitly required
        return filter_var(env('TRYBASE_REQUIRED', false), FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * Detects if the current CLI execution is 'php artisan config:cache'.
     */
    protected function isConfigCaching(): bool
    {
        if (!$this->app->runningInConsole()) {
            return false;
        }

        $argv = $_SERVER['argv'] ?? [];
        foreach ($argv as $arg) {
            if ($arg === 'config:cache' || str_contains($arg, 'config:cache')) {
                return true;
            }
        }

        return false;
    }

    /**
     * Obtains or reuses a TryBase Session-Token via PUT /latest/api/token.
     */
    public function getSessionToken(int $ttlSeconds = 60): string
    {
        // Reuse cached session token if still valid (with a 5-second buffer)
        if ($this->sessionToken !== null && time() < ($this->sessionTokenExpiresAt - 5)) {
            return $this->sessionToken;
        }

        $response = $this->querySocket('PUT', '/latest/api/token', [
            'X-TryBase-Token-TTL-Seconds: ' . $ttlSeconds,
        ]);

        if ($response === null || trim($response) === '') {
            throw new \RuntimeException('TryBase Session-Token Protocol handshake failed: empty or null token received.');
        }

        $token = trim($response);
        $this->sessionToken = $token;
        $this->sessionTokenExpiresAt = time() + $ttlSeconds;

        return $this->sessionToken;
    }

    /**
     * Loads secrets, respecting scoped key lists if configured to narrow blast radius.
     */
    public function loadSecrets(): array
    {
        $keysConfig = config('trybase.keys', env('TRYBASE_SECRET_KEYS'));

        if (!empty($keysConfig)) {
            $keys = is_array($keysConfig) ? $keysConfig : array_map('trim', explode(',', $keysConfig));
            $secrets = [];
            foreach ($keys as $key) {
                if ($key !== '') {
                    $val = $this->fetchSecret($key);
                    if ($val !== null) {
                        $secrets[$key] = $val;
                    }
                }
            }
            return $secrets;
        }

        return $this->fetchAllSecrets();
    }

    /**
     * Fetches all tenant secrets into memory: GET /latest/secrets
     */
    public function fetchAllSecrets(): array
    {
        $token = $this->getSessionToken();
        $json = $this->querySocket('GET', '/latest/secrets', [
            'X-TryBase-Token: ' . $token,
        ]);

        $data = json_decode($json, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
            throw new \RuntimeException(
                'Failed to decode TryBase secrets response: ' . json_last_error_msg()
            );
        }

        return $data;
    }

    /**
     * Fetches a single secret: GET /latest/secrets/<key>
     */
    public function fetchSecret(string $key): ?string
    {
        $token = $this->getSessionToken();
        $response = $this->querySocket(
            'GET',
            '/latest/secrets/' . urlencode($key),
            ['X-TryBase-Token: ' . $token],
            $allowNotFound = true
        );

        return $response !== null ? trim($response) : null;
    }

    /**
     * Fetches an ephemeral 15-minute RDS IAM database token: GET /latest/database/token
     */
    public function fetchDatabaseToken(): array
    {
        $token = $this->getSessionToken();
        $json = $this->querySocket('GET', '/latest/database/token', [
            'X-TryBase-Token: ' . $token,
        ]);

        $data = json_decode($json, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
            throw new \RuntimeException(
                'Failed to decode TryBase database token response: ' . json_last_error_msg()
            );
        }

        if (empty($data['auth_token'])) {
            throw new \RuntimeException('TryBase database token response missing auth_token.');
        }

        return $data;
    }

    /**
     * Applies loaded secrets into Laravel config repository in RAM.
     */
    protected function applySecretsToConfig(array $secrets): void
    {
        if (!empty($secrets['APP_KEY'])) {
            config(['app.key' => $secrets['APP_KEY']]);
        }
        if (!empty($secrets['STRIPE_SECRET'])) {
            config(['services.stripe.secret' => $secrets['STRIPE_SECRET']]);
        }
        if (!empty($secrets['OPENAI_API_KEY'])) {
            config(['services.openai.api_key' => $secrets['OPENAI_API_KEY']]);
        }

        // Custom mapping if defined in config/trybase.php
        $mapping = config('trybase.mapping', []);
        foreach ($mapping as $secretKey => $configKey) {
            if (isset($secrets[$secretKey])) {
                config([$configKey => $secrets[$secretKey]]);
            }
        }
    }

    /**
     * Configures PostgreSQL connection parameters for RDS IAM with explicit TLS.
     */
    protected function configureDatabase(): void
    {
        $dbToken = $this->fetchDatabaseToken();

        $config = [
            'database.connections.pgsql.trybase_iam' => true,
            'database.connections.pgsql.host' => $dbToken['db_host'] ?? config('database.connections.pgsql.host'),
            'database.connections.pgsql.port' => $dbToken['db_port'] ?? config('database.connections.pgsql.port', 5432),
            'database.connections.pgsql.database' => $dbToken['db_name'] ?? config('database.connections.pgsql.database'),
            'database.connections.pgsql.username' => $dbToken['db_user'] ?? config('database.connections.pgsql.username'),
            'database.connections.pgsql.password' => $dbToken['auth_token'],
            // Enforce certificate-verifying TLS
            'database.connections.pgsql.sslmode' => env('DB_SSLMODE', 'verify-full'),
        ];

        // Configure CA root certificate bundle if present
        $caBundle = env('DB_SSLROOTCERT', '/etc/ssl/certs/rds-combined-ca-bundle.pem');
        if (file_exists($caBundle)) {
            $config['database.connections.pgsql.sslrootcert'] = $caBundle;
        } elseif (file_exists('/etc/ssl/certs/ca-certificates.crt')) {
            $config['database.connections.pgsql.sslrootcert'] = '/etc/ssl/certs/ca-certificates.crt';
        }

        config($config);
    }

    /**
     * Registers queue worker lifecycle hooks to recycle connections before token expiry.
     */
    protected function registerQueueWorkerHooks(): void
    {
        if ($this->app->bound('queue')) {
            $this->app['queue']->looping(function () {
                if (TryBasePostgresConnector::isConnectionStale(600)) {
                    if ($this->app->bound('db')) {
                        $this->app['db']->purge('pgsql');
                    }
                }
            });
        }
    }

    /**
     * Internal cURL helper targeting Linux Unix Domain Socket with strict status validation.
     */
    public function querySocket(string $method, string $path, array $headers = [], bool $allowNotFound = false): ?string
    {
        $ch = curl_init('http://localhost' . $path);
        curl_setopt_array($ch, [
            CURLOPT_UNIX_SOCKET_PATH => $this->socketPath,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 4,
            CURLOPT_CONNECTTIMEOUT => 2,
            CURLOPT_HTTPHEADER => $headers,
        ]);

        $response = curl_exec($ch);
        $errno = curl_errno($ch);
        $error = curl_error($ch);
        $statusCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($errno !== 0) {
            $msg = "TryBase socket communication error [cURL {$errno}]: {$error}";
            if ($this->shouldFailClosed()) {
                throw new \RuntimeException($msg);
            }
            if ($this->app->bound('log')) {
                logger()->warning($msg);
            }
            return null;
        }

        if ($statusCode === 404 && $allowNotFound) {
            return null;
        }

        if ($statusCode < 200 || $statusCode >= 300) {
            $msg = "TryBase socket request {$method} {$path} returned HTTP {$statusCode}: {$response}";
            if ($this->shouldFailClosed()) {
                throw new \RuntimeException($msg);
            }
            if ($this->app->bound('log')) {
                logger()->warning($msg);
            }
            return null;
        }

        return $response !== false ? $response : null;
    }
}

/**
 * Custom PostgreSQL connector that dynamically mints fresh 15-minute RDS IAM
 * tokens whenever a new PDO connection is opened or reconnected.
 */
class TryBasePostgresConnector extends PostgresConnector
{
    protected static ?int $connectedAt = null;
    protected TryBaseServiceProvider $provider;

    public function __construct(TryBaseServiceProvider $provider)
    {
        $this->provider = $provider;
    }

    public function connect(array $config)
    {
        if (!empty($config['trybase_iam'])) {
            // Dynamically fetch fresh 15-minute RDS IAM token
            $dbToken = $this->provider->fetchDatabaseToken();
            if (!empty($dbToken['auth_token'])) {
                $config['password'] = $dbToken['auth_token'];
            }
            if (!empty($dbToken['db_host'])) {
                $config['host'] = $dbToken['db_host'];
            }
            if (!empty($dbToken['db_port'])) {
                $config['port'] = $dbToken['db_port'];
            }
            if (!empty($dbToken['db_user'])) {
                $config['username'] = $dbToken['db_user'];
            }
            if (!empty($dbToken['db_name'])) {
                $config['database'] = $dbToken['db_name'];
            }

            // Enforce certificate-verifying TLS
            if (empty($config['sslmode'])) {
                $config['sslmode'] = env('DB_SSLMODE', 'verify-full');
            }
            if (empty($config['sslrootcert'])) {
                $caBundle = env('DB_SSLROOTCERT', '/etc/ssl/certs/rds-combined-ca-bundle.pem');
                if (file_exists($caBundle)) {
                    $config['sslrootcert'] = $caBundle;
                } elseif (file_exists('/etc/ssl/certs/ca-certificates.crt')) {
                    $config['sslrootcert'] = '/etc/ssl/certs/ca-certificates.crt';
                }
            }
        }

        self::$connectedAt = time();
        return parent::connect($config);
    }

    /**
     * Checks if the active connection was established more than $maxAgeSeconds ago.
     */
    public static function isConnectionStale(int $maxAgeSeconds = 600): bool
    {
        if (self::$connectedAt === null) {
            return false;
        }
        return (time() - self::$connectedAt) >= $maxAgeSeconds;
    }
}
