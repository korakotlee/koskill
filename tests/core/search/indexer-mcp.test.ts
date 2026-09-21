/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { initSearchDb, closeSearchDb, SearchDatabase } from '../../../src/core/search/db.js';
import { IncrementalIndexer } from '../../../src/core/search/indexer.js';
import { LocalEmbedder } from '../../../src/core/search/embedder.js';
import { routeCapabilities } from '../../../src/core/search/hybrid.js';
import { McpServerManifest } from '../../../src/core/types.js';

describe('MCP Tools Indexing in Search Indexer', () => {
  let testTempDir: string;
  let dbPath: string;
  let db: SearchDatabase;
  let indexer: IncrementalIndexer;
  let embedder: LocalEmbedder;

  beforeEach(async () => {
    testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-mcp-indexer-test-'));
    dbPath = path.join(testTempDir, 'cache', 'index.db');
    db = initSearchDb(dbPath);
    embedder = new LocalEmbedder();
    indexer = new IncrementalIndexer(db, embedder);
  });

  afterEach(async () => {
    closeSearchDb(db);
    await fs.rm(testTempDir, { recursive: true, force: true });
  });

  it('indexes tools from an MCP server manifest and makes them discoverable', async () => {
    const server: McpServerManifest = {
      id: 'gemini:trace',
      name: 'trace',
      transport: 'stdio',
      command: '/Users/korakot/.trace/bin/trace',
      args: ['serve'],
      declaredToolsCount: 2,
      tools: [
        {
          name: 'get_project_map',
          description: 'Generates high-level structural map of targets, packages, and modules.',
          parameters: { type: 'object' },
        },
        {
          name: 'find_usages',
          description: 'Finds all references and call sites for a given code symbol or token.',
          parameters: { type: 'object' },
        },
      ],
    };

    // indexMcpTools should be implemented on IncrementalIndexer
    // @ts-expect-error - testing new method
    const stats = await indexer.indexMcpTools([server]);
    expect(stats.indexed).toBe(2);
    expect(stats.total).toBe(2);

    // Verify stored in items_meta
    const metaRow = db.prepare('SELECT * FROM items_meta WHERE id = ?').get('mcp_tool:trace:get_project_map') as any;
    expect(metaRow).toBeDefined();
    expect(metaRow.item_type).toBe('mcp_tool');
    expect(metaRow.name).toBe('trace:get_project_map');

    // Verify discoverable via routeCapabilities
    const results = await routeCapabilities(db, 'project architecture structure map', { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.id === 'mcp_tool:trace:get_project_map')).toBe(true);
  });
});
