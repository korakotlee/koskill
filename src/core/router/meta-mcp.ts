import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as readline from 'node:readline';
import { defaultRouterLogger, RouterLogger } from './logger.js';
import { defaultMcpProxy, McpProxy } from './mcp-proxy.js';
import { DiscoveredCapability } from './types.js';
import { routeCapabilities } from '../search/hybrid.js';
import { initSearchDb, SearchDatabase } from '../search/db.js';
import { defaultLogger } from '../logger.js';

export type SearchProviderFn = (
  query: string,
  category?: 'skill' | 'workflow' | 'mcp_tool',
  limit?: number
) => Promise<DiscoveredCapability[]>;

export interface MetaMcpServerOptions {
  logger?: RouterLogger;
  proxy?: McpProxy;
  storeDir?: string;
  searchDb?: SearchDatabase;
}

export class MetaMcpServer {
  private readonly logger: RouterLogger;
  private readonly proxy: McpProxy;
  private readonly storeDir: string;
  private searchProvider?: SearchProviderFn;
  private searchDb?: SearchDatabase;

  constructor(options?: MetaMcpServerOptions) {
    this.logger = options?.logger ?? defaultRouterLogger;
    this.proxy = options?.proxy ?? defaultMcpProxy;
    this.storeDir = options?.storeDir ?? path.join(os.homedir(), '.koskill');
    this.searchDb = options?.searchDb;
  }

  public setSearchProvider(fn: SearchProviderFn): void {
    this.searchProvider = fn;
  }

  public async handleRequest(req: any): Promise<any> {
    const { id, method, params } = req;

    // JSON-RPC 2.0 Notifications have no id or start with notifications/. Server MUST NOT reply.
    if (id === undefined || (typeof method === 'string' && method.startsWith('notifications/'))) {
      return undefined;
    }

    if (method === 'ping') {
      return {
        jsonrpc: '2.0',
        id,
        result: {},
      };
    }

    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'koskill-router', version: '0.1.0' },
        },
      };
    }

    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'discover_capabilities',
              description: 'Search for available skills, workflows, and downstream MCP tools.',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Search term or query' },
                  category: {
                    type: 'string',
                    enum: ['skill', 'workflow', 'mcp_tool'],
                    description: 'Optional capability category filter',
                  },
                  limit: { type: 'number', description: 'Max items to return (default 5)' },
                },
                required: ['query'],
              },
            },
            {
              name: 'invoke_tool',
              description: 'Executes a downstream MCP tool via the child process proxy.',
              inputSchema: {
                type: 'object',
                properties: {
                  server: { type: 'string', description: 'Target MCP server name' },
                  tool: { type: 'string', description: 'Target tool name' },
                  arguments: { type: 'object', description: 'Tool input arguments' },
                },
                required: ['server', 'tool', 'arguments'],
              },
            },
            {
              name: 'load_skill',
              description: 'Loads the full instructions and companion files of a skill or workflow.',
              inputSchema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Skill or workflow name' },
                },
                required: ['name'],
              },
            },
          ],
        },
      };
    }

    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};
      const start = Date.now();

      try {
        if (toolName === 'discover_capabilities') {
          const res = await this.handleDiscover(args);
          this.logger.record({
            id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: start,
            action: 'DISCOVER',
            query: args.query,
            durationMs: Date.now() - start,
            status: 'SUCCESS',
            tokensSavedEstimate: 14200,
            payload: args,
            result: res,
          });
          return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] } };
        }

        if (toolName === 'invoke_tool') {
          const res = await this.proxy.executeTool(args.server, args.tool, args.arguments || {});
          this.logger.record({
            id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: start,
            action: 'INVOKE_TOOL',
            targetServer: args.server,
            targetTool: args.tool,
            durationMs: Date.now() - start,
            status: 'SUCCESS',
            tokensSavedEstimate: 28400,
            payload: args,
            result: res,
          });
          return { jsonrpc: '2.0', id, result: res };
        }

        if (toolName === 'load_skill') {
          const res = await this.handleLoadSkill(args.name);
          this.logger.record({
            id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: start,
            action: 'LOAD_SKILL',
            skillName: args.name,
            durationMs: Date.now() - start,
            status: 'SUCCESS',
            tokensSavedEstimate: 8600,
            payload: args,
            result: res,
          });
          return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] } };
        }

        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Tool '${toolName}' not found` } };
      } catch (err: any) {
        this.logger.record({
          id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: start,
          action: toolName === 'discover_capabilities' ? 'DISCOVER' : toolName === 'invoke_tool' ? 'INVOKE_TOOL' : 'LOAD_SKILL',
          durationMs: Date.now() - start,
          status: 'ERROR',
          tokensSavedEstimate: 0,
          payload: args,
          error: err.message,
        });
        return { jsonrpc: '2.0', id, error: { code: -32000, message: err.message } };
      }
    }

    return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method '${method}' not found` } };
  }

  private async handleDiscover(args: { query: string; category?: any; limit?: number }): Promise<{ capabilities: DiscoveredCapability[] }> {
    if (this.searchProvider) {
      const caps = await this.searchProvider(args.query, args.category, args.limit);
      return { capabilities: caps };
    }

    try {
      const db = this.searchDb || initSearchDb();
      const raw = await routeCapabilities(db, args.query, {
        itemType: args.category,
        limit: args.limit || 5,
      });

      const capabilities: DiscoveredCapability[] = raw.map((r) => {
        let serverName: string | undefined;
        let toolName = r.name;
        if (r.itemType === 'mcp_tool' && r.name.includes(':')) {
          const colonIdx = r.name.indexOf(':');
          serverName = r.name.slice(0, colonIdx);
          toolName = r.name.slice(colonIdx + 1);
        }

        return {
          id: r.id,
          itemType: r.itemType,
          name: toolName,
          serverName,
          description: r.description || r.command || r.name,
          score: Number(r.score.toFixed(3)),
        };
      });

      return { capabilities };
    } catch {
      return { capabilities: [] };
    }
  }

  private async handleLoadSkill(name: string): Promise<{ name: string; content: string; companionFiles: string[] }> {
    const skillPath = path.join(this.storeDir, 'skills', name);
    const skillMd = path.join(skillPath, 'SKILL.md');
    const workflowPath = path.join(this.storeDir, 'workflows', `${name}.md`);

    let content = '';
    const companionFiles: string[] = [];

    if (fs.existsSync(skillMd)) {
      content = fs.readFileSync(skillMd, 'utf-8');
      const refsDir = path.join(skillPath, 'references');
      if (fs.existsSync(refsDir)) {
        for (const file of fs.readdirSync(refsDir)) {
          companionFiles.push(path.join('references', file));
        }
      }
      const scriptsDir = path.join(skillPath, 'scripts');
      if (fs.existsSync(scriptsDir)) {
        for (const file of fs.readdirSync(scriptsDir)) {
          companionFiles.push(path.join('scripts', file));
        }
      }
    } else if (fs.existsSync(workflowPath)) {
      content = fs.readFileSync(workflowPath, 'utf-8');
    } else {
      throw new Error(`Skill or workflow '${name}' not found`);
    }

    return { name, content, companionFiles };
  }

  public runStdio(input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout): void {
    const rl = readline.createInterface({ input, terminal: false });

    rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const req = JSON.parse(trimmed);
        const res = await this.handleRequest(req);
        if (res) {
          output.write(JSON.stringify(res) + '\n');
        }
      } catch (err: any) {
        defaultLogger.error('Malformed JSON-RPC request to MetaMcpServer', { error: err.message });
      }
    });
  }
}
