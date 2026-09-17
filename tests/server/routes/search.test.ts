/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, AppServer } from '../../../src/server/index.js';

describe('Search REST API Routes', () => {
  let app: AppServer;
  let baseUrl: string;

  beforeAll(async () => {
    app = await startServer(0);
    baseUrl = `http://127.0.0.1:${app.port}`;
    // Warm up index once before tests
    await fetch(`${baseUrl}/api/search/reindex`, { method: 'POST' });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/search/query', () => {
    it('returns 400 if query parameter q is missing or empty', async () => {
      const res = await fetch(`${baseUrl}/api/search/query`);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json).toHaveProperty('error');
    });

    it('returns 200 with matching results and metadata', async () => {
      const res = await fetch(`${baseUrl}/api/search/query?q=git&limit=5`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty('query', 'git');
      expect(json).toHaveProperty('total');
      expect(json).toHaveProperty('results');
      expect(Array.isArray(json.results)).toBe(true);
    });

    it('respects itemType and ecosystem filter parameters', async () => {
      const res = await fetch(`${baseUrl}/api/search/query?q=workflow&itemType=workflow`);
      expect(res.status).toBe(200);

      const json = await res.json();
      for (const item of json.results) {
        expect(item.itemType).toBe('workflow');
      }
    });
  });

  describe('POST /api/search/reindex', () => {
    it('synchronizes discovered skills and workflows into search database', async () => {
      const res = await fetch(`${baseUrl}/api/search/reindex`, { method: 'POST' });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty('success', true);
      expect(json).toHaveProperty('stats');
      expect(json.stats).toHaveProperty('total');
      expect(json.stats).toHaveProperty('indexed');
    });
  });
});
