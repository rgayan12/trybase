/**
 * TryBase Zero-Secret Client for TypeScript & Node.js (Zero External Dependencies)
 * Connects directly to /var/run/trybase/secrets.sock using Node's native HTTP over Unix Socket.
 *
 * Security Features:
 * 1. TryBase Session-Token Protocol with in-memory token caching.
 * 2. Fails closed in production environments when TryBase is unreachable.
 * 3. Scoped secret fetching (TRYBASE_SECRET_KEYS) to minimize blast radius.
 * 4. Dynamic RDS IAM token factory for pg (node-postgres), Prisma, and TypeORM connection pools.
 * 5. Certificate-verifying TLS (rejectUnauthorized: true) for database connections.
 */

import http from 'http';
import fs from 'fs';

export interface DatabaseAuthToken {
  db_host: string;
  db_port: number;
  db_user: string;
  db_name: string;
  auth_token: string;
  expires_at: string;
  ttl_seconds: number;
}

export class TryBaseClient {
  private socketPath: string;
  private sessionToken: string | null = null;
  private sessionTokenExpiresAt: number = 0;

  constructor(socketPath?: string) {
    this.socketPath =
      socketPath || process.env.TRYBASE_SOCKET_PATH || '/var/run/trybase/secrets.sock';
  }

  /**
   * Checks if the TryBase Unix Domain Socket exists in the current environment.
   */
  public isAvailable(): boolean {
    try {
      return fs.existsSync(this.socketPath);
    } catch {
      return false;
    }
  }

  /**
   * Evaluates if the application should fail closed upon any TryBase failure.
   */
  public shouldFailClosed(): boolean {
    const envFailClosed = process.env.TRYBASE_FAIL_CLOSED;
    if (envFailClosed !== undefined) {
      return ['true', '1', 'yes'].includes(envFailClosed.trim().toLowerCase());
    }

    if (['true', '1', 'yes'].includes((process.env.TRYBASE_LOCAL_FALLBACK || '').trim().toLowerCase())) {
      return false;
    }

    const envName = (process.env.NODE_ENV || process.env.ENVIRONMENT || '').trim().toLowerCase();
    if (['production', 'staging'].includes(envName)) {
      return true;
    }

    return ['true', '1', 'yes'].includes((process.env.TRYBASE_REQUIRED || '').trim().toLowerCase());
  }

