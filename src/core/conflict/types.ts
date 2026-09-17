/**
 * Conflict detection and resolution domain types and schemas.
 */

export type ConflictType =
  | 'DUPLICATE_NAME'
  | 'SEMANTIC_DUPLICATE'
  | 'INSTRUCTION_DIVERGENCE'
  | 'MCP_TOOL_COLLISION'
  | 'VERSION_DRIFT';

export type ConflictSeverity = 'WARNING' | 'ERROR';

export type ResolutionAction = 'PICK' | 'ALIAS' | 'MERGE';

export interface ConflictItem {
  id: string;
  name: string;
  ecosystem: string;
  sourcePath: string;
  contentHash: string;
  command?: string;
  content?: string;
  description?: string;
  toolNames?: string[];
}

export type DiffChangeType = 'added' | 'removed' | 'unchanged';

export interface DiffLine {
  type: DiffChangeType;
  value: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffSummary {
  additions: number;
  deletions: number;
  unifiedDiff: string;
  chunks: DiffLine[];
}

export interface ConflictReport {
  id: string;
  conflictType: ConflictType;
  severity: ConflictSeverity;
  title: string;
  description: string;
  similarityScore: number | null;
  matchedSnippet: string | null;
  items: ConflictItem[];
  diffSummary?: DiffSummary;
}

export interface ResolutionPayload {
  conflictId: string;
  action: ResolutionAction;
  winnerId?: string;
  newAlias?: string;
  mergedContent?: string;
  expectedHashes?: Record<string, string>;
}

export interface ResolutionResult {
  success: boolean;
  conflictId: string;
  action: ResolutionAction;
  message: string;
  archivedPaths?: string[];
  backupPath?: string;
  updatedPaths?: string[];
}
