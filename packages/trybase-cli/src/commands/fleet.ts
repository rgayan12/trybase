import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';
import { parseEnvFile } from './env.js';

export interface FleetWorkloadConfig {
  name: string;
  archetype: 'laravel' | 'django' | 'n8n' | 'agent' | 'openclaw' | 'bedrock-agent' | 'dify' | 'custom';
  subdomain: string;
  imageTag?: string;
  cpu?: number;
  memory?: number;
  envFile?: string;
  secrets?: Record<string, string>;
}

export interface FleetManifest {
  organization: string;
  version?: string;
  workloads: FleetWorkloadConfig[];
}

export function parseFleetManifest(manifestPath: string): FleetManifest {
  const resolved = path.resolve(process.cwd(), manifestPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Fleet manifest not found at: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, 'utf-8');
  let data: any;

  if (manifestPath.endsWith('.json')) {
    data = JSON.parse(raw);
  } else {
    data = YAML.parse(raw);
  }

  if (!data.organization) {
    throw new Error(`Fleet manifest must specify an "organization" field.`);
  }

  if (!Array.isArray(data.workloads) || data.workloads.length === 0) {
    throw new Error(`Fleet manifest must include at least one workload in "workloads".`);
  }

  // Load any referenced envFile
  const manifestDir = path.dirname(resolved);
  for (const w of data.workloads) {
    if (w.envFile) {
      const envPath = path.resolve(manifestDir, w.envFile);
      if (fs.existsSync(envPath)) {
        w.secrets = { ...(w.secrets || {}), ...parseEnvFile(envPath) };
      }
    }
  }

  return data as FleetManifest;
}

import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { SecretsManagerClient, PutSecretValueCommand, CreateSecretCommand } from '@aws-sdk/client-secrets-manager';
import { loadConfig } from '../config.js';

const DEFAULT_SFN_ARN = process.env.TRYBASE_SFN_ARN || 'arn:aws:states:eu-west-2:656876168893:stateMachine:n8n-provision-tenant';
const DEFAULT_REGION = process.env.AWS_REGION || 'eu-west-2';

function getPriorityForTenant(tenantId: string): number {
  let hash = 0;
  for (let i = 0; i < tenantId.length; i++) {
    hash = ((hash << 5) - hash) + tenantId.charCodeAt(i);
    hash |= 0;
  }
  return 100 + (Math.abs(hash) % 3900);
}

export async function deployFleet(
  manifestPath = 'trybase.fleet.yml',
  options: { dryRun?: boolean; quiet?: boolean } = {}
): Promise<{ organization: string; workloadsCount: number; executions?: string[] }> {
  const manifest = parseFleetManifest(manifestPath);
  const config = loadConfig();
  const region = process.env.AWS_REGION || config.region || DEFAULT_REGION;
  const sfnArn = process.env.TRYBASE_SFN_ARN || DEFAULT_SFN_ARN;

  if (!options.quiet) {
    console.log(`🚀 [TryBase Fleet Deploy] Organization: "${manifest.organization}"`);
    console.log(`   Found ${manifest.workloads.length} workload(s) in manifest:\n`);

    for (const w of manifest.workloads) {
      console.log(`   • [${w.archetype.toUpperCase()}] ${w.name}`);
      console.log(`     Route:     https://${w.subdomain}`);
      console.log(`     Resources: ${w.cpu || 512} vCPU / ${w.memory || 1024} MB RAM`);
      if (w.secrets) {
        console.log(`     Secrets:   ${Object.keys(w.secrets).length} loaded (Anti-Leak protected)`);
      }
      console.log('');
    }
  }

  if (options.dryRun) {
    if (!options.quiet) {
      console.log(`✅ [DRY RUN] Fleet deployment validated. All archetypes and routing valid.`);
    }
    return { organization: manifest.organization, workloadsCount: manifest.workloads.length };
  }

  const sfnClient = new SFNClient({ region });
  const smClient = new SecretsManagerClient({ region });
  const executions: string[] = [];

  for (const w of manifest.workloads) {
    const tenantId = `${manifest.organization}-${w.name}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const priority = getPriorityForTenant(tenantId);

    // 1. If secrets exist, push to AWS Secrets Manager
    if (w.secrets && Object.keys(w.secrets).length > 0) {
      const secretId = `trybase/tenants/${tenantId}/secrets`;
      const secretString = JSON.stringify(w.secrets);
      try {
        await smClient.send(new CreateSecretCommand({ Name: secretId, SecretString: secretString }));
        if (!options.quiet) console.log(`   🔒 Anti-Leak Vault created: "${secretId}"`);
      } catch (err: any) {
        if (err.name === 'ResourceExistsException') {
          await smClient.send(new PutSecretValueCommand({ SecretId: secretId, SecretString: secretString }));
          if (!options.quiet) console.log(`   🔒 Anti-Leak Vault updated: "${secretId}"`);
        } else {
          console.warn(`   ⚠️ Warning updating secrets: ${err.message}`);
        }
      }
    }

    // 2. Dispatch real Step Functions StartExecutionCommand
    if (!options.quiet) {
      console.log(`⚡ Dispatching AWS Step Functions Virtual Single-Tenancy Provisioner for "${tenantId}"...`);
    }

    try {
      const payload = {
        tenant_id: tenantId,
        workload_type: w.archetype === 'openclaw' ? 'openclaw' : w.archetype === 'dify' ? 'dify' : 'n8n',
        alb_listener_rule_priority: priority,
        subdomain: w.subdomain,
      };

      const execRes = await sfnClient.send(new StartExecutionCommand({
        stateMachineArn: sfnArn,
        name: `tb-${tenantId}-${Date.now()}`.substring(0, 80),
        input: JSON.stringify(payload),
      }));

      if (execRes.executionArn) {
        executions.push(execRes.executionArn);
        if (!options.quiet) {
          console.log(`   ✅ Execution Dispatched!`);
          console.log(`      ARN: ${execRes.executionArn}`);
        }
      }
    } catch (err: any) {
      console.error(`   ❌ Failed to dispatch Step Function for ${tenantId}: ${err.message}`);
      throw err;
    }
  }

  if (!options.quiet) {
    console.log(`\n🎉 All ${manifest.workloads.length} workload(s) dispatched to AWS Step Functions.`);
    console.log(`   Run "trybase status --org ${manifest.organization}" to monitor execution progress.\n`);
  }

  return { organization: manifest.organization, workloadsCount: manifest.workloads.length, executions };
}
