/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, AppServer } from '../../../src/server/index.js';
import { defaultRouterLogger } from '../../../src/core/router/logger.js';

describe('Router API Routes', () => {
  let app: AppServer;
  let baseUrl: string;

  beforeAll(async () => {
    app = await startServer(0);
    baseUrl = `http://127.0.0.1:${app.port}`;

    // Seed mock transactions
    defaultRouterLogger.record({
      id: 'tx-test-route-1',
      timestamp: Date.now(),
      action: 'DISCOVER',
      query: 'testing routes',
      durationMs: 15,
      status: 'SUCCESS',
      tokensSavedEstimate: 14200,
    });
  }, 15000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/router/logs returns transaction logs and total count', async () => {
    const res = await fetch(`${baseUrl}/api/router/logs`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('logs');
    expect(Array.isArray(json.logs)).toBe(true);
    expect(json.logs.length).toBeGreaterThan(0);
    expect(json).toHaveProperty('total');
  });

  it('GET /api/router/status returns router state and metrics', async () => {
    const res = await fetch(`${baseUrl}/api/router/status`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('isEnabled');
    expect(json).toHaveProperty('metrics');
    expect(json.metrics).toHaveProperty('activeServersCount');
    expect(json.metrics).toHaveProperty('totalTransactions');
    expect(json.metrics).toHaveProperty('estimatedTokensSaved');
  });

  it('POST /api/router/toggle dryRun returns preview operations', async () => {
    const res = await fetch(`${baseUrl}/api/router/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: true }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('preview');
    expect(json.preview).toHaveProperty('operations');
  });

  it('GET /api/router/stream establishes SSE connection', async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);

    try {
      const res = await fetch(`${baseUrl}/api/router/stream`, {
        signal: controller.signal,
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
    } catch (err: any) {
      if (err.name !== 'AbortError') throw err;
    } finally {
      clearTimeout(timeout);
    }
  });
});
