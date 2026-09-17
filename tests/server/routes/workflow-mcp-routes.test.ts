import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startServer, AppServer } from '../../../src/server/index.js';

describe('Workflow and MCP API Routes', () => {
  let appServer: AppServer;
  let baseUrl: string;

  beforeEach(async () => {
    appServer = await startServer(0);
    baseUrl = `http://127.0.0.1:${appServer.port}`;
  });

  afterEach(async () => {
    await appServer.close();
  });

  it('GET /api/mcp returns list of MCP servers with status and tools', async () => {
    const res = await fetch(`${baseUrl}/api/mcp`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.servers).toBeDefined();
    expect(Array.isArray(body.servers)).toBe(true);
  });

  it('POST /api/mcp/generate-subset generates subset successfully', async () => {
    const res = await fetch(`${baseUrl}/api/mcp/generate-subset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.count).toBe('number');
  });

  it('POST /api/workflows/batch/centralize validates request body', async () => {
    const res = await fetch(`${baseUrl}/api/workflows/batch/centralize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('workflowIds array is required');
  });

  it('POST /api/workflows/:id/centralize returns 404 for unknown workflow', async () => {
    const res = await fetch(`${baseUrl}/api/workflows/non-existent-wf/centralize`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });

  it('POST /api/mcp/:name/query-tools returns 404 for unknown server', async () => {
    const res = await fetch(`${baseUrl}/api/mcp/unknown-server-xyz/query-tools`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });
});

