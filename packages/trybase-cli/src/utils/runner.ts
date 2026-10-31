import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Searches upward from the current directory to locate the TryBase repository root.
 */
export function findRepoRoot(startDir: string = process.cwd()): string {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (current !== root) {
    if (
      (fs.existsSync(path.join(current, 'terraform')) && fs.existsSync(path.join(current, 'Makefile'))) ||
      fs.existsSync(path.join(current, 'trybase.fleet.yml')) ||
      fs.existsSync(path.join(current, 'trybase.fleet.yml.example'))
    ) {
      return current;
    }
    current = path.dirname(current);
  }

  // Fallback to current working directory
  return process.cwd();
}

/**
 * Spawns an executable with inherited stdio, allowing interactive prompts and direct terminal streaming.
 */
export function runInteractive(
  executable: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: 'inherit',
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      resolve(code ?? 0);
    });
  });
}

/**
 * Captures stdout and stderr for quiet diagnostic checks.
 */
export function captureCommand(
  executable: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      resolve({ code: 1, stdout: '', stderr: err.message });
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}
