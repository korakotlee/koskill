/**
 * Domain types and schema contracts for the KoSkill hybrid search engine.
 */

export type SearchItemType = 'skill' | 'workflow' | 'mcp_tool';

/**
 * Metadata record persisted in the relational `items_meta` table.
 */
export interface SearchItemMeta {
  id: string;
  itemType: SearchItemType;
  name: string;
  command?: string | null;
  ecosystem: string;
  sourcePath: string;
  contentHash: string;
  updatedAt: number;
}

/**
 * Raw input payload provided to the incremental indexer.
 */
export interface SearchItemInput {
  id: string;
  itemType: SearchItemType;
  name: string;
  command?: string | null;
  ecosystem: string;
  sourcePath: string;
  contentHash: string;
  description?: string;
  content?: string;
  embedding?: Float32Array;
}

/**
 * Scored search result item returned from hybrid or lexical queries.
 */
export interface SearchResult {
  id: string;
  itemType: SearchItemType;
  name: string;
  command?: string | null;
  description?: string;
  ecosystem: string;
  sourcePath: string;
  score: number;
  vectorRank?: number;
  bm25Rank?: number;
  distance?: number;
}

/**
 * Query filter and scoring customization options.
 */
export interface SearchOptions {
  limit?: number;
  itemType?: SearchItemType;
  ecosystem?: string;
  minScore?: number;
}

/**
 * Detected semantic duplicate match between two skills.
 */
export interface SemanticDuplicateMatch {
  firstId: string;
  firstName: string;
  secondId: string;
  secondName: string;
  similarity: number;
}

/**
 * Detected prompt conflict between items sharing identical triggers.
 */
export interface SemanticConflictMatch {
  command: string;
  firstId: string;
  firstName: string;
  secondId: string;
  secondName: string;
  similarity: number;
  divergence: number;
}

/**
 * Execution metrics returned by incremental index synchronization.
 */
export interface IndexSyncStats {
  indexed: number;
  updated: number;
  skipped: number;
  deleted: number;
  total: number;
}
