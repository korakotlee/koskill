import { SearchDatabase, isVectorSupported } from './db.js';
import { SearchResult, SearchOptions, SearchItemMeta } from './types.js';
import { LocalEmbedder, getEmbedder } from './embedder.js';
import { Logger } from '../logger.js';

const logger = new Logger();

export interface HybridEngineOptions {
  disableVector?: boolean;
  rrfK?: number;
}

/**
 * Calculates Reciprocal Rank Fusion (RRF) score from vector and BM25 rank positions.
 */
export function calculateRrfScore(
  vecRank?: number,
  bm25Rank?: number,
  k: number = 60
): number {
  let score = 0;
  if (vecRank !== undefined && vecRank > 0) {
    score += 1 / (k + vecRank);
  }
  if (bm25Rank !== undefined && bm25Rank > 0) {
    score += 1 / (k + bm25Rank);
  }
  return score;
}

/**
 * Sanitizes input string into a safe SQLite FTS5 query with prefix matching.
 */
export function sanitizeFtsQuery(rawQuery: string): string {
  const tokens = rawQuery
    .replace(/[^\p{L}\p{N}_]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return '""';
  }

  // Join with OR and prefix wildcards
  return tokens.map((t) => `"${t}"*`).join(' OR ');
}

/**
 * Hybrid search engine combining dense vector embeddings and SQLite FTS5 BM25.
 */
export class HybridSearchEngine {
  private db: SearchDatabase;
  private embedder: LocalEmbedder;
  private disableVector: boolean;
  private rrfK: number;

  constructor(
    db: SearchDatabase,
    embedder?: LocalEmbedder,
    options: HybridEngineOptions = {}
  ) {
    this.db = db;
    this.embedder = embedder || getEmbedder();
    this.disableVector = options.disableVector ?? false;
    this.rrfK = options.rrfK ?? 60;
  }

  /**
   * Executes hybrid search using vector similarity and BM25 lexical ranking.
   */
  public async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const limit = options.limit ?? 10;
    const fetchLimit = limit * 3;
    const vectorUsable = !this.disableVector && isVectorSupported(this.db);

    // 1. Run FTS5 BM25 search
    const ftsRanks = new Map<string, number>();
    const sanitizedFts = sanitizeFtsQuery(query);

    if (sanitizedFts !== '""') {
      try {
        const ftsRows = this.db
          .prepare(`
            SELECT id, rank
            FROM items_fts
            WHERE items_fts MATCH ?
            ORDER BY rank
            LIMIT ?
          `)
          .all(sanitizedFts, fetchLimit) as { id: string; rank: number }[];

        ftsRows.forEach((row, idx) => {
          ftsRanks.set(row.id, idx + 1);
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`FTS query failed: ${msg}`);
      }
    }

    // 2. Run Dense Vector search if available
    const vecRanks = new Map<string, { rank: number; distance: number }>();
    if (vectorUsable) {
      try {
        const queryVector = await this.embedder.embed(query);
        const vecRows = this.db
          .prepare(`
            SELECT id, distance
            FROM items_vec
            WHERE embedding MATCH ? AND k = ?
          `)
          .all(queryVector, fetchLimit) as { id: string; distance: number }[];

        vecRows.forEach((row, idx) => {
          vecRanks.set(row.id, { rank: idx + 1, distance: row.distance });
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`Vector query failed, falling back to lexical: ${msg}`);
      }
    }

    // 3. Collect all unique candidate IDs
    const candidateIds = new Set<string>([
      ...ftsRanks.keys(),
      ...vecRanks.keys(),
    ]);

    if (candidateIds.size === 0) {
      return [];
    }

    // 4. Batch query metadata
    const placeholders = Array.from(candidateIds).map(() => '?').join(',');
    const metaRows = this.db
      .prepare(`SELECT * FROM items_meta WHERE id IN (${placeholders})`)
      .all(...Array.from(candidateIds)) as Record<string, unknown>[];

    const metaMap = new Map<string, SearchItemMeta>();
    for (const r of metaRows) {
      metaMap.set(r.id as string, {
        id: r.id as string,
        itemType: r.item_type as 'skill' | 'workflow' | 'mcp_tool',
        name: r.name as string,
        command: (r.command as string) || null,
        ecosystem: r.ecosystem as string,
        sourcePath: r.source_path as string,
        contentHash: r.content_hash as string,
        updatedAt: r.updated_at as number,
      });
    }

    // 5. Score with RRF and apply filters
    const results: SearchResult[] = [];
    for (const id of candidateIds) {
      const meta = metaMap.get(id);
      if (!meta) continue;

      if (options.itemType && meta.itemType !== options.itemType) {
        continue;
      }
      if (options.ecosystem && meta.ecosystem !== options.ecosystem) {
        continue;
      }

      const vInfo = vecRanks.get(id);
      const vecRank = vInfo?.rank;
      const bm25Rank = ftsRanks.get(id);
      const score = calculateRrfScore(vecRank, bm25Rank, this.rrfK);

      if (options.minScore && score < options.minScore) {
        continue;
      }

      results.push({
        id: meta.id,
        itemType: meta.itemType,
        name: meta.name,
        command: meta.command,
        ecosystem: meta.ecosystem,
        sourcePath: meta.sourcePath,
        score,
        vectorRank: vecRank,
        bm25Rank,
        distance: vInfo?.distance,
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }
}

/**
 * Routes user queries to top-K ranked skills and workflows.
 */
export async function routeCapabilities(
  engineOrDb: HybridSearchEngine | SearchDatabase,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const engine =
    engineOrDb instanceof HybridSearchEngine
      ? engineOrDb
      : new HybridSearchEngine(engineOrDb);

  return engine.search(query, options);
}
