import { scanAllInventory } from '../../core/scanner/index.js';
import {
  loadMcpRegistry,
  updateServerDiscoveryMetadata,
} from '../../core/storage/mcp-store.js';
import { discoverMcpServer } from '../../core/mcp/mcp-client.js';
import { defaultLogger } from '../../core/logger.js';
import { McpServerManifest } from '../../core/types.js';

export class McpDiscoveryService {
  private inFlight = new Map<string, Promise<McpServerManifest>>();

  /**
   * Discovers metadata for a single MCP server with in-flight deduplication.
   */
  async discoverServer(serverName: string, customHome?: string): Promise<McpServerManifest> {
    if (this.inFlight.has(serverName)) {
      return this.inFlight.get(serverName)!;
    }

    const task = this.executeDiscovery(serverName, customHome);
    this.inFlight.set(serverName, task);

    try {
      return await task;
    } finally {
      this.inFlight.delete(serverName);
    }
  }

  private async executeDiscovery(serverName: string, customHome?: string): Promise<McpServerManifest> {
    const inventory = await scanAllInventory();
    const registry = await loadMcpRegistry(customHome);

    const scanned = inventory.mcpServers.find((s) => s.name === serverName || s.id === serverName);
    const registered = registry[serverName] || Object.values(registry).find((s) => s.id === serverName);

    if (!scanned && !registered) {
      throw new Error(`MCP server '${serverName}' not found`);
    }

    const base = registered || scanned!;
    if (!base.command) {
      throw new Error(`MCP server '${serverName}' has no command configured`);
    }

    defaultLogger.info('Starting live discovery for MCP server', { serverName, command: base.command });

    const discovery = await discoverMcpServer({
      command: base.command,
      args: base.args,
      env: base.env,
      timeoutMs: 6000,
    });

    if (registered) {
      return await updateServerDiscoveryMetadata(
        base.name,
        discovery,
        customHome
      );
    }

    return {
      ...base,
      title: discovery.title ?? base.title,
      version: discovery.version ?? base.version,
      description: discovery.description ?? base.description,
      instructions: discovery.instructions ?? base.instructions,
      serverInfo: discovery.serverInfo ?? base.serverInfo,
      status: 'original',
      tools: discovery.tools && discovery.tools.length > 0 ? discovery.tools : base.tools,
      declaredToolsCount: discovery.tools && discovery.tools.length > 0 ? discovery.tools.length : base.declaredToolsCount,
      lastDiscoveredAt: new Date().toISOString(),
    };
  }

  /**
   * Discovers metadata for all active MCP servers in batch with pooled concurrency.
   */
  async discoverAllServers(customHome?: string): Promise<{ results: McpServerManifest[]; total: number }> {
    const inventory = await scanAllInventory();
    const registry = await loadMcpRegistry(customHome);

    const serverMap = new Map<string, McpServerManifest>();
    for (const s of inventory.mcpServers) {
      serverMap.set(s.name, s);
    }
    for (const [name, r] of Object.entries(registry)) {
      serverMap.set(name, r);
    }

    const servers = Array.from(serverMap.values()).filter((s) => Boolean(s.command));
    const results: McpServerManifest[] = [];

    // Process with concurrency limit of 3
    const concurrencyLimit = 3;
    const queue = [...servers];

    const worker = async () => {
      while (queue.length > 0) {
        const target = queue.shift();
        if (!target) break;
        try {
          const discovered = await this.discoverServer(target.name, customHome);
          results.push(discovered);
        } catch (err: any) {
          defaultLogger.warn('Batch discovery failed for server', { serverName: target.name, error: err.message });
          results.push(target);
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrencyLimit, servers.length) }, () => worker());
    await Promise.all(workers);

    return { results, total: results.length };
  }
}

export const defaultDiscoveryService = new McpDiscoveryService();
