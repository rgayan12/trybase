import { loadConfig, saveConfig } from './config.js';

export async function getValidSessionToken(): Promise<{ token: string; url: string; key: string; userId?: string } | null> {
  const config = loadConfig();
  const url = process.env.SUPABASE_URL || config.supabaseUrl;
  const key = process.env.SUPABASE_ANON_KEY || config.supabaseKey;

  if (!config.sessionToken || !url || !key) return null;

  const now = Math.floor(Date.now() / 1000);
  let token = config.sessionToken;

  // If token is expired and refreshToken exists, refresh it
  if (config.expiresAt && now >= config.expiresAt && config.refreshToken) {
    try {
      const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
        },
        body: JSON.stringify({ refresh_token: config.refreshToken }),
      });

      if (res.ok) {
        const data: any = await res.json();
        token = data.access_token;
        saveConfig({
          sessionToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
        });
      }
    } catch {
      // Continue with existing token
    }
  }

  let userId: string | undefined;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    if (payload.sub) userId = payload.sub;
  } catch {}

  return { token, url, key, userId };
}

export async function upsertControlPlaneWorkspace(workload: {
  tenantId: string;
  archetype: string;
  priority: number;
  subdomain?: string;
}): Promise<boolean> {
  const session = await getValidSessionToken();
  if (!session || !session.userId) return false;

  const { token, url, key, userId } = session;
  const now = new Date().toISOString();

  try {
    // 1. Check if workspace already exists
    const checkRes = await fetch(`${url}/rest/v1/workspaces?tenant_id=eq.${workload.tenantId}&select=id`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`,
      },
    });

    const existing: any[] = await checkRes.json().catch(() => []);

    if (existing && existing.length > 0) {
      // Update
      await fetch(`${url}/rest/v1/workspaces?id=eq.${existing[0].id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          status: 'provisioning',
          workload_type: workload.archetype,
          alb_listener_rule_priority: workload.priority,
          provisioning_started_at: now,
        }),
      });
      return true;
    } else {
      // Insert
      await fetch(`${url}/rest/v1/workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          user_id: userId,
          tenant_id: workload.tenantId,
          workload_type: workload.archetype,
          status: 'provisioning',
          alb_listener_rule_priority: workload.priority,
          provisioning_started_at: now,
        }),
      });
      return true;
    }
  } catch {
    return false;
  }
}

export async function listControlPlaneWorkspaces(): Promise<any[]> {
  const session = await getValidSessionToken();
  if (!session) return [];

  const { token, url, key } = session;

  try {
    const res = await fetch(`${url}/rest/v1/workspaces?select=*&order=created_at.desc`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
