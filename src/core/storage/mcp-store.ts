import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
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

/**
 * Scans on-disk tool schemas for a given server name if available.
 */
export async function discoverServerTools(
  serverName: string,
  searchDirs?: string[]
): Promise<McpToolDefinition[]> {
  const dirs = searchDirs || [
    path.join(os.homedir(), '.gemini', 'antigravity-ide', 'mcp', serverName),
    path.join(os.homedir(), '.claude', 'mcp', serverName),
  ];

  const tools: McpToolDefinition[] = [];

  for (const dir of dirs) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
        try {
          const content = await fs.readFile(path.join(dir, entry.name), 'utf-8');
          const schema = JSON.parse(content);
          if (schema && typeof schema === 'object' && schema.name) {
            tools.push({
              name: schema.name,
              description: schema.description || '',
              parameters: schema.parameters,
            });
          }
        } catch {
          // ignore corrupted schema file
        }
      }
      if (tools.length > 0) break;
    } catch {
      // directory does not exist, continue search
    }
  }

  return tools;
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
 * Loads instructions.md for a given server from standard configuration directories.
 */
export async function loadServerInstructions(
  serverName: string,
  searchDirs?: string[]
): Promise<string | undefined> {
  const baseDirs = searchDirs || [
    path.join(os.homedir(), '.gemini', 'antigravity-ide', 'mcp'),
    path.join(os.homedir(), '.claude', 'mcp'),
  ];

  for (const base of baseDirs) {
    try {
      const candidates = base.endsWith(serverName)
        ? [path.join(base, 'instructions.md')]
        : [path.join(base, serverName, 'instructions.md'), path.join(base, 'instructions.md')];

      for (const instrPath of candidates) {
        try {
          const content = await fs.readFile(instrPath, 'utf-8');
          if (content && content.trim().length > 0) {
            return content.trim();
          }
        } catch {
          // File does not exist at this candidate path
        }
      }
    } catch {
      // Continue to next directory
    }
  }
  return undefined;
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

