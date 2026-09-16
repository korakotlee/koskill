import { describe, it, expect, afterEach } from 'vitest';
import http from 'http';
import { startServer, AppServer } from '../index.js';

describe('Server Scaffolding & Health Check Daemon', () => {
  let appServer: AppServer | null = null;

  afterEach(async () => {
    if (appServer) {
      await appServer.close();
      appServer = null;
    }
  });

  it('starts server on specified port and responds to /api/health', async () => {
    // Start on test port 3901 to avoid collisions
    appServer = await startServer(3901);
    expect(appServer.port).toBe(3901);

    const response = await new Promise<{ statusCode: number; data: string }>((resolve, reject) => {
      http.get(`http://localhost:${appServer?.port}/api/health`, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => { resolve({ statusCode: res.statusCode || 0, data }); });
      }).on('error', reject);
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.data);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('koskill-daemon');
    expect(body.version).toBeDefined();
  });

  it('returns 404 for unknown endpoints', async () => {
    appServer = await startServer(3902);

    const response = await new Promise<{ statusCode: number }>((resolve, reject) => {
      http.get(`http://localhost:${appServer?.port}/api/unknown`, (res) => {
        resolve({ statusCode: res.statusCode || 0 });
      }).on('error', reject);
    });

    expect(response.statusCode).toBe(404);
  });
});
