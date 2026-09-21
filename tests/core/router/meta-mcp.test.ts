import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MetaMcpServer } from '../../../src/core/router/meta-mcp.js';
import { RouterLogger } from '../../../src/core/router/logger.js';
import { McpProxy } from '../../../src/core/router/mcp-proxy.js';

describe('MetaMcpServer', () => {
  let tmpDir: string;
  let logger: RouterLogger;
  let proxy: McpProxy;
  let server: MetaMcpServer;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koskill-meta-test-'));
    logger = new RouterLogger({
      logFilePath: path.join(tmpDir, 'router_tx.log'),
    });
    proxy = new McpProxy({
      pidsFilePath: path.join(tmpDir, 'pids.json'),
    });
    server = new MetaMcpServer({
      logger,
      proxy,
      storeDir: tmpDir,
    });
  });

  afterEach(async () => {
    await proxy.closeAll();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('lists exactly three meta-tools on tools/list', async () => {
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });

    expect(response.result).toBeDefined();
    const tools = response.result.tools;
    expect(tools).toHaveLength(3);
    const names = tools.map((t: any) => t.name).sort();
    expect(names).toEqual(['discover_capabilities', 'invoke_tool', 'load_skill']);
  });

  it('handles discover_capabilities and returns ranked compact descriptors', async () => {
    // Mock search provider
    server.setSearchProvider(async (query, category, limit) => [
      {
        id: 'skill-access',
        itemType: 'skill',
        name: 'accessibility',
        description: 'Audit and improve web accessibility following WCAG 2.2',
        score: 0.95,
        parametersSummary: 'url: string',
      },
    ]);

    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'discover_capabilities',
        arguments: { query: 'audit a11y' },
      },
    });

    expect(response.result).toBeDefined();
    const content = JSON.parse(response.result.content[0].text);
    expect(content.capabilities).toHaveLength(1);
    expect(content.capabilities[0].name).toBe('accessibility');

    const logs = logger.getTransactions();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('DISCOVER');
    expect(logs[0].status).toBe('SUCCESS');
  });

  it('handles load_skill and extracts SKILL.md plus companion files', async () => {
    const skillDir = path.join(tmpDir, 'skills', 'test-skill');
    const refsDir = path.join(skillDir, 'references');
    fs.mkdirSync(refsDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill Content');
    fs.writeFileSync(path.join(refsDir, 'guide.md'), 'Guide text');

    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'load_skill',
        arguments: { name: 'test-skill' },
      },
    });

    expect(response.result).toBeDefined();
    const content = JSON.parse(response.result.content[0].text);
    expect(content.name).toBe('test-skill');
    expect(content.content).toContain('# Test Skill Content');
    expect(content.companionFiles).toContain('references/guide.md');

    const logs = logger.getTransactions();
    expect(logs[0].action).toBe('LOAD_SKILL');
  });

  it('handles invoke_tool by proxying to McpProxy', async () => {
    vi.spyOn(proxy, 'executeTool').mockResolvedValue({
      content: [{ type: 'text', text: 'tool-executed' }],
    });

    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'invoke_tool',
        arguments: {
          server: 'chrome-devtools',
          tool: 'click',
          arguments: { selector: '#submit' },
        },
      },
    });

    expect(response.result).toBeDefined();
    const result = response.result;
    expect(result.content[0].text).toBe('tool-executed');

    const logs = logger.getTransactions();
    expect(logs[0].action).toBe('INVOKE_TOOL');
    expect(logs[0].targetServer).toBe('chrome-devtools');
    expect(logs[0].targetTool).toBe('click');
  });

  it('ignores notifications/initialized without returning an error', async () => {
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });

    expect(response).toBeUndefined();
  });

  it('handles ping method compliant with MCP specification', async () => {
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 99,
      method: 'ping',
    });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 99,
      result: {},
    });
  });
});
