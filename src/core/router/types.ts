/**
 * Types and interfaces for the KoSkill Auto-Router & Meta-MCP Server.
 */

export type RouterActionType = 'DISCOVER' | 'INVOKE_TOOL' | 'LOAD_SKILL';

export type RouterTransactionStatus = 'SUCCESS' | 'ERROR';

export interface RouterTransaction {
  /** Unique transaction identifier */
  id: string;
  /** Unix epoch timestamp in milliseconds */
  timestamp: number;
  /** High-level action type executed by the router */
  action: RouterActionType;
  /** Natural language query string (for DISCOVER actions) */
  query?: string;
  /** Target downstream MCP server name (for INVOKE_TOOL actions) */
  targetServer?: string;
  /** Target downstream tool name (for INVOKE_TOOL actions) */
  targetTool?: string;
  /** Requested skill or workflow name (for LOAD_SKILL actions) */
  skillName?: string;
  /** Total wall-clock execution duration in milliseconds */
  durationMs: number;
  /** Execution status */
  status: RouterTransactionStatus;
  /** Estimated tokens saved compared to static registration */
  tokensSavedEstimate: number;
  /** Input parameters or arguments payload */
  payload?: Record<string, unknown>;
  /** Execution result or candidate summary */
  result?: Record<string, unknown>;
  /** Error message or stack trace if status is ERROR */
  error?: string;
}

export interface DiscoveredCapability {
  /** Capability identifier */
  id: string;
  /** Categorical item type */
  itemType: 'skill' | 'workflow' | 'mcp_tool';
  /** Human-readable capability name */
  name: string;
  /** Downstream MCP server name if itemType is mcp_tool */
  serverName?: string;
  /** Concise description for agent decision-making */
  description: string;
  /** Compact summary of input parameter schemas (< 150 tokens) */
  parametersSummary?: string;
  /** Computed search relevance score (0.0 - 1.0) */
  score: number;
  /** Estimated baseline token budget in full catalog */
  tokensBudget?: number;
}

export interface RouterMetrics {
  /** Number of currently running downstream MCP child processes */
  activeServersCount: number;
  /** Total number of recorded routing transactions */
  totalTransactions: number;
  /** Cumulative estimated token savings */
  estimatedTokensSaved: number;
}

export interface RouterLogFilterOptions {
  /** Action type filter */
  action?: RouterActionType;
  /** Text search across query, server, tool, and error fields */
  search?: string;
  /** Maximum number of records to return */
  limit?: number;
}
