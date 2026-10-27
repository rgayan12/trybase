/**
 * TryBase Zero-Secret Client for TypeScript & Node.js (Zero Dependencies)
 * Connects directly to /var/run/trybase/secrets.sock using Node's native HTTP over Unix Socket.
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

  constructor(socketPath?: string) {
    this.socketPath = socketPath || process.env.TRYBASE_SOCKET_PATH || '/var/run/trybase/secrets.sock';
  }

  /**
   * Checks if the TryBase Unix Domain Socket exists in the current environment.
   */
  public isAvailable(): boolean {
    return fs.existsSync(this.socketPath);
  }

  /**
   * Performs the IMDSv2-style handshake to obtain a short-lived session token.
   */
  private async getToken(ttlSeconds: number = 60): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath: this.socketPath,
          path: '/latest/api/token',
          method: 'PUT',
          headers: {
            'X-TryBase-Token-TTL-Seconds': ttlSeconds.toString()
          }
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve(data.trim());
            } else {
              reject(new Error(`TryBase handshake failed: HTTP ${res.statusCode} - ${data}`));
            }
          });
        }
      );

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Fetches all decrypted tenant secrets into memory.
   */
  public async getSecrets(): Promise<Record<string, string>> {
    const token = await this.getToken();

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath: this.socketPath,
          path: '/latest/secrets',
          method: 'GET',
          headers: {
            'X-TryBase-Token': token
          }
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(new Error(`Failed to parse TryBase secrets JSON: ${e}`));
              }
            } else {
              reject(new Error(`Failed to fetch secrets: HTTP ${res.statusCode} - ${data}`));
            }
          });
        }
      );

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Fetches an ephemeral 15-minute RDS IAM PostgreSQL authentication token.
   */
  public async getDatabaseToken(): Promise<DatabaseAuthToken> {
    const token = await this.getToken();

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath: this.socketPath,
          path: '/latest/database/token',
          method: 'GET',
          headers: {
            'X-TryBase-Token': token
          }
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(new Error(`Failed to parse database token JSON: ${e}`));
              }
            } else {
              reject(new Error(`Failed to fetch database token: HTTP ${res.statusCode} - ${data}`));
            }
          });
        }
      );

      req.on('error', reject);
      req.end();
    });
  }
}

/**
 * Convenience helper to populate process.env in memory on application startup.
 */
export async function loadSecrets(): Promise<Record<string, string>> {
  const client = new TryBaseClient();
  if (client.isAvailable()) {
    const secrets = await client.getSecrets();
    Object.assign(process.env, secrets);
    return secrets;
  }
  // Local laptop development fallback
  return process.env as Record<string, string>;
}
