import { initSearchDb, SearchDatabase } from './db.js';
import { IncrementalIndexer } from './indexer.js';
import { scanAllInventory, InventoryResult } from '../scanner/index.js';
import { loadMcpRegistry, loadServerInstructions } from '../storage/mcp-store.js';
import { McpServerManifest } from '../types.js';
import { IndexSyncStats } from './types.js';
import { defaultLogger } from '../logger.js';

export interface FullIndexSyncResult {
  skills: IndexSyncStats;
  workflows: IndexSyncStats;
  mcpTools: IndexSyncStats;
  total: number;
  indexed: number;
  updated: number;
  skipped: number;
}

export interface SyncIndexOptions {
  customHome?: string;
  inventory?: InventoryResult;
}

/**
 * Synchronizes the search index with all active skills, workflows, and MCP tools.
 * Merges scanned inventory with centralized MCP server registries to capture cached schemas.
 */
export async function syncFullSearchIndex(
  db?: SearchDatabase,
  options?: SyncIndexOptions
): Promise<FullIndexSyncResult> {
  const targetDb = db || initSearchDb(undefined, { allowVectorFallback: true });
  const indexer = new IncrementalIndexer(targetDb);

  const inventory = options?.inventory || (await scanAllInventory());
  const registry = await loadMcpRegistry(options?.customHome);

  // Merge scanned MCP servers with central registry state to capture cached schemas
  const mcpMap = new Map<string, McpServerManifest>();
  for (const s of inventory.mcpServers) {
    mcpMap.set(s.name, s);
  }
  for (const [name, reg] of Object.entries(registry)) {
    const existing = mcpMap.get(name);
    if (existing) {
      mcpMap.set(name, {
        ...existing,
        ...reg,
        tools: (reg.tools && reg.tools.length > 0) ? reg.tools : existing.tools,
        declaredToolsCount: (reg.tools && reg.tools.length > 0) ? reg.tools.length : existing.declaredToolsCount,
      });
    } else {
      mcpMap.set(name, reg);
    }
  }
  for (const server of mcpMap.values()) {
    if (!server.instructions) {
      try {
        server.instructions = await loadServerInstructions(server.name);
      } catch {
        // ignore missing instructions
      }
    }
  }
  const allMcpServers = Array.from(mcpMap.values());

  const skillStats = await indexer.indexSkills(inventory.skills);
  const workflowStats = await indexer.indexWorkflows(inventory.workflows);
  const mcpStats = await indexer.indexMcpTools(allMcpServers);

  const total = skillStats.total + workflowStats.total + mcpStats.total;
  const indexed = skillStats.indexed + workflowStats.indexed + mcpStats.indexed;
  const updated = skillStats.updated + workflowStats.updated + mcpStats.updated;
  const skipped = skillStats.skipped + workflowStats.skipped + mcpStats.skipped;

  defaultLogger.info('Search index synchronization completed', {
    total,
    indexed,
    updated,
    skipped,
  });

  return {
    skills: skillStats,
    workflows: workflowStats,
    mcpTools: mcpStats,
    total,
    indexed,
    updated,
    skipped,
  };
}
