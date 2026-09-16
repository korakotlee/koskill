import path from 'path';
import os from 'os';
import { SkillManifest, McpServerManifest } from '../types.js';
import { scanGeminiSkills, scanGeminiMcp } from './gemini.js';
import { scanClaudeSkills, scanClaudeMcp } from './claude.js';
import { defaultLogger } from '../logger.js';

export interface InventoryOptions {
  geminiSkillsDirs?: string[];
  geminiMcpFiles?: string[];
  claudeSettingsFiles?: string[];
  claudeMcpFiles?: string[];
}

export interface InventoryResult {
  skills: SkillManifest[];
  mcpServers: McpServerManifest[];
  totalSkills: number;
  totalMcpServers: number;
}

/**
 * Resolves standard default inspection paths across user home and workspace.
 */
export function getDefaultPaths(): Required<InventoryOptions> {
  const homeDir = os.homedir();
  const cwd = process.cwd();

  return {
    geminiSkillsDirs: [
      path.join(homeDir, '.gemini/config/skills'),
      path.join(cwd, '.agents/skills')
    ],
    geminiMcpFiles: [
      path.join(homeDir, '.gemini/config/mcp_config.json'),
      path.join(cwd, '.agents/mcp_config.json')
    ],
    claudeSettingsFiles: [
      path.join(homeDir, '.claude/settings.json')
    ],
    claudeMcpFiles: [
      path.join(homeDir, '.claude/mcp.json')
    ]
  };
}

/**
 * Scans all registered ecosystems (Gemini CLI and Claude Code) in parallel.
 *
 * @param options Optional custom path overrides for testing or isolated environments
 */
export async function scanAllInventory(options?: InventoryOptions): Promise<InventoryResult> {
  const defaults = getDefaultPaths();
  const geminiSkillsDirs = options?.geminiSkillsDirs ?? defaults.geminiSkillsDirs;
  const geminiMcpFiles = options?.geminiMcpFiles ?? defaults.geminiMcpFiles;
  const claudeSettingsFiles = options?.claudeSettingsFiles ?? defaults.claudeSettingsFiles;
  const claudeMcpFiles = options?.claudeMcpFiles ?? defaults.claudeMcpFiles;

  const skillPromises = [
    ...geminiSkillsDirs.map((dir) => scanGeminiSkills(dir)),
    ...claudeSettingsFiles.map((file) => scanClaudeSkills(file))
  ];

  const mcpPromises = [
    ...geminiMcpFiles.map((file) => scanGeminiMcp(file)),
    ...claudeMcpFiles.map((file) => scanClaudeMcp(file))
  ];

  const [skillResults, mcpResults] = await Promise.all([
    Promise.allSettled(skillPromises),
    Promise.allSettled(mcpPromises)
  ]);

  const skillsMap = new Map<string, SkillManifest>();
  for (const result of skillResults) {
    if (result.status === 'fulfilled') {
      for (const skill of result.value) {
        skillsMap.set(skill.id, skill);
      }
    } else {
      defaultLogger.warn('A skill scanner promise was rejected', { error: result.reason });
    }
  }

  const mcpMap = new Map<string, McpServerManifest>();
  for (const result of mcpResults) {
    if (result.status === 'fulfilled') {
      for (const server of result.value) {
        mcpMap.set(server.id, server);
      }
    } else {
      defaultLogger.warn('An MCP scanner promise was rejected', { error: result.reason });
    }
  }

  const skills = Array.from(skillsMap.values());
  const mcpServers = Array.from(mcpMap.values());

  return {
    skills,
    mcpServers,
    totalSkills: skills.length,
    totalMcpServers: mcpServers.length
  };
}

export * from './gemini.js';
export * from './claude.js';
