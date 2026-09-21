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
import { HybridSearchEngine } from '../../../src/core/search/hybrid.js';

describe('Codebase Tool Search Reproduction', () => {
  let testTempDir: string;
  let dbPath: string;
  let db: SearchDatabase;
  let embedder: LocalEmbedder;
  let indexer: IncrementalIndexer;
  let engine: HybridSearchEngine;

  beforeEach(async () => {
    testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-codebase-test-'));
    dbPath = path.join(testTempDir, 'cache', 'index.db');
    db = initSearchDb(dbPath);
    embedder = new LocalEmbedder();
    indexer = new IncrementalIndexer(db, embedder);
    engine = new HybridSearchEngine(db, embedder);

    // 1. Seed generic skills and workflows with long content full of stopwords and common words
    await indexer.indexItem({
      id: 'workflow:code-review',
      itemType: 'workflow',
      name: 'code-review',
      command: '/code-review',
      ecosystem: 'gemini',
      sourcePath: '/workflows/code-review.md',
      contentHash: 'hash-cr',
      description: 'Comprehensive code review across multiple dimensions',
      content: 'The review of the code base that checks the tools and the code for errors in the code base that are important',
    });

    await indexer.indexItem({
      id: 'workflow:rebase',
      itemType: 'workflow',
      name: 'rebase',
      command: '/rebase',
      ecosystem: 'gemini',
      sourcePath: '/workflows/rebase.md',
      contentHash: 'hash-reb',
      description: 'Git rebase assistant',
      content: 'Rebase the code on the base branch with git tools that manage the code base',
    });

    // 2. Seed downstream MCP tools
    await indexer.indexItem({
      id: 'mcp_tool:codebase-memory-mcp:get_architecture',
      itemType: 'mcp_tool',
      name: 'codebase-memory-mcp:get_architecture',
      command: 'codebase-memory-mcp',
      ecosystem: 'gemini',
      sourcePath: 'mcp',
      contentHash: 'hash-arch',
      description: 'Get architectural overview: god nodes, communities, dependencies',
      content: 'codebase-memory-mcp MCP tool get_architecture: Get architectural overview: god nodes, communities, dependencies',
    });

    await indexer.indexItem({
      id: 'mcp_tool:trace:get_project_map',
      itemType: 'mcp_tool',
      name: 'trace:get_project_map',
      command: 'trace',
      ecosystem: 'gemini',
      sourcePath: 'mcp',
      contentHash: 'hash-map',
      description: 'Get project overview: detected frameworks, languages, file counts, structure',
      content: 'trace MCP tool get_project_map: Get project overview: detected frameworks, languages, file counts, structure. Read-only, no side effects.',
    });
  });

  afterEach(async () => {
    closeSearchDb(db);
    await fs.rm(testTempDir, { recursive: true, force: true });
  });

  it('ranks MCP tools in top results for query "tools that explain the code base"', async () => {
    const results = await engine.search('tools that explain the code base', { limit: 5 });

    // Expect at least one codebase MCP tool to be in top results
    const topMcp = results.filter((r) => r.itemType === 'mcp_tool');
    expect(topMcp.length).toBeGreaterThan(0);
    expect(results[0].itemType).toBe('mcp_tool');
  });
});
