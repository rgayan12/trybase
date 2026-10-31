import { runInteractive, findRepoRoot } from '../utils/runner.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export async function webCommand(): Promise<void> {
  const root = findRepoRoot();
  const webDir = path.join(root, 'web');

  if (!fs.existsSync(webDir)) {
    console.error(`\x1b[31m❌ Error: web/ directory not found in ${root}\x1b[0m`);
    process.exit(1);
  }

  // Check if dependencies are installed
  const nodeModules = path.join(webDir, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    console.log('\n\x1b[33m📦 Installing web dashboard dependencies...\x1b[0m\n');
    const installCode = await runInteractive('npm', ['install'], { cwd: webDir });
    if (installCode !== 0) {
      console.error(`\x1b[31m❌ npm install in web/ failed with code ${installCode}\x1b[0m`);
      process.exit(installCode);
    }
  }

  console.log('\n\x1b[1m\x1b[36m🚀 Starting TryBase Web Dashboard...\x1b[0m');
  console.log('  ➜ Local Console: \x1b[1m\x1b[32mhttp://localhost:5173/\x1b[0m');
  console.log('  ➜ Documentation: \x1b[1m\x1b[32mhttp://localhost:5173/docs\x1b[0m\n');

  const code = await runInteractive('npm', ['run', 'dev'], { cwd: webDir });
  if (code !== 0) {
    process.exit(code);
  }
}
