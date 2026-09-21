import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { McpServerInfo, McpServerManifest, McpToolDefinition } from '../types.js';
import { getKoskillMcpDir, initCentralStore } from './store.js';
import { defaultLogger } from '../logger.js';

export interface McpRegistryPayload {
  mcpServers: Record<string, McpServerManifest>;
}

export function getMcpRegistryPath(customHome?: string): string {
  return path.join(getKoskillMcpDir(customHome), 'servers.json');
}

/**
 * Loads the central MCP registry containing all known servers and their enabled states.
 */
export async function loadMcpRegistry(
  customHome?: string
): Promise<Record<string, McpServerManifest>> {
  await initCentralStore(customHome);
  const registryPath = getMcpRegistryPath(customHome);

  try {
    const raw = await fs.readFile(registryPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.mcpServers || {};
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      defaultLogger.warn('Failed to parse MCP registry, returning empty', { error: err.message });
    }
    return {};
  }
}

/**
 * Saves the central MCP registry to disk atomically.
 */
export async function saveMcpRegistry(
  registry: Record<string, McpServerManifest>,
  customHome?: string
): Promise<void> {
  await initCentralStore(customHome);
  const registryPath = getMcpRegistryPath(customHome);
  const tempPath = `${registryPath}.tmp-${Date.now()}`;

  const payload: McpRegistryPayload = { mcpServers: registry };
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
  await fs.rename(tempPath, registryPath);
}

export { discoverServerTools, loadServerInstructions } from './mcp-discovery-helpers.js';
import { discoverServerTools, loadServerInstructions } from './mcp-discovery-helpers.js';

/**
 * Reverts a centralized MCP server by removing it from the central registry (~/.koskill/mcp/servers.json).
 */
export async function revertMcpServer(
  serverKey: string,
  customHome?: string
): Promise<McpServerManifest> {
  const registry = await loadMcpRegistry(customHome);
  const server = registry[serverKey] || Object.values(registry).find((s) => s.id === serverKey || s.name === serverKey);

  if (!server) {
    throw new Error(`MCP server not found in central registry: ${serverKey}`);
  }

  delete registry[server.name];
  await saveMcpRegistry(registry, customHome);
  defaultLogger.info('Reverted MCP server from registry', { name: server.name });

  return {
    ...server,
    status: 'original',
  };
}

/**
 * Registers an MCP server into the canonical central registry (~/.koskill/mcp/servers.json).
 */
export async function centralizeMcpServer(
  server: McpServerManifest,
  customHome?: string
): Promise<McpServerManifest> {
  const registry = await loadMcpRegistry(customHome);

  // Discover tool definitions if missing
  let tools = server.tools;
  if (!tools || tools.length === 0) {
    tools = await discoverServerTools(server.name);
  }

  const updated: McpServerManifest = {
    ...server,
    enabled: server.enabled !== undefined ? server.enabled : true,
    status: 'centralized',
    tools: tools.length > 0 ? tools : server.tools,
    declaredToolsCount: tools.length > 0 ? tools.length : server.declaredToolsCount,
  };

  registry[server.name] = updated;
  await saveMcpRegistry(registry, customHome);
  defaultLogger.info('Centralized MCP server into registry', { name: server.name });

  return updated;
}

/**
 * Toggles the enabled state of an MCP server in the registry.
 */
export async function toggleMcpServer(
  serverKey: string,
  enabled: boolean,
  customHome?: string
): Promise<McpServerManifest> {
  const registry = await loadMcpRegistry(customHome);
  const server = registry[serverKey] || Object.values(registry).find((s) => s.id === serverKey);

  if (!server) {
    throw new Error(`MCP server not found in central registry: ${serverKey}`);
  }

  server.enabled = enabled;
  registry[server.name] = server;
  await saveMcpRegistry(registry, customHome);

  defaultLogger.info('Toggled MCP server enabled status', { name: server.name, enabled });
  return server;
}

/**
 * Generates a subset of enabled MCP servers into agents_mcp/servers.json.
 */
export async function generateAgentsMcpSubset(
  targetFilePath?: string,
  customHome?: string
): Promise<{ targetPath: string; count: number }> {
  const registry = await loadMcpRegistry(customHome);
  const destination = targetFilePath
    ? path.resolve(targetFilePath)
    : path.resolve(process.cwd(), 'agents_mcp', 'servers.json');

  await fs.mkdir(path.dirname(destination), { recursive: true });

  const enabledServers: Record<string, any> = {};
  let count = 0;

  for (const [name, manifest] of Object.entries(registry)) {
    if (manifest.enabled !== false) {
      enabledServers[name] = {
        command: manifest.command,
        args: manifest.args,
        env: manifest.env,
        transport: manifest.transport,
      };
      count++;
    }
  }

  const outputPayload = { mcpServers: enabledServers };
  const tempPath = `${destination}.tmp-${Date.now()}`;
  await fs.writeFile(tempPath, JSON.stringify(outputPayload, null, 2), 'utf-8');
  await fs.rename(tempPath, destination);

  defaultLogger.info('Generated agents_mcp subset', { destination, count });
  return { targetPath: destination, count };
}

/**
 * Updates the tools list for an MCP server in the central registry.
 */
export async function updateServerTools(
  serverName: string,
  tools: McpToolDefinition[],
  customHome?: string
): Promise<McpServerManifest> {
  const registry = await loadMcpRegistry(customHome);
  const server = registry[serverName] || Object.values(registry).find((s) => s.id === serverName || s.name === serverName);

  if (!server) {
    throw new Error(`MCP server not found in central registry: ${serverName}`);
  }

  server.tools = tools;
  server.declaredToolsCount = tools.length;
  registry[server.name] = server;
  await saveMcpRegistry(registry, customHome);

  defaultLogger.info('Updated MCP server tools in registry', { name: server.name, toolsCount: tools.length });
  return server;
}

/**
 * Updates an MCP server with newly discovered metadata in the registry.
 */
export async function updateServerDiscoveryMetadata(
  serverName: string,
  discovery: {
    title?: string;
    version?: string;
    description?: string;
    instructions?: string;
    serverInfo?: McpServerInfo;
    tools?: McpToolDefinition[];
  },
  customHome?: string
): Promise<McpServerManifest> {
  const registry = await loadMcpRegistry(customHome);
  const server = registry[serverName] || Object.values(registry).find((s) => s.id === serverName || s.name === serverName);

  if (!server) {
    throw new Error(`MCP server not found in central registry: ${serverName}`);
  }

  let instructions = discovery.instructions || server.instructions;
  if (!instructions) {
    instructions = await loadServerInstructions(server.name);
  }

  const updated: McpServerManifest = {
    ...server,
    title: discovery.title ?? server.title,
    version: discovery.version ?? server.version,
    description: discovery.description ?? server.description,
    instructions,
    serverInfo: discovery.serverInfo ?? server.serverInfo,
    tools: discovery.tools && discovery.tools.length > 0 ? discovery.tools : server.tools,
    declaredToolsCount: discovery.tools && discovery.tools.length > 0 ? discovery.tools.length : server.declaredToolsCount,
    lastDiscoveredAt: new Date().toISOString(),
  };

  registry[server.name] = updated;
  await saveMcpRegistry(registry, customHome);

  defaultLogger.info('Updated MCP server discovery metadata in registry', {
    name: server.name,
    title: updated.title,
    version: updated.version,
    toolsCount: updated.declaredToolsCount,
  });

  return updated;
}

