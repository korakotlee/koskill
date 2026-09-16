/**
 * Target ecosystem platforms supported by KoSkill.
 */
export type ConfigTarget = 'gemini' | 'claude' | 'codex';

/**
 * Synchronization lifecycle status for a skill.
 */
export type SkillStatus = 'original' | 'centralized' | 'symlinked' | 'inactive';

/**
 * Metadata definition for a registered skill in KoSkill.
 */
export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  sourcePath: string;
  targetEcosystem: ConfigTarget;
  status: SkillStatus;
  metadata?: Record<string, unknown>;
  rawContent?: string;
}

/**
 * Supported transport mechanisms for Model Context Protocol (MCP) servers.
 */
export type McpTransport = 'stdio' | 'sse';

/**
 * Configuration declaration for an MCP server instance.
 */
export interface McpServerManifest {
  id: string;
  name: string;
  transport: McpTransport;
  command: string;
  args: string[];
  env?: Record<string, string>;
  declaredToolsCount: number;
}

/**
 * Standardized result wrapper for operations across core and API services.
 */
export interface OperationResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

/**
 * Validates if an unknown input matches the SkillManifest contract.
 */
export function isValidSkillManifest(item: unknown): item is SkillManifest {
  if (!item || typeof item !== 'object') return false;
  const s = item as Partial<SkillManifest>;
  return (
    typeof s.id === 'string' && s.id.trim().length > 0 &&
    typeof s.name === 'string' && s.name.trim().length > 0 &&
    typeof s.sourcePath === 'string' &&
    ['gemini', 'claude', 'codex'].includes(s.targetEcosystem as string) &&
    ['original', 'centralized', 'symlinked', 'inactive'].includes(s.status as string)
  );
}

/**
 * Validates if an unknown input matches the McpServerManifest contract.
 */
export function isValidMcpServerManifest(item: unknown): item is McpServerManifest {
  if (!item || typeof item !== 'object') return false;
  const m = item as Partial<McpServerManifest>;
  return (
    typeof m.id === 'string' && m.id.trim().length > 0 &&
    typeof m.name === 'string' && m.name.trim().length > 0 &&
    (m.transport === 'stdio' || m.transport === 'sse') &&
    typeof m.command === 'string' &&
    Array.isArray(m.args) &&
    typeof m.declaredToolsCount === 'number'
  );
}

/**
 * Scope hierarchy for configuration items and workflows.
 */
export type WorkflowScope = 'global' | 'workspace';

/**
 * Parsed metadata for a workflow or slash command.
 */
export interface WorkflowMetadata {
  argumentHint?: string;
  allowedTools?: string[];
  model?: string;
  [key: string]: unknown;
}

/**
 * Manifest declaration for a workflow or custom slash command.
 */
export interface WorkflowManifest {
  id: string;
  name: string;
  command: string; // e.g. "/commit"
  description: string;
  sourcePath: string;
  targetEcosystem: ConfigTarget;
  scope: WorkflowScope;
  metadata?: WorkflowMetadata;
  rawContent?: string;
}

/**
 * Validates if an unknown input matches the WorkflowManifest contract.
 */
export function isValidWorkflowManifest(item: unknown): item is WorkflowManifest {
  if (!item || typeof item !== 'object') return false;
  const w = item as Partial<WorkflowManifest>;
  return (
    typeof w.id === 'string' && w.id.trim().length > 0 &&
    typeof w.name === 'string' && w.name.trim().length > 0 &&
    typeof w.command === 'string' && w.command.startsWith('/') &&
    typeof w.sourcePath === 'string' &&
    ['gemini', 'claude', 'codex'].includes(w.targetEcosystem as string) &&
    ['global', 'workspace'].includes(w.scope as string)
  );
}

