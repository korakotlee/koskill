import http from 'http';
import { initSearchDb, SearchDatabase } from '../../core/search/db.js';
import { HybridSearchEngine } from '../../core/search/hybrid.js';
import { IncrementalIndexer } from '../../core/search/indexer.js';
import { syncFullSearchIndex } from '../../core/search/sync.js';
import { SearchItemType } from '../../core/search/types.js';
import { defaultLogger } from '../../core/logger.js';

let sharedDb: SearchDatabase | null = null;
let sharedEngine: HybridSearchEngine | null = null;
let sharedIndexer: IncrementalIndexer | null = null;

/**
 * Initializes and retrieves cached search engine components.
 */
export function getSearchComponents(): {
  db: SearchDatabase;
  engine: HybridSearchEngine;
  indexer: IncrementalIndexer;
} {
  if (!sharedDb) {
    sharedDb = initSearchDb(undefined, { allowVectorFallback: true });
    sharedEngine = new HybridSearchEngine(sharedDb);
    sharedIndexer = new IncrementalIndexer(sharedDb);
  }
  return {
    db: sharedDb,
    engine: sharedEngine!,
    indexer: sharedIndexer!,
  };
}

/**
 * Resets search components (primarily for tests).
 */
export function resetSearchComponents(): void {
  if (sharedDb) {
    try {
      sharedDb.close();
    } catch {
      // Ignore cleanup error
    }
  }
  sharedDb = null;
  sharedEngine = null;
  sharedIndexer = null;
}

/**
 * Handles search and reindexing HTTP routes.
 */
export async function handleSearchRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<boolean> {
  // GET /api/search/query
  if (req.method === 'GET' && url.pathname === '/api/search/query') {
    const q = url.searchParams.get('q');
    if (!q || !q.trim()) {
      res.writeHead(400);
      res.end(
        JSON.stringify({
          error: 'Missing required query parameter "q"',
        })
      );
      return true;
    }

    try {
      const { engine } = getSearchComponents();
      const limitParam = url.searchParams.get('limit');
      const itemTypeParam = url.searchParams.get('itemType') as SearchItemType | null;
      const ecosystemParam = url.searchParams.get('ecosystem');

      const results = await engine.search(q.trim(), {
        limit: limitParam ? parseInt(limitParam, 10) : 10,
        itemType: itemTypeParam || undefined,
        ecosystem: ecosystemParam || undefined,
      });

      res.writeHead(200);
      res.end(
        JSON.stringify({
          query: q.trim(),
          total: results.length,
          results,
        })
      );
      return true;
    } catch (err: any) {
      defaultLogger.error('Failed to execute search query', {
        error: err.message,
        query: q,
      });
      res.writeHead(500);
      res.end(
        JSON.stringify({
          error: 'Internal Server Error',
          message: err.message,
        })
      );
      return true;
    }
  }

  // POST /api/search/reindex
  if (req.method === 'POST' && url.pathname === '/api/search/reindex') {
    try {
      const { db } = getSearchComponents();
      const stats = await syncFullSearchIndex(db);

      res.writeHead(200);
      res.end(
        JSON.stringify({
          success: true,
          stats,
        })
      );
      return true;
    } catch (err: any) {
      defaultLogger.error('Failed to reindex search items', {
        error: err.message,
      });
      res.writeHead(500);
      res.end(
        JSON.stringify({
          error: 'Internal Server Error',
          message: err.message,
        })
      );
      return true;
    }
  }

  return false;
}
