<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

/**
 * TryBase Zero-Secret Service Provider for Laravel
 * Fetches secrets directly into memory from /var/run/trybase/secrets.sock.
 * Completely eliminates .env files and plaintext process.env in production!
 */
class TryBaseServiceProvider extends ServiceProvider
{
    protected string $socketPath = '/var/run/trybase/secrets.sock';

    public function register(): void
    {
        // 1. Only activate if TryBase Unix Domain Socket exists
        if (!file_exists($this->socketPath)) {
            // Local developer laptop fallback: Laravel continues using .env
            return;
        }

        try {
            // 2. Perform IMDSv2 Handshake: PUT /latest/api/token
            $token = $this->querySocket('PUT', '/latest/api/token', [
                'X-TryBase-Token-TTL-Seconds: 60'
            ]);

            if (empty($token)) {
                return;
            }

            // 3. Fetch all tenant secrets into memory: GET /latest/secrets
            $secretsJson = $this->querySocket('GET', '/latest/secrets', [
                'X-TryBase-Token: ' . trim($token)
            ]);

            $secrets = json_decode($secretsJson, true);
            if (!is_array($secrets)) {
                return;
            }

            // 4. Optionally fetch ephemeral 15-minute RDS database token
            $dbTokenJson = $this->querySocket('GET', '/latest/database/token', [
                'X-TryBase-Token: ' . trim($token)
            ]);
            $dbToken = json_decode($dbTokenJson, true);

            // 5. In-Memory Configuration Overrides (Zero .env file on disk!)
            if (!empty($secrets['APP_KEY'])) {
                config(['app.key' => $secrets['APP_KEY']]);
            }

            if (!empty($secrets['STRIPE_SECRET'])) {
                config(['services.stripe.secret' => $secrets['STRIPE_SECRET']]);
            }

            if (!empty($secrets['OPENAI_API_KEY'])) {
                config(['services.openai.api_key' => $secrets['OPENAI_API_KEY']]);
            }

            // Passwordless PostgreSQL configuration
            if (!empty($dbToken['auth_token'])) {
                config([
                    'database.connections.pgsql.host' => $dbToken['db_host'],
                    'database.connections.pgsql.port' => $dbToken['db_port'],
                    'database.connections.pgsql.database' => $dbToken['db_name'],
                    'database.connections.pgsql.username' => $dbToken['db_user'],
                    'database.connections.pgsql.password' => $dbToken['auth_token'],
                ]);
            }

        } catch (\Throwable $e) {
            // Log warning or fallback
            logger()->warning('TryBase secret loading encountered an error: ' . $e->getMessage());
        }
    }

    /**
     * Internal cURL helper targeting Linux Unix Domain Socket
     */
    protected function querySocket(string $method, string $path, array $headers = []): string
    {
        $ch = curl_init('http://localhost' . $path);
        curl_setopt($ch, CURLOPT_UNIX_SOCKET_PATH, $this->socketPath);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        $response = curl_exec($ch);
        curl_close($ch);

        return $response ?: '';
    }
}
