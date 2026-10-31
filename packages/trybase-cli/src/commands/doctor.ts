import { captureCommand, findRepoRoot } from '../utils/runner.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface CheckResult {
  name: string;
  passed: boolean;
  required: boolean;
  message: string;
  fix?: string;
}

export async function doctorCommand(): Promise<void> {
  const root = findRepoRoot();
  console.log('\n\x1b[1m\x1b[36m🩺 TryBase Pre-Flight Health Check\x1b[0m');
  console.log(`Repository Root: \x1b[33m${root}\x1b[0m\n`);

  const results: CheckResult[] = [];

  // 1. Check Node.js
  const nodeVer = process.version;
  const major = parseInt(nodeVer.replace('v', '').split('.')[0], 10);
  if (major >= 18) {
    results.push({
      name: 'Node.js',
      passed: true,
      required: true,
      message: `${nodeVer} (>= 18.0.0 required)`,
    });
  } else {
    results.push({
      name: 'Node.js',
      passed: false,
      required: true,
      message: `${nodeVer} (requires Node.js 18 or later)`,
      fix: 'Install modern LTS from https://nodejs.org',
    });
  }

  // 2. Check Terraform
  const tf = await captureCommand('terraform', ['version']);
  if (tf.code === 0) {
    const firstLine = tf.stdout.split('\n')[0].replace('Terraform ', '').trim();
    results.push({
      name: 'Terraform',
      passed: true,
      required: true,
      message: firstLine,
    });
  } else {
    results.push({
      name: 'Terraform',
      passed: false,
      required: true,
      message: 'Not found or not in PATH',
      fix: 'brew install hashicorp/tap/terraform  (or https://developer.hashicorp.com/terraform/downloads)',
    });
  }

  // 3. Check AWS CLI & Credentials
  const awsVer = await captureCommand('aws', ['--version']);
  if (awsVer.code === 0) {
    const sts = await captureCommand('aws', ['sts', 'get-caller-identity', '--output', 'json']);
    if (sts.code === 0) {
      try {
        const id = JSON.parse(sts.stdout);
        const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'default';
        results.push({
          name: 'AWS Credentials',
          passed: true,
          required: true,
          message: `Account: ${id.Account} (${region})`,
        });
      } catch {
        results.push({
          name: 'AWS Credentials',
          passed: true,
          required: true,
          message: 'Authenticated',
        });
      }
    } else {
      results.push({
        name: 'AWS Credentials',
        passed: false,
        required: true,
        message: 'AWS CLI installed but not authenticated',
        fix: "Run 'aws configure' with an active Access Key and Secret Key.",
      });
    }
  } else {
    results.push({
      name: 'AWS CLI',
      passed: false,
      required: true,
      message: 'Not installed or not in PATH',
      fix: 'Install AWS CLI v2: https://aws.amazon.com/cli/',
    });
  }

  // 4. Check Docker Daemon
  const dockerVer = await captureCommand('docker', ['info']);
  if (dockerVer.code === 0) {
    results.push({
      name: 'Docker Daemon',
      passed: true,
      required: true,
      message: 'Running',
    });
  } else {
    results.push({
      name: 'Docker Daemon',
      passed: false,
      required: true,
      message: 'Docker is not running or not installed',
      fix: 'Start Docker Desktop (required for building the create-schema Lambda image).',
    });
  }

  // 5. Check Supabase CLI & Authentication
  const supaVer = await captureCommand('supabase', ['--version']);
  if (supaVer.code === 0) {
    const ver = supaVer.stdout.trim().split('\n')[0];
    const supaAuth = await captureCommand('supabase', ['projects', 'list']);
    if (supaAuth.code === 0) {
      results.push({
        name: 'Supabase CLI',
        passed: true,
        required: true,
        message: `Authenticated (v${ver})`,
      });
    } else {
      results.push({
        name: 'Supabase CLI',
        passed: false,
        required: true,
        message: `Installed (v${ver}) but not logged in`,
        fix: "Run 'supabase login' to authenticate with your Supabase account.",
      });
    }
  } else {
    results.push({
      name: 'Supabase CLI',
      passed: false,
      required: true,
      message: 'Not installed',
      fix: 'brew install supabase/tap/supabase (or npm install -g supabase)',
    });
  }

  // 6. Check Infracost (Optional)
  const infraVer = await captureCommand('infracost', ['--version']);
  if (infraVer.code === 0) {
    results.push({
      name: 'Infracost (FinOps)',
      passed: true,
      required: false,
      message: infraVer.stdout.trim().split('\n')[0],
    });
  } else {
    results.push({
      name: 'Infracost (FinOps)',
      passed: false,
      required: false,
      message: 'Not installed (Optional for cost breakdown)',
      fix: 'brew install infracost && infracost auth login',
    });
  }

  // 7. Check Terraform Folder & Variables
  const tfDir = path.join(root, 'terraform');
  if (fs.existsSync(tfDir)) {
    const tfvars = path.join(tfDir, 'terraform.tfvars');
    if (fs.existsSync(tfvars)) {
      results.push({
        name: 'Infrastructure Config',
        passed: true,
        required: true,
        message: 'terraform.tfvars present',
      });
    } else {
      results.push({
        name: 'Infrastructure Config',
        passed: false,
        required: false,
        message: 'terraform.tfvars not yet created',
        fix: 'Run: cp terraform/terraform.tfvars.example terraform/terraform.tfvars',
      });
    }
  }

  // Print Clean Report
  let allRequiredPassed = true;

  for (const res of results) {
    if (res.passed) {
      console.log(`  \x1b[32m✔\x1b[0m \x1b[1m${res.name.padEnd(24)}\x1b[0m ${res.message}`);
    } else if (res.required) {
      allRequiredPassed = false;
      console.log(`  \x1b[31m✖\x1b[0m \x1b[1m${res.name.padEnd(24)}\x1b[0m \x1b[31m${res.message}\x1b[0m`);
      if (res.fix) {
        console.log(`    \x1b[33m↳ Fix: ${res.fix}\x1b[0m`);
      }
    } else {
      console.log(`  \x1b[33mℹ\x1b[0m \x1b[1m${res.name.padEnd(24)}\x1b[0m \x1b[33m${res.message}\x1b[0m`);
      if (res.fix) {
        console.log(`    \x1b[90m↳ Note: ${res.fix}\x1b[0m`);
      }
    }
  }

  console.log('\n──────────────────────────────────────────────────────────────────');
  if (allRequiredPassed) {
    console.log('\x1b[1m\x1b[32m🎉 All required tools operational! Workstation is ready.\x1b[0m\n');
  } else {
    console.log('\x1b[1m\x1b[31m⚠️  Some required tools need attention before deploying.\x1b[0m\n');
    process.exit(1);
  }
}
