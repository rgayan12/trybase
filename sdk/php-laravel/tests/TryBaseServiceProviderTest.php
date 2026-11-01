<?php

namespace Illuminate\Support {
    if (!class_exists(ServiceProvider::class)) {
        class ServiceProvider {
            public $app;
            public function __construct($app) {
                $this->app = $app;
            }
        }
    }
}

namespace Illuminate\Database\Connectors {
    if (!class_exists(PostgresConnector::class)) {
        class PostgresConnector {
            public function connect(array $config) {
                return $config;
            }
        }
    }
}

namespace {
    if (!function_exists('config')) {
        $GLOBALS['__mock_config'] = [];
        function config($key = null, $default = null) {
            if (is_array($key)) {
                foreach ($key as $k => $v) {
                    $GLOBALS['__mock_config'][$k] = $v;
                }
                return null;
            }
            if ($key === null) {
                return $GLOBALS['__mock_config'];
            }
            return $GLOBALS['__mock_config'][$key] ?? $default;
        }
    }

    if (!function_exists('env')) {
        function env($key, $default = null) {
            $val = getenv($key);
            if ($val === false) {
                return $default;
            }
            return match (strtolower($val)) {
                'true', '(true)' => true,
                'false', '(false)' => false,
                'empty', '(empty)' => '',
                'null', '(null)' => null,
                default => $val,
            };
        }
    }

    if (!function_exists('logger')) {
        function logger() {
            return new class {
                public function warning($msg) {}
                public function info($msg) {}
            };
        }
    }

    require_once dirname(__DIR__) . '/TryBaseServiceProvider.php';

    use App\Providers\TryBaseServiceProvider;
    use App\Providers\TryBasePostgresConnector;

    echo "Running TryBase Laravel Provider Unit Tests...\n";

    // Test 1: Config Caching Protection
    echo "Test 1: Config Caching Protection...";
    $_SERVER['argv'] = ['artisan', 'config:cache'];
    $mockApp = new class {
        public function environment(...$envs) { return false; }
        public function runningInConsole() { return true; }
        public function bound($key) { return false; }
    };
    $provider = new TryBaseServiceProvider($mockApp);
    $provider->register();
    assert(!isset($GLOBALS['__mock_config']['app.key']), "app.key should not be set during config:cache");
    echo " PASSED\n";

    // Test 2: Fail Closed in Production with Missing Socket
    echo "Test 2: Fail Closed in Production with Missing Socket...";
    $_SERVER['argv'] = ['artisan', 'serve'];
    $mockProdApp = new class {
        public function environment(...$envs) { return in_array('production', $envs); }
        public function runningInConsole() { return false; }
        public function bound($key) { return false; }
    };
    putenv('TRYBASE_SOCKET_PATH=/tmp/non_existent_trybase_socket_' . uniqid() . '.sock');
    putenv('TRYBASE_LOCAL_FALLBACK=false');
    $prodProvider = new TryBaseServiceProvider($mockProdApp);
    $threw = false;
    try {
        $prodProvider->register();
    } catch (\RuntimeException $e) {
        $threw = true;
        assert(str_contains($e->getMessage(), 'must fail closed'));
    }
    assert($threw, "Production must throw RuntimeException when socket is missing and fallback is false");
    echo " PASSED\n";

    // Test 3: Local Fallback Allowed in Local Environment
    echo "Test 3: Local Fallback Allowed in Local Environment...";
    $mockLocalApp = new class {
        public function environment(...$envs) { return false; }
        public function runningInConsole() { return false; }
        public function bound($key) { return false; }
    };
    putenv('TRYBASE_LOCAL_FALLBACK=true');
    $localProvider = new TryBaseServiceProvider($mockLocalApp);
    $localProvider->register();
    putenv('TRYBASE_LOCAL_FALLBACK=false');
    echo " PASSED\n";

    // Test 4: PostgresConnector Dynamic Token Injection & TLS verification
    echo "Test 4: PostgresConnector Dynamic Token Injection & TLS...";
    $mockProviderWithToken = new class($mockProdApp) extends TryBaseServiceProvider {
        public function fetchDatabaseToken(): array {
            return [
                'db_host' => 'rds.internal.vpc',
                'db_port' => 5432,
                'db_user' => 'usr_tenant',
                'db_name' => 'trybase_db',
                'auth_token' => 'mock_sigv4_iam_token_123',
            ];
        }
    };
    $connector = new TryBasePostgresConnector($mockProviderWithToken);
    $configResult = $connector->connect([
        'trybase_iam' => true,
        'driver' => 'pgsql',
    ]);
    assert($configResult['password'] === 'mock_sigv4_iam_token_123', "Password must match dynamic IAM token");
    assert($configResult['host'] === 'rds.internal.vpc', "Host must be set from token response");
    assert($configResult['sslmode'] === 'verify-full', "Default sslmode must be verify-full");
    assert(TryBasePostgresConnector::isConnectionStale(0) === true, "Connection freshness tracking must work");
    echo " PASSED\n";

    // Test 5: HTTP Error Handling (Fail closed on HTTP 500)
    echo "Test 5: HTTP Error Handling (Fail Closed on 500)...";
    $mockFailingProvider = new class($mockProdApp) extends TryBaseServiceProvider {
        public function querySocket(string $method, string $path, array $headers = [], bool $allowNotFound = false): ?string {
            if ($this->shouldFailClosed()) {
                throw new \RuntimeException("TryBase socket request {$method} {$path} returned HTTP 500: Internal Server Error");
            }
            return null;
        }
    };
    $threw500 = false;
    try {
        $mockFailingProvider->loadSecrets();
    } catch (\RuntimeException $e) {
        $threw500 = true;
        assert(str_contains($e->getMessage(), 'HTTP 500'));
    }
    assert($threw500, "Should fail closed on HTTP 500");
    echo " PASSED\n";

    // Test 6: Scoped Keys (Narrow Blast Radius)
    echo "Test 6: Scoped Keys (Narrow Blast Radius)...";
    $mockScopedProvider = new class($mockProdApp) extends TryBaseServiceProvider {
        public array $queriedKeys = [];
        public function getSessionToken(int $ttlSeconds = 60): string {
            return "session_token_123";
        }
        public function fetchSecret(string $key): ?string {
            $this->queriedKeys[] = $key;
            return "val_for_" . $key;
        }
    };
    putenv('TRYBASE_SECRET_KEYS=APP_KEY,STRIPE_SECRET');
    $loaded = $mockScopedProvider->loadSecrets();
    assert(isset($loaded['APP_KEY']) && $loaded['APP_KEY'] === 'val_for_APP_KEY');
    assert(isset($loaded['STRIPE_SECRET']) && $loaded['STRIPE_SECRET'] === 'val_for_STRIPE_SECRET');
    assert($mockScopedProvider->queriedKeys === ['APP_KEY', 'STRIPE_SECRET'], "Should only query the configured keys");
    putenv('TRYBASE_SECRET_KEYS=');
    echo " PASSED\n";

    echo "ALL 6 LARAVEL PROVIDER TESTS PASSED!\n";
}
