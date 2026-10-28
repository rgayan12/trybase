import test from 'node:test';
import assert from 'node:assert/strict';
import { MockInfrastructureProvider } from './provider.js';
import { TOOLS, PROMPTS, handleToolCall } from './tools.js';

test('TryBase MCP Tools Definition', () => {
  assert.equal(TOOLS.length, 9);
  const toolNames = TOOLS.map((t) => t.name);
  assert.ok(toolNames.includes('trybase_list_workloads'));
  assert.ok(toolNames.includes('trybase_deploy_workload'));
  assert.ok(toolNames.includes('trybase_get_container_logs'));
  assert.ok(toolNames.includes('trybase_scale_workload'));
  assert.ok(toolNames.includes('trybase_restart_workload'));
  assert.ok(toolNames.includes('trybase_create_backup'));
  assert.ok(toolNames.includes('trybase_set_secrets'));
  assert.ok(toolNames.includes('trybase_run_migration'));
  assert.ok(toolNames.includes('trybase_exec_command'));
});

test('TryBase MCP Prompts Definition', () => {
  assert.equal(PROMPTS.length, 2);
  const promptNames = PROMPTS.map((p) => p.name);
  assert.ok(promptNames.includes('trybase_autonomous_sre'));
  assert.ok(promptNames.includes('trybase_fleet_deploy'));
});

test('MockInfrastructureProvider - List and Inspect Workloads', async () => {
  const provider = new MockInfrastructureProvider();
  const workloads = await provider.listWorkloads();
  assert.ok(workloads.length >= 4);

  const acme = workloads.find((w) => w.tenantId === 'acme-corp');
  assert.ok(acme);
  assert.equal(acme.archetype, 'laravel');
  assert.equal(acme.status, 'HEALTHY');

  const wayne = workloads.find((w) => w.tenantId === 'wayne-enterprises');
  assert.ok(wayne);
  assert.equal(wayne.archetype, 'django');
  assert.equal(wayne.status, 'DEGRADED');
  assert.ok((wayne.metrics?.memoryUtilizationPercent ?? 0) > 85);
});

test('Tool Execution - Deploy Workload', async () => {
  const provider = new MockInfrastructureProvider();
  const res = await handleToolCall(provider, 'trybase_deploy_workload', {
    tenantId: 'test-laravel-app',
    subdomain: 'test-laravel',
    archetype: 'laravel',
    cpu: 512,
    memory: 1024,
    secrets: {
      APP_KEY: 'base64:mocksecretappkey',
      STRIPE_SECRET: 'sk_live_mockstripe',
    },
  });

  assert.equal(res.isError, undefined);
  const parsed = JSON.parse(res.content[0].text);
  assert.equal(parsed.status, 'PROVISIONING_STARTED');
  assert.ok(parsed.executionArn.includes('arn:aws:states'));

  const created = await provider.getWorkload('test-laravel-app');
  assert.ok(created);
  assert.equal(created.archetype, 'laravel');
});

test('Tool Execution - Logs with Filter', async () => {
  const provider = new MockInfrastructureProvider();
  const res = await handleToolCall(provider, 'trybase_get_container_logs', {
    tenantId: 'wayne-enterprises',
    limit: 10,
    filter: 'OOM',
  });

  assert.equal(res.isError, undefined);
  const logs = JSON.parse(res.content[0].text);
  assert.ok(logs.length > 0);
  assert.ok(logs[0].message.includes('OOM'));
});

test('Tool Execution - Database Migration Scoped to Tenant Schema', async () => {
  const provider = new MockInfrastructureProvider();
  const res = await handleToolCall(provider, 'trybase_run_migration', {
    tenantId: 'acme-corp',
  });

  assert.equal(res.isError, undefined);
  const mig = JSON.parse(res.content[0].text);
  assert.equal(mig.exitCode, 0);
  assert.ok(mig.output.includes('schema_acme-corp'));
  assert.ok(mig.appliedMigrations.length >= 2);
});

