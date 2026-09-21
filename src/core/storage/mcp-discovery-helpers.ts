import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { McpToolDefinition } from '../types.js';

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
