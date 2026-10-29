import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { parseEnvFile, pushSecrets } from './commands/env.js';
import { parseFleetManifest, deployFleet } from './commands/fleet.js';

test('CLI - parseEnvFile parses key-value pairs and ignores comments', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trybase-test-'));
  const envPath = path.join(tmpDir, '.env.production');

  fs.writeFileSync(
    envPath,
    `# Production Secrets
DATABASE_URL=postgres://user:pass@db:5432/app
APP_KEY=base64:securekey12345
OPENAI_API_KEY=sk-mockopenai12345
# Trailing comment
DEBUG=false
`
  );

  const secrets = parseEnvFile(envPath);
  assert.equal(Object.keys(secrets).length, 4);
  assert.equal(secrets.DATABASE_URL, 'postgres://user:pass@db:5432/app');
  assert.equal(secrets.APP_KEY, 'base64:securekey12345');
  assert.equal(secrets.OPENAI_API_KEY, 'sk-mockopenai12345');
  assert.equal(secrets.DEBUG, 'false');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('CLI - pushSecrets with dry-run validates keys without network', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trybase-test-'));
  const envPath = path.join(tmpDir, '.env');

  fs.writeFileSync(envPath, `STRIPE_KEY=sk_test_123\nAWS_BUCKET=my-bucket\n`);

  const res = await pushSecrets(envPath, {
    tenant: 'acme-corp',
    dryRun: true,
    quiet: true,
  });

  assert.equal(res.tenantId, 'acme-corp');
  assert.equal(res.secretCount, 2);
  assert.deepEqual(res.keys, ['STRIPE_KEY', 'AWS_BUCKET']);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('CLI - parseFleetManifest parses multi-workload YAML manifest', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trybase-test-'));
  const manifestPath = path.join(tmpDir, 'trybase.fleet.yml');

  fs.writeFileSync(
    manifestPath,
    `organization: acme-ai
version: "1.0"
workloads:
  - name: workflow
    archetype: n8n
    subdomain: n8n.acme.trybase.dev
    cpu: 1024
    memory: 2048
  - name: knowledge
    archetype: dify
    subdomain: dify.acme.trybase.dev
  - name: runner
    archetype: openclaw
    subdomain: agent.acme.trybase.dev
`
  );

  const manifest = parseFleetManifest(manifestPath);
  assert.equal(manifest.organization, 'acme-ai');
  assert.equal(manifest.workloads.length, 3);
  assert.equal(manifest.workloads[0].name, 'workflow');
  assert.equal(manifest.workloads[0].archetype, 'n8n');
  assert.equal(manifest.workloads[1].archetype, 'dify');
  assert.equal(manifest.workloads[2].archetype, 'openclaw');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('CLI - deployFleet dry-run succeeds on valid manifest', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trybase-test-'));
  const manifestPath = path.join(tmpDir, 'trybase.fleet.yml');

  fs.writeFileSync(
    manifestPath,
    `organization: acme-ai
workloads:
  - name: core
    archetype: laravel
    subdomain: app.acme.trybase.dev
`
  );

  const res = await deployFleet(manifestPath, { dryRun: true, quiet: true });
  assert.equal(res.organization, 'acme-ai');
  assert.equal(res.workloadsCount, 1);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
