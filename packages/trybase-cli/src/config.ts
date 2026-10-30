import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface TryBaseConfig {
  sessionToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  userEmail?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  apiUrl?: string;
  defaultOrg?: string;
  region?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.trybase');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function loadConfig(): TryBaseConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // Return empty on parse error
  }
  return {
    apiUrl: process.env.TRYBASE_API_URL || 'https://pweai7qxlh.execute-api.eu-west-2.amazonaws.com/provision',
    sessionToken: process.env.TRYBASE_SESSION_TOKEN || process.env.SUPABASE_ACCESS_TOKEN,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY,
    region: process.env.AWS_REGION || 'eu-west-2',
    defaultOrg: process.env.TRYBASE_ORG || 'default',
  };
}

export function saveConfig(cfg: Partial<TryBaseConfig>): void {
  const current = loadConfig();
  const merged = { ...current, ...cfg };

  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), {
    mode: 0o600,
  });
}
