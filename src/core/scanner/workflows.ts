import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { WorkflowManifest, WorkflowScope, WorkflowMetadata } from '../types.js';
import { defaultLogger } from '../logger.js';

/**
 * Options for configuring workflow discovery paths.
 */
export interface WorkflowScanOptions {
  geminiGlobalDirs?: string[];
  geminiWorkspaceDirs?: string[];
  claudeGlobalDirs?: string[];
  claudeWorkspaceDirs?: string[];
}

/**
 * Parses frontmatter key-value pairs and array attributes from markdown content.
 */
export function extractWorkflowFrontmatter(content: string): {
  attributes: Record<string, string>;
  metadata: WorkflowMetadata;
  body: string;
} {
  const attributes: Record<string, string> = {};
  const metadata: WorkflowMetadata = {};

  if (!content.startsWith('---')) {
    return { attributes, metadata, body: content };
  }

  const endIdx = content.indexOf('\n---', 3);
  if (endIdx === -1) {
    return { attributes, metadata, body: content };
  }

  const header = content.slice(3, endIdx).trim();
  const body = content.slice(endIdx + 4).trim();

  const lines = header.split('\n');
  let currentArrayKey: string | null = null;
  const arrayCollector: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check list item
    if (trimmed.startsWith('- ') && currentArrayKey) {
      arrayCollector.push(trimmed.slice(2).trim().replace(/^['"]|['"]$/g, ''));
      continue;
    }

    if (currentArrayKey && arrayCollector.length > 0) {
      if (currentArrayKey === 'tools') {
        metadata.allowedTools = [...arrayCollector];
      }
      currentArrayKey = null;
      arrayCollector.length = 0;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();

      if (!value) {
        // Potentially an array starts on subsequent lines
        currentArrayKey = key;
        continue;
      }

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      attributes[key] = value;
      if (key === 'description') {
        attributes.description = value;
      } else if (key === 'argument-hint' || key === 'argumentHint') {
        metadata.argumentHint = value;
      } else if (key === 'model') {
        metadata.model = value;
      }
    }
  }

  if (currentArrayKey && arrayCollector.length > 0) {
    if (currentArrayKey === 'tools') {
      metadata.allowedTools = [...arrayCollector];
    }
  }

  return { attributes, metadata, body };
}

/**
 * Extracts a fallback description from markdown body.
 */
function extractFallbackDescription(body: string): string {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  const nonHeading = lines.find((l) => !l.startsWith('#'));
  if (nonHeading) return nonHeading;
  return lines[0] ? lines[0].replace(/^#+\s*/, '').trim() : '';
}

/**
 * Scans a directory for Gemini workflow markdown files.
 *
 * @param directory Target directory path
 * @param scope Global or workspace scope
 */
export async function scanGeminiWorkflows(
  directory: string,
  scope: WorkflowScope
): Promise<WorkflowManifest[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const workflows: WorkflowManifest[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

      const filePath = path.join(directory, entry.name);
      try {
        const rawContent = await fs.readFile(filePath, 'utf-8');
        const { attributes, metadata, body } = extractWorkflowFrontmatter(rawContent);

        const baseName = entry.name.replace(/\.md$/, '');
        const name = attributes.name || baseName;
        const description = attributes.description || extractFallbackDescription(body);
        const command = `/${name}`;

        workflows.push({
          id: `gemini:${name}`,
          name,
          command,
          description,
          sourcePath: filePath,
          targetEcosystem: 'gemini',
          scope,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          rawContent
        });
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          defaultLogger.warn(`Failed to parse Gemini workflow at ${filePath}`, { error: err.message });
        }
      }
    }

    return workflows;
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      defaultLogger.warn(`Failed to read Gemini workflows from ${directory}`, { error: err.message });
    }
    return [];
  }
}

/**
 * Scans a directory for Claude custom commands.
 *
 * @param directory Target directory path
 * @param scope Global or workspace scope
 */
export async function scanClaudeCommands(
  directory: string,
  scope: WorkflowScope
): Promise<WorkflowManifest[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const workflows: WorkflowManifest[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

      const filePath = path.join(directory, entry.name);
      try {
        const rawContent = await fs.readFile(filePath, 'utf-8');
        const { attributes, metadata, body } = extractWorkflowFrontmatter(rawContent);

        const baseName = entry.name.replace(/\.md$/, '');
        const name = attributes.name || baseName;
        const description = attributes.description || extractFallbackDescription(body);
        const command = `/${name}`;

        workflows.push({
          id: `claude:${name}`,
          name,
          command,
          description,
          sourcePath: filePath,
          targetEcosystem: 'claude',
          scope,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          rawContent
        });
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          defaultLogger.warn(`Failed to parse Claude command at ${filePath}`, { error: err.message });
        }
      }
    }

    return workflows;
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      defaultLogger.warn(`Failed to read Claude commands from ${directory}`, { error: err.message });
    }
    return [];
  }
}

/**
 * Default directory paths for Gemini and Claude workflows across machine and workspace.
 */
export function getDefaultWorkflowPaths(): Required<WorkflowScanOptions> {
  const homeDir = os.homedir();
  const cwd = process.cwd();

  return {
    geminiGlobalDirs: [
      path.join(homeDir, '.gemini/config/global_workflows')
    ],
    geminiWorkspaceDirs: [
      path.join(cwd, '.agent/workflows'),
      path.join(cwd, '.agents/workflows')
    ],
    claudeGlobalDirs: [
      path.join(homeDir, '.claude/commands')
    ],
    claudeWorkspaceDirs: [
      path.join(cwd, '.claude/commands')
    ]
  };
}

/**
 * Scans all workflow sources across Gemini CLI and Claude Code environments.
 *
 * @param options Optional custom directory paths for workflows
 */
export async function scanWorkflows(options?: WorkflowScanOptions): Promise<WorkflowManifest[]> {
  const defaults = getDefaultWorkflowPaths();
  const geminiGlobalDirs = options?.geminiGlobalDirs ?? defaults.geminiGlobalDirs;
  const geminiWorkspaceDirs = options?.geminiWorkspaceDirs ?? defaults.geminiWorkspaceDirs;
  const claudeGlobalDirs = options?.claudeGlobalDirs ?? defaults.claudeGlobalDirs;
  const claudeWorkspaceDirs = options?.claudeWorkspaceDirs ?? defaults.claudeWorkspaceDirs;

  const tasks: Promise<WorkflowManifest[]>[] = [
    ...geminiGlobalDirs.map((dir) => scanGeminiWorkflows(dir, 'global')),
    ...geminiWorkspaceDirs.map((dir) => scanGeminiWorkflows(dir, 'workspace')),
    ...claudeGlobalDirs.map((dir) => scanClaudeCommands(dir, 'global')),
    ...claudeWorkspaceDirs.map((dir) => scanClaudeCommands(dir, 'workspace'))
  ];

  const settled = await Promise.allSettled(tasks);
  const workflowMap = new Map<string, WorkflowManifest>();

  for (const res of settled) {
    if (res.status === 'fulfilled') {
      for (const item of res.value) {
        workflowMap.set(item.id, item);
      }
    } else {
      defaultLogger.warn('A workflow scanner task failed', { error: res.reason });
    }
  }

  return Array.from(workflowMap.values());
}
