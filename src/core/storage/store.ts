import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { logger } from '../logger.js';

/**
 * Resolves the root directory path for central KoSkill storage.
 * Defaults to `~/.koskill` unless an explicit directory or `KOSKILL_HOME` is specified.
 *
 * @param customHome - Optional custom directory path override
 * @returns Absolute path to the central KoSkill home directory
 */
export function getKoskillHomeDir(customHome?: string): string {
  if (customHome && customHome.trim().length > 0) {
    return path.resolve(customHome);
  }
  if (process.env.KOSKILL_HOME && process.env.KOSKILL_HOME.trim().length > 0) {
    return path.resolve(process.env.KOSKILL_HOME);
  }
  return path.join(os.homedir(), '.koskill');
}

/**
 * Resolves the skills storage directory inside the central store.
 *
 * @param customHome - Optional custom directory path override
 * @returns Absolute path to `~/.koskill/skills`
 */
export function getKoskillSkillsDir(customHome?: string): string {
  return path.join(getKoskillHomeDir(customHome), 'skills');
}

/**
 * Resolves the MCP server configurations directory inside the central store.
 *
 * @param customHome - Optional custom directory path override
 * @returns Absolute path to `~/.koskill/mcp`
 */
export function getKoskillMcpDir(customHome?: string): string {
  return path.join(getKoskillHomeDir(customHome), 'mcp');
}

/**
 * Resolves the path to the centralized transaction journal file.
 *
 * @param customHome - Optional custom directory path override
 * @returns Absolute path to `~/.koskill/journal.json`
 */
export function getKoskillJournalPath(customHome?: string): string {
  return path.join(getKoskillHomeDir(customHome), 'journal.json');
}

/**
 * Resolves the centralized target path for a specific skill by identifier or name.
 *
 * @param skillName - Canonical name or folder identifier of the skill
 * @param customHome - Optional custom directory path override
 * @returns Absolute path to `~/.koskill/skills/<skillName>`
 */
export function getSkillCentralPath(skillName: string, customHome?: string): string {
  const sanitizedName = path.basename(skillName);
  return path.join(getKoskillSkillsDir(customHome), sanitizedName);
}

/**
 * Resolves the workflows storage directory inside the central store.
 *
 * @param customHome - Optional custom directory path override
 * @returns Absolute path to `~/.koskill/workflows`
 */
export function getKoskillWorkflowsDir(customHome?: string): string {
  return path.join(getKoskillHomeDir(customHome), 'workflows');
}

/**
 * Resolves the centralized target path for a specific workflow by identifier or name.
 *
 * @param workflowName - Canonical name or file name of the workflow (appends .md if missing)
 * @param customHome - Optional custom directory path override
 * @returns Absolute path to `~/.koskill/workflows/<workflowName>`
 */
export function getWorkflowCentralPath(workflowName: string, customHome?: string): string {
  const base = path.basename(workflowName);
  const fileName = base.endsWith('.md') ? base : `${base}.md`;
  return path.join(getKoskillWorkflowsDir(customHome), fileName);
}

/**
 * Result structure returned upon central store layout initialization.
 */
export interface StoreLayoutInitResult {
  homeDir: string;
  skillsDir: string;
  workflowsDir: string;
  mcpDir: string;
  journalPath: string;
}

/**
 * Idempotently initializes the `~/.koskill/` directory hierarchy with safe permissions.
 * Creates `skills/`, `workflows/`, and `mcp/` directories if they do not yet exist.
 *
 * @param customHome - Optional custom directory path override
 * @returns Details of initialized paths
 */
export async function initCentralStore(customHome?: string): Promise<StoreLayoutInitResult> {
  const homeDir = getKoskillHomeDir(customHome);
  const skillsDir = getKoskillSkillsDir(customHome);
  const workflowsDir = getKoskillWorkflowsDir(customHome);
  const mcpDir = getKoskillMcpDir(customHome);
  const journalPath = getKoskillJournalPath(customHome);

  try {
    await fs.mkdir(skillsDir, { recursive: true, mode: 0o755 });
    await fs.mkdir(workflowsDir, { recursive: true, mode: 0o755 });
    await fs.mkdir(mcpDir, { recursive: true, mode: 0o755 });

    logger.debug('Initialized central store directory layout', { homeDir, skillsDir, workflowsDir, mcpDir });

    return {
      homeDir,
      skillsDir,
      workflowsDir,
      mcpDir,
      journalPath,
    };
  } catch (error) {
    logger.error('Failed to initialize central store directories', { homeDir, error: String(error) });
    throw error;
  }
}
