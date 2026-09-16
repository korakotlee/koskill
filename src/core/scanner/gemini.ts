import fs from 'fs/promises';
import path from 'path';
import { SkillManifest, McpServerManifest } from '../types.js';
import { defaultLogger } from '../logger.js';

/**
 * Extracts basic YAML frontmatter key-value pairs from markdown content.
 */
export function extractFrontmatter(content: string): {
  attributes: Record<string, string>;
  body: string;
} {
  const attributes: Record<string, string> = {};
  if (!content.startsWith('---')) {
    return { attributes, body: content };
  }

  const endIdx = content.indexOf('\n---', 3);
  if (endIdx === -1) {
    return { attributes, body: content };
  }

  const header = content.slice(3, endIdx).trim();
  const body = content.slice(endIdx + 4).trim();

  for (const line of header.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      attributes[key] = value;
    }
  }

  return { attributes, body };
}

/**
 * Scans a directory for Gemini skill packages containing SKILL.md.
 *
 * @param skillsDirectory Directory containing skill subdirectories
 */
export async function scanGeminiSkills(skillsDirectory: string): Promise<SkillManifest[]> {
  try {
    const entries = await fs.readdir(skillsDirectory, { withFileTypes: true });
    const skills: SkillManifest[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = path.join(skillsDirectory, entry.name, 'SKILL.md');
      try {
        const rawContent = await fs.readFile(skillPath, 'utf-8');
        const { attributes, body } = extractFrontmatter(rawContent);

        const name = attributes.name || entry.name;
        let description = attributes.description || '';
        if (!description) {
          const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
          const nonHeading = lines.find((l) => !l.startsWith('#'));
          description = nonHeading || (lines[0] ? lines[0].replace(/^#+\s*/, '').trim() : '');
        }

        skills.push({
          id: `gemini:${name}`,
          name,
          description,
          sourcePath: skillPath,
          targetEcosystem: 'gemini',
          status: 'original',
          metadata: { ...attributes },
          rawContent
        });
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          defaultLogger.warn(`Failed to parse Gemini skill at ${skillPath}`, { error: err.message });
        }
      }
    }

    return skills;
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      defaultLogger.warn(`Failed to read Gemini skills directory at ${skillsDirectory}`, { error: err.message });
    }
    return [];
  }
}

/**
 * Scans an mcp_config.json file for declared MCP servers.
 *
 * @param configFilePath Path to mcp_config.json
 */
export async function scanGeminiMcp(configFilePath: string): Promise<McpServerManifest[]> {
  try {
    const fileContent = await fs.readFile(configFilePath, 'utf-8');
    const parsed = JSON.parse(fileContent);
    const servers: McpServerManifest[] = [];

    const mcpServers = parsed.mcpServers || {};
    for (const [name, config] of Object.entries(mcpServers)) {
      const s = config as any;
      if (!s || typeof s !== 'object') continue;

      servers.push({
        id: `gemini:${name}`,
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
      defaultLogger.warn(`Failed to parse Gemini MCP config at ${configFilePath}`, { error: err.message });
    }
    return [];
  }
}
