import { runInteractive, findRepoRoot } from '../utils/runner.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export async function bootstrapCommand(): Promise<void> {
  const root = findRepoRoot();
  const backendDir = path.join(root, 'terraform', 'setup-backend');

  if (!fs.existsSync(backendDir)) {
    console.error(`\x1b[31m❌ Error: terraform/setup-backend directory not found in ${root}\x1b[0m`);
    process.exit(1);
  }

  console.log('\n\x1b[1m\x1b[36m🚀 [TryBase] Bootstrapping Terraform Remote State Backend (S3 & DynamoDB)...\x1b[0m\n');

  console.log('Initializing Terraform in setup-backend...');
  const initCode = await runInteractive('terraform', ['init'], { cwd: backendDir });
  if (initCode !== 0) {
    console.error(`\x1b[31m❌ Terraform init failed (exit code ${initCode})\x1b[0m`);
    process.exit(initCode);
  }

  console.log('\nApplying remote state infrastructure...');
  const applyCode = await runInteractive('terraform', ['apply', '-auto-approve'], { cwd: backendDir });
  if (applyCode !== 0) {
    console.error(`\x1b[31m❌ Terraform apply failed (exit code ${applyCode})\x1b[0m`);
    process.exit(applyCode);
  }

  console.log('\n\x1b[1m\x1b[32m✅ Remote state backend provisioned successfully.\x1b[0m\n');
}

export async function controlPlaneCommand(options: { ref?: string; url?: string } = {}): Promise<void> {
  const root = findRepoRoot();
  const scriptPath = path.join(root, 'deploy-control-plane.sh');

  if (!fs.existsSync(scriptPath)) {
    console.error(`\x1b[31m❌ Error: deploy-control-plane.sh not found in ${root}\x1b[0m`);
    process.exit(1);
  }

  const args: string[] = [];
  const target = options.ref || options.url;
  if (target) {
    args.push(target);
  }

  const code = await runInteractive(scriptPath, args, { cwd: root });
  if (code !== 0) {
    process.exit(code);
  }
}

export async function infraCommand(): Promise<void> {
  const root = findRepoRoot();
  const scriptPath = path.join(root, 'deploy-infra.sh');

  if (!fs.existsSync(scriptPath)) {
    console.error(`\x1b[31m❌ Error: deploy-infra.sh not found in ${root}\x1b[0m`);
    process.exit(1);
  }

  const code = await runInteractive(scriptPath, [], { cwd: root });
  if (code !== 0) {
    process.exit(code);
  }
}

export async function upCommand(): Promise<void> {
  console.log('\n\x1b[1m\x1b[36m⚡ [TryBase] Full Platform Deployment (Control Plane + Fleet Infrastructure)\x1b[0m\n');
  await controlPlaneCommand();
  await infraCommand();
}

export async function costCommand(): Promise<void> {
  const root = findRepoRoot();
  const tfDir = path.join(root, 'terraform');

  console.log('\n\x1b[1m\x1b[36m💰 [TryBase FinOps] Running Infracost Cloud Spend Forecast...\x1b[0m\n');

  try {
    const code = await runInteractive('infracost', ['breakdown', '--path', tfDir], { cwd: root });
    if (code !== 0) {
      process.exit(code);
    }
  } catch {
    console.log('\n\x1b[1m\x1b[33m⚠️  Infracost is not installed or not in PATH.\x1b[0m');
    console.log('Install Infracost (Apache-2.0) to forecast exact cloud costs:');
    console.log('  brew install infracost   (macOS)');
    console.log('  curl -fsSL https://raw.githubusercontent.com/infracost/infracost/master/scripts/install.sh | sh  (Linux)');
    console.log("Then run 'infracost auth login' and retry 'trybase cost'.\n");
    process.exit(1);
  }
}

export async function destroyCommand(): Promise<void> {
  const root = findRepoRoot();
  const scriptPath = path.join(root, 'destroy-infra.sh');

  if (!fs.existsSync(scriptPath)) {
    console.error(`\x1b[31m❌ Error: destroy-infra.sh not found in ${root}\x1b[0m`);
    process.exit(1);
  }

  const code = await runInteractive(scriptPath, [], { cwd: root });
  if (code !== 0) {
    process.exit(code);
  }
}

export async function syncCommand(): Promise<void> {
  const root = findRepoRoot();
  const scriptPath = path.join(root, 'sync-tenants.sh');

  if (!fs.existsSync(scriptPath)) {
    console.error(`\x1b[31m❌ Error: sync-tenants.sh not found in ${root}\x1b[0m`);
    process.exit(1);
  }

  const code = await runInteractive(scriptPath, [], { cwd: root });
  if (code !== 0) {
    process.exit(code);
  }
}
