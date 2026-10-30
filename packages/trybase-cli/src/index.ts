#!/usr/bin/env node
import { Command } from 'commander';
import { pushSecrets } from './commands/env.js';
import { deployFleet } from './commands/fleet.js';
import { statusCommand } from './commands/status.js';
import { loginCommand } from './commands/login.js';

const program = new Command();

program
  .name('trybase')
  .description('The Developer CLI for TryBase Virtual Single-Tenancy & The Anti-Leak Standard')
  .version('0.1.0');

// trybase login
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

// trybase env push
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

// trybase fleet deploy
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

// trybase status
program
  .command('status')
  .description('Inspect running workloads and health for your organization')
  .option('-o, --org <org>', 'Organization slug')
  .action(async (options) => {
    await statusCommand(options);
  });

program.parse(process.argv);
