/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { startServer, AppServer } from '../../../src/server/index.js';

describe('Vault REST API Routes', () => {
  let app: AppServer;
  let baseUrl: string;
  let tempDir: string;
  let fakeKoskillHome: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-api-vault-'));
    fakeKoskillHome = path.join(tempDir, '.koskill');
    process.env.KOSKILL_HOME = fakeKoskillHome;

    app = await startServer(0);
    baseUrl = `http://127.0.0.1:${app.port}`;
  }, 30000);

  afterAll(async () => {
    await app.close();
    delete process.env.KOSKILL_HOME;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('initially returns empty secret list via GET /api/vault', async () => {
    const res = await fetch(`${baseUrl}/api/vault`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.secrets)).toBe(true);
    expect(body.secrets).toHaveLength(0);
  });

  it('stores a credential via POST /api/vault and returns masked representation', async () => {
    const res = await fetch(`${baseUrl}/api/vault`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'OPENAI_API_KEY',
        value: 'sk-proj-supersecretkey12345678',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.key).toBe('OPENAI_API_KEY');
    expect(body.maskedValue).toBe('sk-...5678');
    expect(body.maskedValue).not.toContain('supersecretkey');

    // Verify GET returns the masked key
    const getRes = await fetch(`${baseUrl}/api/vault`);
    const getBody = await getRes.json();
    expect(getBody.secrets).toHaveLength(1);
    expect(getBody.secrets[0].key).toBe('OPENAI_API_KEY');
    expect(getBody.secrets[0].maskedValue).toBe('sk-...5678');
  });

  it('rejects POST /api/vault without key or value with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/vault`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'MISSING_VALUE' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/key and value are required/i);
  });
});