  /**
   * Obtains or reuses a short-lived TryBase session token via PUT /latest/api/token.
   */
  public async getSessionToken(ttlSeconds: number = 60): Promise<string> {
    // Reuse cached session token if still valid (with a 5-second buffer)
    const now = Math.floor(Date.now() / 1000);
    if (this.sessionToken && now < this.sessionTokenExpiresAt - 5) {
      return this.sessionToken;
    }

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath: this.socketPath,
          path: '/latest/api/token',
          method: 'PUT',
          headers: {
            'X-TryBase-Token-TTL-Seconds': ttlSeconds.toString(),
          },
          timeout: 4000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode === 200 && data.trim()) {
              this.sessionToken = data.trim();
              this.sessionTokenExpiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
              resolve(this.sessionToken);
            } else {
              const err = new Error(
                `TryBase Session-Token handshake failed: HTTP ${res.statusCode} - ${data}`
              );
              if (this.shouldFailClosed()) {
                reject(err);
              } else {
                console.warn(err.message);
                resolve('');
              }
            }
          });
        }
      );

      req.on('error', (err) => {
        if (this.shouldFailClosed()) {
          reject(new Error(`TryBase socket connection error: ${err.message}`));
        } else {
          console.warn(`TryBase socket connection warning: ${err.message}`);
          resolve('');
        }
      });

      req.end();
    });
  }

  /**
   * Fetches all decrypted tenant secrets into memory: GET /latest/secrets.
   */
  public async getSecrets(): Promise<Record<string, string>> {
    const token = await this.getSessionToken();
    if (!token && !this.shouldFailClosed()) {
      return {};
    }

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath: this.socketPath,
          path: '/latest/secrets',
          method: 'GET',
          headers: {
            'X-TryBase-Token': token,
          },
          timeout: 4000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                const err = new Error(`Failed to parse TryBase secrets JSON: ${e}`);
                this.shouldFailClosed() ? reject(err) : resolve({});
              }
            } else {
              const err = new Error(`Failed to fetch secrets: HTTP ${res.statusCode} - ${data}`);
              this.shouldFailClosed() ? reject(err) : resolve({});
            }
          });
        }
      );

      req.on('error', (err) => {
        const error = new Error(`TryBase socket error during getSecrets: ${err.message}`);
        this.shouldFailClosed() ? reject(error) : resolve({});
      });

      req.end();
    });
  }

  /**
   * Fetches a single secret: GET /latest/secrets/<key> (scoped to minimize blast radius).
   */
  public async getSecret(key: string): Promise<string | null> {
    const token = await this.getSessionToken();
    if (!token && !this.shouldFailClosed()) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath: this.socketPath,
          path: `/latest/secrets/${encodeURIComponent(key)}`,
          method: 'GET',
          headers: {
            'X-TryBase-Token': token,
          },
          timeout: 4000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode === 404) {
              resolve(null);
            } else if (res.statusCode === 200) {
              resolve(data.trim());
            } else {
              const err = new Error(`Failed to fetch secret '${key}': HTTP ${res.statusCode} - ${data}`);
              this.shouldFailClosed() ? reject(err) : resolve(null);
            }
          });
        }
      );

      req.on('error', (err) => {
        const error = new Error(`TryBase socket error fetching '${key}': ${err.message}`);
        this.shouldFailClosed() ? reject(error) : resolve(null);
      });

      req.end();
    });
  }

  /**
   * Fetches an ephemeral 15-minute RDS IAM PostgreSQL authentication token.
   */
  public async getDatabaseToken(): Promise<DatabaseAuthToken> {
    const token = await this.getSessionToken();

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath: this.socketPath,
          path: '/latest/database/token',
          method: 'GET',
          headers: {
            'X-TryBase-Token': token,
          },
          timeout: 4000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const parsed = JSON.parse(data);
                if (!parsed.auth_token) {
                  throw new Error('Database token response missing auth_token field');
                }
                resolve(parsed);
              } catch (e) {
                reject(new Error(`Failed to parse database token JSON: ${e}`));
              }
            } else {
              reject(new Error(`Failed to fetch database token: HTTP ${res.statusCode} - ${data}`));
            }
          });
        }
      );

      req.on('error', (err) => {
        reject(new Error(`TryBase socket error during getDatabaseToken: ${err.message}`));
      });

      req.end();
    });
  }

  /**
   * Generates a dynamic configuration object for node-postgres (pg) pools.
   * Leverages pg's native `password: () => Promise<string>` hook to dynamically
   * refresh the ephemeral 15-minute RDS IAM token on every TCP handshake.
   */
  public getPgPoolConfig(baseConfig: Record<string, any> = {}): Record<string, any> {
    const caBundlePath =
      process.env.DB_SSLROOTCERT || '/etc/ssl/certs/rds-combined-ca-bundle.pem';
    let caCertificate: string | undefined;

    if (fs.existsSync(caBundlePath)) {
      caCertificate = fs.readFileSync(caBundlePath, 'utf8');
    } else if (fs.existsSync('/etc/ssl/certs/ca-certificates.crt')) {
      caCertificate = fs.readFileSync('/etc/ssl/certs/ca-certificates.crt', 'utf8');
    }

    return {
      ...baseConfig,
      // Dynamic password provider: pg calls this function whenever opening a new socket!
      password: async () => {
        const token = await this.getDatabaseToken();
        return token.auth_token;
      },
      ssl: {
        rejectUnauthorized: true,
        ...(caCertificate ? { ca: caCertificate } : {}),
        ...(baseConfig.ssl || {}),
      },
    };
  }
}

/**
 * Convenience helper to populate process.env in memory on application startup.
 * - Fails closed in production if TryBase socket is missing.
 * - Respects TRYBASE_SECRET_KEYS to fetch only declared keys.
 * - Falls back to local process.env on developer laptops.
 */
export async function loadSecrets(): Promise<Record<string, string>> {
  const client = new TryBaseClient();

  if (!client.isAvailable()) {
    if (client.shouldFailClosed()) {
      throw new Error(
        `TryBase socket not found at '${(client as any).socketPath}'. ` +
        'Production workloads requiring TryBase must fail closed. ' +
        'Set TRYBASE_LOCAL_FALLBACK=true to permit local fallback.'
      );
    }
    // Local laptop development fallback
    return process.env as Record<string, string>;
  }

  const scopedKeys = process.env.TRYBASE_SECRET_KEYS;
  if (scopedKeys) {
    const keys = scopedKeys.split(',').map((k) => k.trim()).filter(Boolean);
    const secrets: Record<string, string> = {};
    for (const key of keys) {
      const val = await client.getSecret(key);
      if (val !== null) {
        secrets[key] = val;
        process.env[key] = val;
      }
    }
    return secrets;
  }

  const secrets = await client.getSecrets();
  Object.assign(process.env, secrets);
  return secrets;
}
