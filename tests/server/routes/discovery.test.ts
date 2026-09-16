import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, AppServer } from '../../../src/server/index.js';

describe('Discovery API Routes', () => {
  let app: AppServer;
  let baseUrl: string;

  beforeAll(async () => {
    // Start server on an ephemeral port
    app = await startServer(0);
    baseUrl = `http://127.0.0.1:${app.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/skills', () => {
    it('returns 200 with skills array and total count', async () => {
      const res = await fetch(`${baseUrl}/api/skills`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty('skills');
      expect(json).toHaveProperty('total');
      expect(Array.isArray(json.skills)).toBe(true);
      expect(typeof json.total).toBe('number');
    });
  });

  describe('GET /api/skills/:id', () => {
    it('returns 404 for unknown skill id', async () => {
      const res = await fetch(`${baseUrl}/api/skills/non-existent-skill-id`);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json).toHaveProperty('error');
    });

    it('returns 200 with full skill details when skill exists', async () => {
      // First query skills list
      const listRes = await fetch(`${baseUrl}/api/skills`);
      const listJson = await listRes.json();

      if (listJson.skills.length > 0) {
        const firstSkill = listJson.skills[0];
        const res = await fetch(`${baseUrl}/api/skills/${encodeURIComponent(firstSkill.id)}`);
        expect(res.status).toBe(200);

        const skill = await res.json();
        expect(skill.id).toBe(firstSkill.id);
        expect(skill.name).toBe(firstSkill.name);
      }
    });
  });

  describe('GET /api/mcp', () => {
    it('returns 200 with MCP servers list and count', async () => {
      const res = await fetch(`${baseUrl}/api/mcp`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty('servers');
      expect(json).toHaveProperty('total');
      expect(Array.isArray(json.servers)).toBe(true);
      expect(typeof json.total).toBe('number');
    });
  });
});
