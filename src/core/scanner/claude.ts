import fs from 'fs/promises';
import { SkillManifest, McpServerManifest } from '../types.js';
import { defaultLogger } from '../logger.js';

/**
 * Scans a Claude settings.json or mcp.json file for MCP server configurations.
 *
 * @param configFilePath Path to Claude settings.json or mcp.json
 */
export async function scanClaudeMcp(configFilePath: string): Promise<McpServerManifest[]> {
  try {
    const fileContent = await fs.readFile(configFilePath, 'utf-8');
    const parsed = JSON.parse(fileContent);
    const servers: McpServerManifest[] = [];

    const mcpServers = parsed.mcpServers || {};
    for (const [name, config] of Object.entries(mcpServers)) {
      const s = config as any;
      if (!s || typeof s !== 'object') continue;

      servers.push({
        id: `claude:${name}`,
        name,
        transport: s.transport === 'sse' ? 'sse' : 'stdio',
        command: s.command || '',
        args: Array.isArray(s.args) ? s.args : [],
        env: s.env && typeof s.env === 'object' ? s.env : undefined,
        declaredToolsCount: Array.isArray(s.tools) ? s.tools.length : 0
      });
    }

    return servers;
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      defaultLogger.warn(`Failed to parse Claude MCP file at ${configFilePath}`, { error: err.message });
    }
    return [];
  }
}

/**
 * Scans a Claude settings.json file for configured skills or tools.
 *
 * @param settingsFilePath Path to Claude settings.json
 */
export async function scanClaudeSkills(settingsFilePath: string): Promise<SkillManifest[]> {
  try {
    const fileContent = await fs.readFile(settingsFilePath, 'utf-8');
    const parsed = JSON.parse(fileContent);
    const skills: SkillManifest[] = [];

    if (Array.isArray(parsed.skills)) {
      for (const item of parsed.skills) {
        if (!item || typeof item !== 'object') continue;
        const name = item.name || 'unnamed-skill';
        skills.push({
          id: `claude:${name}`,
          name,
          description: item.description || '',
          sourcePath: item.path || settingsFilePath,
          targetEcosystem: 'claude',
          status: 'original',
          metadata: { ...item }
        });
      }
    } else if (parsed.skills && typeof parsed.skills === 'object') {
      for (const [name, config] of Object.entries(parsed.skills)) {
        const item = config as any;
        skills.push({
          id: `claude:${name}`,
          name,
          description: item?.description || '',
          sourcePath: item?.path || settingsFilePath,
          targetEcosystem: 'claude',
          status: 'original',
          metadata: typeof item === 'object' ? { ...item } : {}
        });
      }
    }

    return skills;
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      defaultLogger.warn(`Failed to parse Claude skills from ${settingsFilePath}`, { error: err.message });
    }
    return [];
  }
}
