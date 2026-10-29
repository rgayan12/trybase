import { loadConfig, saveConfig } from '../config.js';

export interface LoginOptions {
  token?: string;
  email?: string;
  password?: string;
  org?: string;
  supabaseUrl?: string;
}

export async function loginCommand(options: LoginOptions): Promise<void> {
  const config = loadConfig();
  const supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL || config.supabaseUrl || 'https://auth.trybase.io';

  // 1. Direct Session Token / JWT Login
  if (options.token) {
    saveConfig({
      sessionToken: options.token,
      defaultOrg: options.org || config.defaultOrg,
      supabaseUrl,
    });
    console.log(`✅ Authenticated with TryBase via Ephemeral Session Token.`);
    if (options.org) console.log(`   Default organization: "${options.org}"`);
    console.log(`🔒 Anti-Leak Standard: Session token active in ~/.trybase/config.json (Zero static keys).`);
    return;
  }

  // 2. Email & Password Supabase Auth Flow
  if (options.email && options.password) {
    console.log(`🔐 Authenticating with Supabase Control Plane (${supabaseUrl})...`);
    try {
      const anonKey = process.env.SUPABASE_ANON_KEY || 'public-anon-key';
      const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
        },
        body: JSON.stringify({
          email: options.email,
          password: options.password,
        }),
      });

      if (!res.ok) {
        const errData: any = await res.json().catch(() => ({}));
        throw new Error(errData.error_description || errData.msg || `Auth failed with status ${res.status}`);
      }

      const authData: any = await res.json();
      saveConfig({
        sessionToken: authData.access_token,
        refreshToken: authData.refresh_token,
        expiresAt: Math.floor(Date.now() / 1000) + (authData.expires_in || 3600),
        userEmail: authData.user?.email || options.email,
        defaultOrg: options.org || config.defaultOrg,
        supabaseUrl,
      });

      console.log(`✅ Successfully logged in as: ${authData.user?.email || options.email}`);
      console.log(`🔒 Ephemeral STS-style JWT minted (expires in ${authData.expires_in || 3600}s).`);
      console.log(`   The MCP Server and CLI are now authenticated to talk to the TryBase cluster.`);
      return;
    } catch (err: any) {
      console.error(`❌ Login failed: ${err.message}`);
      process.exit(1);
    }
  }

  // 3. Fallback instructions for interactive login
  console.log(`ℹ️  TryBase Anti-Leak Authentication:`);
  console.log(`   To log in with your ephemeral session, pass:`);
  console.log(`     trybase login --token <session_jwt>`);
  console.log(`   Or with credentials:`);
  console.log(`     trybase login --email user@company.com --password <secret>`);
  console.log(`\n💡 Tip: You can copy your 1-hour session token directly from the TryBase web dashboard.`);
}
