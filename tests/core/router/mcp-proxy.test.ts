import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { McpProxy } from '../../../src/core/router/mcp-proxy.js';

describe('McpProxy', () => {
  let tmpDir: string;
  let pidsFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koskill-proxy-test-'));
    pidsFile = path.join(tmpDir, 'pids.json');
  });

  afterEach(async () => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('lazily spawns a child MCP process on first tool invocation', async () => {
    // Create a mock echo MCP server script that responds to initialize and tools/call
    const mockServerScript = path.join(tmpDir, 'mock-server.js');
    fs.writeFileSync(
      mockServerScript,
      `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.method === 'initialize') {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: {} } }));
    } else if (msg.method === 'tools/call') {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: 'result: ' + msg.params.name }] } }));
    }
  } catch (e) {
    // Ignore non-json
  }
});
      `
    );

    const proxy = new McpProxy({
      pidsFilePath: pidsFile,
      manifestResolver: async (name) => ({
        command: process.execPath,
        args: [mockServerScript],
      }),
    });

    expect(proxy.getActiveServersCount()).toBe(0);

    const result = await proxy.executeTool('echo-server', 'test_tool', { name: 'hello' });
    expect(result).toBeDefined();
    expect(result.content[0].text).toBe('result: test_tool');
    expect(proxy.getActiveServersCount()).toBe(1);

    await proxy.closeAll();
    expect(proxy.getActiveServersCount()).toBe(0);
  });

  it('filters out non-JSON stdout debug lines without corrupting JSON-RPC responses', async () => {
    const noisyServerScript = path.join(tmpDir, 'noisy-server.js');
    fs.writeFileSync(
      noisyServerScript,
      `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.method === 'initialize') {
      console.log("[DEBUG] Starting mock server...");
      console.log(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05' } }));
    } else if (msg.method === 'tools/call') {
      console.log("Random noisy stderr-like line on stdout");
      console.log(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: 'clean-response' }] } }));
    }
  } catch (e) {}
});
      `
    );

    const proxy = new McpProxy({
      pidsFilePath: pidsFile,
      manifestResolver: async () => ({
        command: process.execPath,
        args: [noisyServerScript],
      }),
    });

    const result = await proxy.executeTool('noisy-server', 'noisy_tool', {});
    expect(result.content[0].text).toBe('clean-response');

    await proxy.closeAll();
  });

  it('enforces execution timeout and rejects if downstream tool hangs', async () => {
    const slowServerScript = path.join(tmpDir, 'slow-server.js');
    fs.writeFileSync(
      slowServerScript,
      `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (line) => {
  const msg = JSON.parse(line);
  if (msg.method === 'initialize') {
    console.log(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05' } }));
  }
  // tools/call is intentionally not answered
});
      `
    );

    const proxy = new McpProxy({
      pidsFilePath: pidsFile,
      callTimeoutMs: 200, // Short timeout for test speed
      manifestResolver: async () => ({
        command: process.execPath,
        args: [slowServerScript],
      }),
    });

    await expect(
      proxy.executeTool('slow-server', 'hang_tool', {})
    ).rejects.toThrow(/timed out/i);

    await proxy.closeAll();
  });

  it('reclaims LRU child process when exceeding maxConcurrentServers', async () => {
    const serverScript = path.join(tmpDir, 'pool-server.js');
    fs.writeFileSync(
      serverScript,
      `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const msg = JSON.parse(line);
  console.log(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { ok: true } }));
});
      `
    );

    const proxy = new McpProxy({
      pidsFilePath: pidsFile,
      maxConcurrentServers: 2,
      manifestResolver: async () => ({
        command: process.execPath,
        args: [serverScript],
      }),
    });

    await proxy.executeTool('server-1', 'toolA', {});
    await proxy.executeTool('server-2', 'toolB', {});
    expect(proxy.getActiveServersCount()).toBe(2);

    // Spawning server-3 should evict the least-recently-used server (server-1)
    await proxy.executeTool('server-3', 'toolC', {});
    expect(proxy.getActiveServersCount()).toBe(2);

    await proxy.closeAll();
  });
});