test('Autonomous SRE Scenario - Detect OOM, Backup, Scale, and Heal', async () => {
  const provider = new MockInfrastructureProvider();

  // 1. Inspect cluster
  const listRes = await handleToolCall(provider, 'trybase_list_workloads', {});
  const workloads = JSON.parse(listRes.content[0].text);
  const degradedTenant = workloads.find((w: any) => w.status === 'DEGRADED');

  assert.ok(degradedTenant);
  assert.equal(degradedTenant.tenantId, 'wayne-enterprises');

  // 2. Fetch error logs
  const logsRes = await handleToolCall(provider, 'trybase_get_container_logs', {
    tenantId: degradedTenant.tenantId,
    filter: 'OOM',
  });
  const logs = JSON.parse(logsRes.content[0].text);
  assert.ok(logs.some((l: any) => l.level === 'ERROR'));

  // 3. Take safety backup before scaling
  const backupRes = await handleToolCall(provider, 'trybase_create_backup', {
    tenantId: degradedTenant.tenantId,
    label: 'pre-scale-safety-backup',
  });
  const backup = JSON.parse(backupRes.content[0].text);
  assert.equal(backup.status, 'COMPLETED');
  assert.ok(backup.s3Uri.includes('s3://trybase-backups-production'));

  // 4. Scale workload from 1024MB to 2048MB
  const scaleRes = await handleToolCall(provider, 'trybase_scale_workload', {
    tenantId: degradedTenant.tenantId,
    cpu: 1024,
    memory: 2048,
  });
  const scaleResult = JSON.parse(scaleRes.content[0].text);
  assert.equal(scaleResult.status, 'SCALED');
  assert.equal(scaleResult.current.memory, 2048);

  // 5. Verify the workload has healed to HEALTHY!
  const healed = await provider.getWorkload(degradedTenant.tenantId);
  assert.ok(healed);
  assert.equal(healed.status, 'HEALTHY');
  assert.ok((healed.metrics?.memoryUtilizationPercent ?? 100) < 50);
});

test('Interactive Sandbox Execution - trybase_exec_command', async () => {
  const provider = new MockInfrastructureProvider();

  // 1. Run pwd in sandbox
  const pwdRes = await handleToolCall(provider, 'trybase_exec_command', {
    tenantId: 'acme-corp',
    command: 'pwd',
  });
  assert.equal(pwdRes.isError, undefined);
  const pwdData = JSON.parse(pwdRes.content[0].text);
  assert.equal(pwdData.exitCode, 0);
  assert.equal(pwdData.stdout.trim(), '/var/www/html');

  // 2. Run ls in agent sandbox
  const lsRes = await handleToolCall(provider, 'trybase_exec_command', {
    tenantId: 'research-agent',
    command: 'ls',
  });
  assert.equal(lsRes.isError, undefined);
  const lsData = JSON.parse(lsRes.content[0].text);
  assert.equal(lsData.exitCode, 0);
  assert.ok(lsData.stdout.includes('agent.py'));
  assert.ok(lsData.stdout.includes('memory'));

  // 3. Run env in sandbox (verify Anti-Leak standard)
  const envRes = await handleToolCall(provider, 'trybase_exec_command', {
    tenantId: 'research-agent',
    command: 'env',
  });
  assert.equal(envRes.isError, undefined);
  const envData = JSON.parse(envRes.content[0].text);
  assert.equal(envData.exitCode, 0);
  assert.ok(envData.stdout.includes('Anti-Leak Standard'));

  // 4. Test execution in sandbox
  const testRes = await handleToolCall(provider, 'trybase_exec_command', {
    tenantId: 'acme-corp',
    command: 'php artisan test',
  });
  assert.equal(testRes.isError, undefined);
  const testData = JSON.parse(testRes.content[0].text);
  assert.equal(testData.exitCode, 0);
  assert.ok(testData.stdout.includes('passing'));

  // 5. Failing command in sandbox
  const failRes = await handleToolCall(provider, 'trybase_exec_command', {
    tenantId: 'acme-corp',
    command: 'exit 1',
  });
  assert.equal(failRes.isError, undefined);
  const failData = JSON.parse(failRes.content[0].text);
  assert.equal(failData.exitCode, 1);
  assert.ok(failData.stderr.includes('failed with exit code 1'));
});

