import http from 'http';
import { scanAllInventory } from '../../core/scanner/index.js';
import {
  loadMcpRegistry,
  centralizeMcpServer,
  revertMcpServer,
  toggleMcpServer,
  generateAgentsMcpSubset,
  discoverServerTools,
  updateServerTools,
} from '../../core/storage/mcp-store.js';
import { queryMcpServerTools } from '../../core/mcp/mcp-client.js';
import { defaultDiscoveryService } from '../services/mcp-discovery-service.js';
import { defaultLogger } from '../../core/logger.js';
import { McpServerManifest } from '../../core/types.js';
import { parseJsonBody } from '../utils.js';

/**
 * Handles incoming HTTP requests for MCP servers, registry, and tool inspection.
 */
export async function handleMcpRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<boolean> {
  // GET /api/mcp
  if (req.method === 'GET' && url.pathname === '/api/mcp') {
    try {
      const inventory = await scanAllInventory();
      const registry = await loadMcpRegistry();

      // Merge scanned servers with central registry state
      const mergedServers: McpServerManifest[] = [];
      const seenNames = new Set<string>();

      for (const scanned of inventory.mcpServers) {
        seenNames.add(scanned.name);
        const registered = registry[scanned.name];
        let tools = registered?.tools || scanned.tools;
        if (!tools || tools.length === 0) {
          tools = await discoverServerTools(scanned.name);
        }

        mergedServers.push({
          ...scanned,
          title: registered?.title || scanned.title,
          version: registered?.version || scanned.version,
          description: registered?.description || scanned.description,
          instructions: registered?.instructions || scanned.instructions,
          serverInfo: registered?.serverInfo || scanned.serverInfo,
          status: registered ? 'centralized' : 'original',
          enabled: registered ? registered.enabled !== false : true,
          tools,
          declaredToolsCount: tools.length > 0 ? tools.length : scanned.declaredToolsCount,
          lastDiscoveredAt: registered?.lastDiscoveredAt || scanned.lastDiscoveredAt,
        });
      }

      // Add registered servers not found in current scan
      for (const [name, registered] of Object.entries(registry)) {
        if (!seenNames.has(name)) {
          mergedServers.push(registered);
        }
      }

      res.writeHead(200);
      res.end(JSON.stringify({ servers: mergedServers, total: mergedServers.length }));
      return true;
    } catch (err: any) {
      defaultLogger.error('Failed to list MCP servers', { error: err.message });
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // GET /api/mcp/:name
  if (req.method === 'GET' && url.pathname.startsWith('/api/mcp/') && !url.pathname.includes('/generate-subset')) {
    const serverName = decodeURIComponent(url.pathname.slice('/api/mcp/'.length));
    try {
      const inventory = await scanAllInventory();
      const registry = await loadMcpRegistry();

      const scanned = inventory.mcpServers.find((s) => s.name === serverName || s.id === serverName);
      const registered = registry[serverName];

      if (!scanned && !registered) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `MCP server '${serverName}' not found` }));
        return true;
      }

      const base = registered || scanned!;
      let tools = base.tools;
      if (!tools || tools.length === 0) {
        tools = await discoverServerTools(base.name);
      }

      const server: McpServerManifest = {
        ...base,
        title: registered?.title || scanned?.title || base.title,
        version: registered?.version || scanned?.version || base.version,
        description: registered?.description || scanned?.description || base.description,
        instructions: registered?.instructions || scanned?.instructions || base.instructions,
        serverInfo: registered?.serverInfo || scanned?.serverInfo || base.serverInfo,
        status: registered ? 'centralized' : 'original',
        enabled: registered ? registered.enabled !== false : true,
        tools,
        declaredToolsCount: tools.length > 0 ? tools.length : base.declaredToolsCount,
        lastDiscoveredAt: registered?.lastDiscoveredAt || scanned?.lastDiscoveredAt || base.lastDiscoveredAt,
      };

      res.writeHead(200);
      res.end(JSON.stringify({ server }));
      return true;
    } catch (err: any) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // POST /api/mcp/generate-subset
  if (req.method === 'POST' && url.pathname === '/api/mcp/generate-subset') {
    try {
      const body = await parseJsonBody<{ targetPath?: string }>(req);
      const result = await generateAgentsMcpSubset(body.targetPath);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, ...result }));
      return true;
    } catch (err: any) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // POST /api/mcp/:name/centralize
  if (req.method === 'POST' && url.pathname.startsWith('/api/mcp/') && url.pathname.endsWith('/centralize')) {
    const serverName = decodeURIComponent(url.pathname.slice('/api/mcp/'.length, -('/centralize'.length)));
    try {
      const inventory = await scanAllInventory();
      const scanned = inventory.mcpServers.find((s) => s.name === serverName || s.id === serverName);
      if (!scanned) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `MCP server '${serverName}' not found` }));
        return true;
      }

      const centralized = await centralizeMcpServer(scanned);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, server: centralized }));
      return true;
    } catch (err: any) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // POST /api/mcp/:name/revert
  if (req.method === 'POST' && url.pathname.startsWith('/api/mcp/') && url.pathname.endsWith('/revert')) {
    const serverName = decodeURIComponent(url.pathname.slice('/api/mcp/'.length, -('/revert'.length)));
    try {
      const reverted = await revertMcpServer(serverName);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, server: reverted }));
      return true;
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 500;
      res.writeHead(status);
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // POST /api/mcp/:name/toggle
  if (req.method === 'POST' && url.pathname.startsWith('/api/mcp/') && url.pathname.endsWith('/toggle')) {
    const serverName = decodeURIComponent(url.pathname.slice('/api/mcp/'.length, -('/toggle'.length)));
    try {
      const body = await parseJsonBody<{ enabled?: boolean }>(req);
      const enabled = body.enabled !== undefined ? Boolean(body.enabled) : true;

      // If not yet centralized, centralize first
      const registry = await loadMcpRegistry();
      if (!registry[serverName]) {
        const inventory = await scanAllInventory();
        const scanned = inventory.mcpServers.find((s) => s.name === serverName || s.id === serverName);
        if (scanned) {
          await centralizeMcpServer(scanned);
        }
      }

      const updated = await toggleMcpServer(serverName, enabled);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, server: updated }));
      return true;
    } catch (err: any) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // POST /api/mcp/:name/query-tools
  if (req.method === 'POST' && url.pathname.startsWith('/api/mcp/') && url.pathname.endsWith('/query-tools')) {
    const serverName = decodeURIComponent(url.pathname.slice('/api/mcp/'.length, -('/query-tools'.length)));
    try {
      const inventory = await scanAllInventory();
      const registry = await loadMcpRegistry();
      const scanned = inventory.mcpServers.find((s) => s.name === serverName || s.id === serverName);
      const registered = registry[serverName];

      if (!scanned && !registered) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `MCP server '${serverName}' not found` }));
        return true;
      }

      const base = registered || scanned!;
      if (!base.command) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: `MCP server '${serverName}' has no command configured` }));
        return true;
      }

      const tools = await queryMcpServerTools({
        command: base.command,
        args: base.args,
        env: base.env,
        timeoutMs: 8000,
      });

      let updated: McpServerManifest;
      if (registered) {
        updated = await updateServerTools(serverName, tools);
      } else {
        updated = {
          ...base,
          status: 'original',
          tools,
          declaredToolsCount: tools.length,
        };
      }
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, server: updated, tools, count: tools.length }));
      return true;
    } catch (err: any) {
      defaultLogger.error('Failed to query MCP server tools', { serverName, error: err.message });
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // POST /api/mcp/discover-all
  if (req.method === 'POST' && url.pathname === '/api/mcp/discover-all') {
    try {
      const result = await defaultDiscoveryService.discoverAllServers();
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, ...result }));
      return true;
    } catch (err: any) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // POST /api/mcp/:name/discover
  if (req.method === 'POST' && url.pathname.startsWith('/api/mcp/') && url.pathname.endsWith('/discover')) {
    const serverName = decodeURIComponent(url.pathname.slice('/api/mcp/'.length, -('/discover'.length)));
    try {
      const server = await defaultDiscoveryService.discoverServer(serverName);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, server }));
      return true;
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 500;
      res.writeHead(status);
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  return false;
}

