const assert = require('assert');
const { TryBaseClient, loadSecrets } = require('./dist/client.js');

async function runTests() {
  console.log('Running TypeScript/Node TryBase Client Tests...');

  // Test 1: Fail closed in production
  console.log('Test 1: Fail closed in production with missing socket...');
  process.env.NODE_ENV = 'production';
  process.env.TRYBASE_SOCKET_PATH = '/tmp/non_existent_ts_socket.sock';
  delete process.env.TRYBASE_LOCAL_FALLBACK;

  const client = new TryBaseClient();
  assert.strictEqual(client.shouldFailClosed(), true);

  let threw = false;
  try {
    await loadSecrets();
  } catch (err) {
    threw = true;
    assert(err.message.includes('must fail closed'));
  }
  assert.strictEqual(threw, true, 'Must throw when socket missing in production');
  console.log(' PASSED');

  // Test 2: Local fallback
  console.log('Test 2: Local fallback allowed...');
  process.env.TRYBASE_LOCAL_FALLBACK = 'true';
  process.env.TEST_VAR = 'local_val';
  const localSecrets = await loadSecrets();
  assert.strictEqual(localSecrets.TEST_VAR, 'local_val');
  console.log(' PASSED');

  // Test 3: pg pool dynamic password config
  console.log('Test 3: getPgPoolConfig dynamic password hook...');
  const mockClient = new TryBaseClient();
  mockClient.getDatabaseToken = async () => ({
    db_host: 'rds.internal.vpc',
    db_port: 5432,
    db_user: 'usr_node_app',
    db_name: 'node_db',
    auth_token: 'ephemeral_sigv4_token_ts',
    ttl_seconds: 900,
    expires_at: new Date().toISOString()
  });

  const poolConfig = mockClient.getPgPoolConfig({ max: 20 });
  assert.strictEqual(poolConfig.max, 20);
  assert.strictEqual(poolConfig.ssl.rejectUnauthorized, true);
  assert.strictEqual(typeof poolConfig.password, 'function');

  // Call the dynamic password function (simulating pg pool checkout)
  const evaluatedPassword = await poolConfig.password();
  assert.strictEqual(evaluatedPassword, 'ephemeral_sigv4_token_ts');
  console.log(' PASSED');

  console.log('ALL NODE/TYPESCRIPT TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
