import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { startServer, AppServer } from '../../src/server/index.js';
import { centralizeMcpServer } from '../../src/core/storage/mcp-store.js';
import { McpServerManifest } from '../../src/core/types.js';

describe('MCP Discovery API Routes', () => {
  let appServer: AppServer;
  let baseUrl: string;
  let tempDir: string;
  let customHome: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-mcp-route-test-'));
    customHome = path.join(tempDir, 'home');
    appServer = await startServer(0);
    baseUrl = `http://127.0.0.1:${appServer.port}`;
  });

  afterEach(async () => {
    await appServer.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('POST /api/mcp/:name/discover returns 404 for non-existent server', async () => {
    const res = await fetch(`${baseUrl}/api/mcp/non-existent-xyz/discover`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });

  it('POST /api/mcp/:name/discover executes discovery on registered server', async () => {
    const mockScript = `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.method === 'server/discover') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          serverInfo: {
            name: 'route-test-server',
            title: 'Route Test MCP Server',
            version: '3.0.1',
            description: 'MCP server for route integration tests'
          },
          instructions: 'Use route-test-server for automated testing.',
          tools: [{ name: 'route_tool', description: 'Route tool' }]
        }
      }) + '\\n');
    }
  } catch {}
});
`;

    const server: McpServerManifest = {
      id: 'gemini:route-test-server',
      name: 'route-test-server',
      transport: 'stdio',
      command: 'node',
      args: ['-e', mockScript],
      declaredToolsCount: 0,
    };

    await centralizeMcpServer(server);

    const res = await fetch(`${baseUrl}/api/mcp/route-test-server/discover`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.server.title).toBe('Route Test MCP Server');
    expect(body.server.version).toBe('3.0.1');
    expect(body.server.description).toBe('MCP server for route integration tests');
    expect(body.server.instructions).toBe('Use route-test-server for automated testing.');
    expect(body.server.tools).toHaveLength(1);
    expect(body.server.lastDiscoveredAt).toBeDefined();

    // Verify GET /api/mcp/:name reflects the discovered metadata
    const getRes = await fetch(`${baseUrl}/api/mcp/route-test-server`);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.server.title).toBe('Route Test MCP Server');
    expect(getBody.server.version).toBe('3.0.1');
  });

  it('POST /api/mcp/discover-all executes batch discovery', async () => {
    const res = await fetch(`${baseUrl}/api/mcp/discover-all`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.results)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  it('POST /api/mcp/:name/revert removes server from central registry and returns status original', async () => {
    const mockServer: McpServerManifest = {
      id: 'gemini:server-to-revert',
      name: 'server-to-revert',
      transport: 'stdio',
      command: 'echo',
      args: ['hello'],
      declaredToolsCount: 1,
    };
    await centralizeMcpServer(mockServer);

    const revertRes = await fetch(`${baseUrl}/api/mcp/server-to-revert/revert`, {
      method: 'POST',
    });
    expect(revertRes.status).toBe(200);
    const revertBody = await revertRes.json();
    expect(revertBody.success).toBe(true);
    expect(revertBody.server.name).toBe('server-to-revert');
    expect(revertBody.server.status).toBe('original');
  });
});

