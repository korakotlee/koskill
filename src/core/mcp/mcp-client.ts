import { McpServerInfo, McpToolDefinition } from '../types.js';
import { runMcpStdioSession, McpProcessOptions } from './stdio-runner.js';

export interface QueryMcpToolsOptions extends McpProcessOptions {}

export interface McpDiscoveryResult {
  title?: string;
  version?: string;
  description?: string;
  instructions?: string;
  serverInfo?: McpServerInfo;
  tools: McpToolDefinition[];
}

function mapTools(rawTools: unknown): McpToolDefinition[] {
  if (!Array.isArray(rawTools)) return [];
  return rawTools.map((t: any) => ({
    name: String(t.name || ''),
    description: t.description ? String(t.description) : undefined,
    parameters: t.inputSchema || t.parameters,
  }));
}

/**
 * Probes an MCP server using stateless server/discover, falling back to initialize + tools/list.
 */
export async function discoverMcpServer(
  options: QueryMcpToolsOptions
): Promise<McpDiscoveryResult> {
  let serverInfo: McpServerInfo | undefined;
  let instructions: string | undefined;

  return runMcpStdioSession<McpDiscoveryResult>(
    options,
    (send) => {
      send({
        jsonrpc: '2.0',
        id: 1,
        method: 'server/discover',
        params: {},
      });
    },
    (msg, send, finish) => {
      if (!msg || typeof msg !== 'object') return;

      if (msg.id === 1) {
        if (msg.error || !msg.result) {
          // Fallback to legacy initialize handshake
          send({
            jsonrpc: '2.0',
            id: 2,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: { name: 'koskill', version: '0.1.0' },
            },
          });
          return;
        }

        const res = msg.result;
        const sInfo: McpServerInfo | undefined =
          res.serverInfo || res._meta?.['io.modelcontextprotocol/serverInfo'];
        finish(null, {
          title: sInfo?.title || res.title,
          version: sInfo?.version || res.version,
          description: sInfo?.description || res.description,
          instructions: res.instructions || sInfo?.description,
          serverInfo: sInfo,
          tools: mapTools(res.tools),
        });
        return;
      }

      if (msg.id === 2) {
        if (msg.error) {
          finish(new Error(`MCP server initialize failed: ${msg.error.message || JSON.stringify(msg.error)}`));
          return;
        }
        serverInfo = msg.result?.serverInfo;
        instructions = msg.result?.instructions;

        send({ jsonrpc: '2.0', method: 'notifications/initialized' });
        send({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} });
        return;
      }

      if (msg.id === 3) {
        if (msg.error) {
          finish(new Error(`tools/list returned error: ${msg.error.message || JSON.stringify(msg.error)}`));
          return;
        }
        finish(null, {
          title: serverInfo?.title,
          version: serverInfo?.version,
          description: serverInfo?.description,
          instructions,
          serverInfo,
          tools: mapTools(msg.result?.tools),
        });
      }
    }
  );
}

/**
 * Connects to a local MCP server over stdio, performs JSON-RPC handshake,
 * queries tools/list, and returns the tool definitions.
 */
export async function queryMcpServerTools(
  options: QueryMcpToolsOptions
): Promise<McpToolDefinition[]> {
  return runMcpStdioSession<McpToolDefinition[]>(
    options,
    (send) => {
      send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'koskill', version: '0.1.0' },
        },
      });
    },
    (msg, send, finish) => {
      if (!msg || typeof msg !== 'object') return;

      if (msg.id === 1 && msg.result) {
        send({ jsonrpc: '2.0', method: 'notifications/initialized' });
        send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
        return;
      }

      if (msg.id === 2) {
        if (msg.error) {
          finish(new Error(`tools/list returned error: ${msg.error.message || JSON.stringify(msg.error)}`));
          return;
        }
        finish(null, mapTools(msg.result?.tools));
      }
    }
  );
}
