import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, AppServer } from '../index.js';

describe('Workflow API Routes', () => {
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

  describe('GET /api/workflows', () => {
    it('returns 200 with workflows array and total count', async () => {
      const res = await fetch(`${baseUrl}/api/workflows`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty('workflows');
      expect(json).toHaveProperty('total');
      expect(Array.isArray(json.workflows)).toBe(true);
      expect(typeof json.total).toBe('number');
    });
  });

  describe('GET /api/workflows/:id', () => {
    it('returns 404 for unknown workflow id', async () => {
      const res = await fetch(`${baseUrl}/api/workflows/non-existent-workflow-id`);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json).toHaveProperty('error');
      expect(json.error).toBe('Workflow not found');
      expect(json.id).toBe('non-existent-workflow-id');
    });

    it('returns 200 with full workflow details when workflow exists', async () => {
      const listRes = await fetch(`${baseUrl}/api/workflows`);
      const listJson = await listRes.json();

      if (listJson.workflows.length > 0) {
        const firstWorkflow = listJson.workflows[0];
        const res = await fetch(`${baseUrl}/api/workflows/${encodeURIComponent(firstWorkflow.id)}`);
        expect(res.status).toBe(200);

        const workflow = await res.json();
        expect(workflow.id).toBe(firstWorkflow.id);
        expect(workflow.command).toBe(firstWorkflow.command);
        expect(workflow.targetEcosystem).toBeDefined();
      }
    });
  });
});
