#!/usr/bin/env node
import { Command } from 'commander';
import { pushSecrets } from './commands/env.js';
import { deployFleet } from './commands/fleet.js';
import { statusCommand } from './commands/status.js';
import { loginCommand } from './commands/login.js';
import { doctorCommand } from './commands/doctor.js';
import { 
  bootstrapCommand, 
  controlPlaneCommand, 
  infraCommand, 
  upCommand, 
  costCommand, 
  destroyCommand, 
  syncCommand 
} from './commands/ops.js';
import { webCommand } from './commands/web.js';

const program = new Command();

program
  .name('trybase')
  .description('The Developer CLI for TryBase Virtual Single-Tenancy & The Anti-Leak Standard')
  .version('0.1.0');

// 1. Diagnostics & Health
program
  .command('doctor')
  .alias('check')
  .description('Verify workstation dependencies (Terraform, AWS, Docker, Node, Supabase CLI)')
  .action(async () => {
    await doctorCommand();
  });

// 2. Platform Lifecycle Commands
program
  .command('bootstrap')
  .description('Provision S3 remote state bucket and DynamoDB lock table for Terraform')
  .action(async () => {
    await bootstrapCommand();
  });

program
  .command('control-plane')
  .description('Deploy Supabase database migrations, Edge Functions, and auto-configure JWKS')
  .option('-r, --ref <ref>', 'Supabase Project Reference ID')
  .option('-u, --url <url>', 'Supabase Project URL')
  .action(async (options) => {
    await controlPlaneCommand(options);
  });

program
  .command('infra')
  .description('Deploy AWS Fleet infrastructure (VPC, Graviton RDS, ALB, Step Functions, ECS)')
  .action(async () => {
    await infraCommand();
  });

program
  .command('up')
  .description('One-command full deployment: Control Plane (Supabase) + AWS Fleet (Terraform)')
  .action(async () => {
    await upCommand();
  });

program
  .command('web')
  .alias('ui')
  .alias('console')
  .description('Start the local React web dashboard and documentation console')
  .action(async () => {
    await webCommand();
  });

program
  .command('cost')
  .description('Forecast cloud infrastructure costs using Infracost')
  .action(async () => {
    await costCommand();
  });

program
  .command('destroy')
  .description('Tear down AWS Fleet infrastructure cleanly with automatic ENI cleanup')
  .action(async () => {
    await destroyCommand();
  });

program
  .command('sync')
  .description('Sync remote tenant state from S3 to local Git')
  .action(async () => {
    await syncCommand();
  });

// 3. Authentication & Secrets
program
  .command('login')
  .description('Authenticate the CLI with your TryBase Control Plane via ephemeral Supabase tokens')
  .option('-t, --token <jwt>', 'Ephemeral Supabase session token')
  .option('-e, --email <email>', 'User email')
  .option('-p, --password <password>', 'User password')
  .option('-o, --org <org>', 'Default Organization slug')
  .option('--supabase-url <url>', 'Supabase Project URL')
  .option('--supabase-key <key>', 'Supabase Anon/Publishable API Key')
  .action(async (options) => {
    await loginCommand(options);
  });

const envCmd = program.command('env').description('Manage secrets with the Anti-Leak Standard');

envCmd
  .command('push [file]')
  .description('Push local .env file directly to AWS Secrets Manager without writing to production disk')
  .option('-t, --tenant <tenant>', 'Tenant ID')
  .option('-w, --workload <workload>', 'Workload name within organization')
  .option('-o, --org <org>', 'Organization slug')
  .option('--dry-run', 'Preview parsed secrets without pushing to AWS')
  .action(async (file = '.env', options) => {
    try {
      await pushSecrets(file, options);
    } catch (err: any) {
      console.error(`❌ Error pushing secrets: ${err.message}`);
      process.exit(1);
    }
  });

// 4. Fleet Orchestration
const fleetCmd = program.command('fleet').description('Manage multi-workload fleets');

fleetCmd
  .command('deploy [manifest]')
  .description('Deploy or update an entire organization fleet from trybase.fleet.yml')
  .option('--dry-run', 'Validate manifest without dispatching AWS Step Functions')
  .action(async (manifest = 'trybase.fleet.yml', options) => {
    try {
      await deployFleet(manifest, options);
    } catch (err: any) {
      console.error(`❌ Error deploying fleet: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Inspect running workloads and health for your organization')
  .option('-o, --org <org>', 'Organization slug')
  .action(async (options) => {
    await statusCommand(options);
  });

program.parse(process.argv);
