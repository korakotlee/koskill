import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { startServer, AppServer } from '../../../src/server/index.js';

describe('Storage Management API Routes', () => {
  let app: AppServer;
  let baseUrl: string;
  let tempRoot: string;
  let fakeKoskillHome: string;

  beforeAll(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-server-storage-test-'));
    fakeKoskillHome = path.join(tempRoot, '.koskill');
    process.env.KOSKILL_HOME = fakeKoskillHome;

    app = await startServer(0);
    baseUrl = `http://127.0.0.1:${app.port}`;
  });

  afterAll(async () => {
    delete process.env.KOSKILL_HOME;
    await app.close();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  describe('POST /api/skills/:id/centralize', () => {
    it('returns 404 for nonexistent skill id', async () => {
      const res = await fetch(`${baseUrl}/api/skills/nonexistent-skill/centralize`, {
        method: 'POST',
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toMatch(/skill not found/i);
    });
  });

  describe('POST /api/skills/:id/revert', () => {
    it('returns 404 for nonexistent skill id', async () => {
      const res = await fetch(`${baseUrl}/api/skills/nonexistent-skill/revert`, {
        method: 'POST',
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/skills/batch/centralize', () => {
    it('returns 400 when skillIds array is missing', async () => {
      const res = await fetch(`${baseUrl}/api/skills/batch/centralize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/skillIds array is required/i);
    });

    it('processes empty batch array successfully', async () => {
      const res = await fetch(`${baseUrl}/api/skills/batch/centralize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillIds: [] }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.total).toBe(0);
      expect(json.succeeded).toBe(0);
      expect(json.failed).toBe(0);
    });
  });

  describe('POST /api/skills/batch/revert', () => {
    it('returns 400 when skillIds array is missing', async () => {
      const res = await fetch(`${baseUrl}/api/skills/batch/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('processes empty batch array successfully', async () => {
      const res = await fetch(`${baseUrl}/api/skills/batch/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillIds: [] }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.total).toBe(0);
    });
  });
});
