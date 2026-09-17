import http from 'http';
import { VaultManager, maskSecret } from '../../core/vault/index.js';
import { defaultLogger } from '../../core/logger.js';

let sharedVault: VaultManager | null = null;

/**
 * Returns the VaultManager instance configured for current environment.
 */
function getVault(): VaultManager {
  if (!sharedVault || sharedVault['customHome'] !== process.env.KOSKILL_HOME) {
    sharedVault = new VaultManager({ customHome: process.env.KOSKILL_HOME });
  }
  return sharedVault;
}

/**
 * Parses JSON request payload safely.
 */
async function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * Handles credential vault endpoints: GET /api/vault and POST /api/vault
 */
export async function handleVaultRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<boolean> {
  // GET /api/vault
  if (req.method === 'GET' && url.pathname === '/api/vault') {
    try {
      const vault = getVault();
      const secrets = await vault.listSecrets();
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, secrets }));
      return true;
    } catch (err: any) {
      defaultLogger.error('Vault GET error', { error: err.message });
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message || 'Failed to list credentials' }));
      return true;
    }
  }

  // POST /api/vault
  if (req.method === 'POST' && url.pathname === '/api/vault') {
    try {
      const body = await parseJsonBody(req);
      const key = body?.key?.trim();
      const value = body?.value;

      if (!key || typeof value !== 'string') {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'key and value are required' }));
        return true;
      }

      const vault = getVault();
      await vault.setSecret(key, value);

      res.writeHead(200);
      res.end(
        JSON.stringify({
          success: true,
          key,
          maskedValue: maskSecret(value),
        })
      );
      return true;
    } catch (err: any) {
      defaultLogger.error('Vault POST error', { error: err.message });
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message || 'Failed to store credential' }));
      return true;
    }
  }

  return false;
}
