import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  centralizeMcpServer,
  toggleMcpServer,
  generateAgentsMcpSubset,
  loadMcpRegistry,
  discoverServerTools,
  loadServerInstructions,
  updateServerDiscoveryMetadata,
  revertMcpServer,
} from '../../../src/core/storage/mcp-store.js';
import { McpServerManifest } from '../../../src/core/types.js';

describe('MCP Central Store & Registry', () => {
  let tempDir: string;
  let customHome: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-mcp-test-'));
    customHome = path.join(tempDir, 'home');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('centralizes an MCP server and records it in central registry', async () => {
    const sampleServer: McpServerManifest = {
      id: 'gemini:sqlite',
      name: 'sqlite',
      transport: 'stdio',
      command: 'uvx',
      args: ['mcp-server-sqlite'],
      declaredToolsCount: 2,
      tools: [
        { name: 'read_query', description: 'Run SELECT query' },
        { name: 'write_query', description: 'Run DDL/DML query' },
      ],
    };

    const centralized = await centralizeMcpServer(sampleServer, customHome);
    expect(centralized.status).toBe('centralized');
    expect(centralized.enabled).toBe(true);

    const registry = await loadMcpRegistry(customHome);
    expect(registry['sqlite']).toBeDefined();
    expect(registry['sqlite'].name).toBe('sqlite');
    expect(registry['sqlite'].tools?.length).toBe(2);
  });

  it('toggles the enabled state of an MCP server in registry', async () => {
    const sampleServer: McpServerManifest = {
      id: 'gemini:github',
      name: 'github',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      declaredToolsCount: 5,
    };

    await centralizeMcpServer(sampleServer, customHome);

    const disabled = await toggleMcpServer('github', false, customHome);
    expect(disabled.enabled).toBe(false);

    const registry = await loadMcpRegistry(customHome);
    expect(registry['github'].enabled).toBe(false);

    const reenabled = await toggleMcpServer('github', true, customHome);
    expect(reenabled.enabled).toBe(true);
  });

  it('generates agents_mcp/servers.json filtering only enabled MCP servers', async () => {
    const serverA: McpServerManifest = {
      id: 'gemini:active-server',
      name: 'active-server',
      transport: 'stdio',
      command: 'node',
      args: ['active.js'],
      declaredToolsCount: 1,
      enabled: true,
    };

    const serverB: McpServerManifest = {
      id: 'gemini:disabled-server',
      name: 'disabled-server',
      transport: 'stdio',
      command: 'node',
      args: ['disabled.js'],
      declaredToolsCount: 1,
      enabled: false,
    };

    await centralizeMcpServer(serverA, customHome);
    await centralizeMcpServer(serverB, customHome);
    await toggleMcpServer('disabled-server', false, customHome);

    const targetOutput = path.join(tempDir, 'agents_mcp', 'servers.json');
    const res = await generateAgentsMcpSubset(targetOutput, customHome);

    expect(res.count).toBe(1);
    expect(res.targetPath).toBe(targetOutput);

    const fileContent = await fs.readFile(targetOutput, 'utf-8');
    const parsed = JSON.parse(fileContent);

    expect(parsed.mcpServers['active-server']).toBeDefined();
    expect(parsed.mcpServers['disabled-server']).toBeUndefined();
  });

  it('discovers server tools from mock schema directories', async () => {
    const mockSchemaDir = path.join(tempDir, 'mcp_schemas', 'demo-server');
    await fs.mkdir(mockSchemaDir, { recursive: true });

    await fs.writeFile(
      path.join(mockSchemaDir, 'fetch_data.json'),
      JSON.stringify({
        name: 'fetch_data',
        description: 'Fetches data from remote API',
        parameters: { type: 'object' },
      })
    );

    const tools = await discoverServerTools('demo-server', [mockSchemaDir]);
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe('fetch_data');
    expect(tools[0].description).toBe('Fetches data from remote API');
  });

  it('loads server instructions from filesystem fallback directory', async () => {
    const mockMcpParentDir = path.join(tempDir, 'mcp');
    const mockGithubDir = path.join(mockMcpParentDir, 'github');
    await fs.mkdir(mockGithubDir, { recursive: true });
    await fs.writeFile(
      path.join(mockGithubDir, 'instructions.md'),
      '# GitHub MCP Server Instructions\nUse this tool for issues and PRs.'
    );

    const instructions = await loadServerInstructions('github', [mockMcpParentDir]);
    expect(instructions).toBe('# GitHub MCP Server Instructions\nUse this tool for issues and PRs.');

    const missing = await loadServerInstructions('unknown', [mockMcpParentDir]);
    expect(missing).toBeUndefined();
  });

  it('updates server discovery metadata in registry preserving user overrides', async () => {
    const server: McpServerManifest = {
      id: 'gemini:postgres',
      name: 'postgres',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'mcp-server-postgres'],
      declaredToolsCount: 1,
      enabled: false,
      status: 'centralized',
      env: { PGUSER: 'admin' },
    };

    await centralizeMcpServer(server, customHome);
    // ensure disabled is saved
    await toggleMcpServer('postgres', false, customHome);

    const updated = await updateServerDiscoveryMetadata(
      'postgres',
      {
        title: 'PostgreSQL Server',
        version: '1.4.2',
        description: 'Direct SQL execution for PostgreSQL databases',
        instructions: 'Run read-only queries with caution.',
        tools: [
          { name: 'query', description: 'Run SQL query' },
          { name: 'tables', description: 'List database tables' },
        ],
      },
      customHome
    );

    expect(updated.title).toBe('PostgreSQL Server');
    expect(updated.version).toBe('1.4.2');
    expect(updated.description).toBe('Direct SQL execution for PostgreSQL databases');
    expect(updated.instructions).toBe('Run read-only queries with caution.');
    expect(updated.declaredToolsCount).toBe(2);
    expect(updated.enabled).toBe(false); // Preserved user override
    expect(updated.env?.PGUSER).toBe('admin'); // Preserved user env
    expect(updated.lastDiscoveredAt).toBeDefined();

    const registry = await loadMcpRegistry(customHome);
    expect(registry['postgres'].title).toBe('PostgreSQL Server');
    expect(registry['postgres'].version).toBe('1.4.2');
    expect(registry['postgres'].enabled).toBe(false);
  });

  it('reverts a centralized MCP server by removing it from the registry', async () => {
    const serverA: McpServerManifest = {
      id: 'gemini:server-a',
      name: 'server-a',
      transport: 'stdio',
      command: 'echo',
      args: ['a'],
      declaredToolsCount: 1,
    };
    const serverB: McpServerManifest = {
      id: 'gemini:server-b',
      name: 'server-b',
      transport: 'stdio',
      command: 'echo',
      args: ['b'],
      declaredToolsCount: 1,
    };

    await centralizeMcpServer(serverA, customHome);
    await centralizeMcpServer(serverB, customHome);

    const initialRegistry = await loadMcpRegistry(customHome);
    expect(Object.keys(initialRegistry)).toHaveLength(2);

    const reverted = await revertMcpServer('server-a', customHome);
    expect(reverted.name).toBe('server-a');
    expect(reverted.status).toBe('original');

    const updatedRegistry = await loadMcpRegistry(customHome);
    expect(updatedRegistry['server-a']).toBeUndefined();
    expect(updatedRegistry['server-b']).toBeDefined();
  });
});

