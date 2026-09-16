import path from 'path';
import os from 'os';
import { SkillManifest, McpServerManifest, WorkflowManifest } from '../types.js';
import { scanGeminiSkills, scanGeminiMcp } from './gemini.js';
import { scanClaudeSkills, scanClaudeMcp } from './claude.js';
import { scanWorkflows, WorkflowScanOptions } from './workflows.js';
import { defaultLogger } from '../logger.js';

export interface InventoryOptions {
  geminiSkillsDirs?: string[];
  geminiMcpFiles?: string[];
  claudeSettingsFiles?: string[];
  claudeMcpFiles?: string[];
  workflowOptions?: WorkflowScanOptions;
}

export interface InventoryResult {
  skills: SkillManifest[];
  mcpServers: McpServerManifest[];
  workflows: WorkflowManifest[];
  totalSkills: number;
  totalMcpServers: number;
  totalWorkflows: number;
}

/**
 * Resolves standard default inspection paths across user home and workspace.
 */
export function getDefaultPaths(): Required<Omit<InventoryOptions, 'workflowOptions'>> {
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

  const workflowPromise = scanWorkflows(options?.workflowOptions);

  const [skillResults, mcpResults, workflowResult] = await Promise.all([
    Promise.allSettled(skillPromises),
    Promise.allSettled(mcpPromises),
    workflowPromise
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
  const workflows = workflowResult;

  return {
    skills,
    mcpServers,
    workflows,
    totalSkills: skills.length,
    totalMcpServers: mcpServers.length,
    totalWorkflows: workflows.length
  };
}

export * from './gemini.js';
export * from './claude.js';
export * from './workflows.js';

