import { describe, it, expect } from 'vitest';
import { queryMcpServerTools } from '../../../src/core/mcp/mcp-client.js';

describe('MCP stdio query client', () => {
  it('connects to an MCP stdio server, handshakes, and returns tools', async () => {
    const mockServerScript = `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.method === 'initialize') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { protocolVersion: '2024-11-05', capabilities: {} }
      }) + '\\n');
    } else if (msg.method === 'tools/list') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          tools: [
            { name: 'mock_search', description: 'Searches mock items', inputSchema: { type: 'object' } },
            { name: 'mock_edit', description: 'Edits mock items' }
          ]
        }
      }) + '\\n');
    }
  } catch {}
});
`;

    const tools = await queryMcpServerTools({
      command: 'node',
      args: ['-e', mockServerScript],
      timeoutMs: 3000,
    });

    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('mock_search');
    expect(tools[0].description).toBe('Searches mock items');
    expect(tools[1].name).toBe('mock_edit');
  });

  it('rejects with timeout when the MCP server does not respond', async () => {
    await expect(
      queryMcpServerTools({
        command: 'node',
        args: ['-e', 'setTimeout(() => {}, 10000)'],
        timeoutMs: 250,
      })
    ).rejects.toThrow(/timed out/i);
  });
});
