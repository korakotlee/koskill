import { describe, it, expect } from 'vitest';
import { queryMcpServerTools, discoverMcpServer } from '../../../src/core/mcp/mcp-client.js';

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

  describe('discoverMcpServer', () => {
    it('discovers serverInfo and tools via server/discover method', async () => {
      const mockModernServer = `
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
            name: 'mock-modern',
            title: 'Mock Modern Server',
            version: '2.1.0',
            description: 'Modern stateless MCP server'
          },
          instructions: 'Call tools directly without handshake.',
          tools: [
            { name: 'modern_tool', description: 'A modern discovery tool' }
          ]
        }
      }) + '\\n');
    }
  } catch {}
});
`;

      const result = await discoverMcpServer({
        command: 'node',
        args: ['-e', mockModernServer],
        timeoutMs: 3000,
      });

      expect(result.title).toBe('Mock Modern Server');
      expect(result.version).toBe('2.1.0');
      expect(result.description).toBe('Modern stateless MCP server');
      expect(result.instructions).toBe('Call tools directly without handshake.');
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('modern_tool');
    });

    it('falls back to initialize and tools/list when server/discover returns -32601', async () => {
      const mockLegacyServer = `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.method === 'server/discover') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: -32601, message: 'Method not found' }
      }) + '\\n');
    } else if (msg.method === 'initialize') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          serverInfo: {
            name: 'mock-legacy',
            title: 'Mock Legacy Server',
            version: '1.0.4',
            description: 'Legacy stateful MCP server'
          },
          instructions: 'Legacy instructions from initialize'
        }
      }) + '\\n');
    } else if (msg.method === 'tools/list') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          tools: [
            { name: 'legacy_tool', description: 'Legacy tool' }
          ]
        }
      }) + '\\n');
    }
  } catch {}
});
`;

      const result = await discoverMcpServer({
        command: 'node',
        args: ['-e', mockLegacyServer],
        timeoutMs: 3000,
      });

      expect(result.title).toBe('Mock Legacy Server');
      expect(result.version).toBe('1.0.4');
      expect(result.description).toBe('Legacy stateful MCP server');
      expect(result.instructions).toBe('Legacy instructions from initialize');
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('legacy_tool');
    });

    it('rejects with timeout when discover process hangs', async () => {
      await expect(
        discoverMcpServer({
          command: 'node',
          args: ['-e', 'setTimeout(() => {}, 10000)'],
          timeoutMs: 250,
        })
      ).rejects.toThrow(/timed out/i);
    });
  });
});

