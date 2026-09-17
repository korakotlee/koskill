import http from 'http';
import { scanAllInventory } from '../../core/scanner/index.js';
import { detectTier1Conflicts } from '../../core/conflict/detector.js';
import { detectSemanticConflicts } from '../../core/conflict/semantic.js';
import { ConflictResolver } from '../../core/conflict/resolver.js';
import { ResolutionPayload, ConflictReport } from '../../core/conflict/types.js';
import { getSearchComponents } from './search.js';
import { defaultLogger } from '../../core/logger.js';

let sharedResolver: ConflictResolver | null = null;

/**
 * Returns the singleton ConflictResolver instance.
 */
export function getConflictResolver(): ConflictResolver {
  if (!sharedResolver) {
    sharedResolver = new ConflictResolver();
  }
  return sharedResolver;
}

/**
 * Handles conflict detection and resolution HTTP endpoints.
 */
export async function handleConflictRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<boolean> {
  // GET /api/conflicts
  if (req.method === 'GET' && url.pathname === '/api/conflicts') {
    try {
      const inventory = await scanAllInventory();
      const skills = inventory.skills || [];
      const mcpServers = inventory.mcpServers || [];

      // 1. Tier 1 exact collisions and MCP tool collisions
      const tier1Reports = detectTier1Conflicts(skills, mcpServers);

      // 2. Tier 2 and Tier 3 semantic and prompt conflicts
      let semanticReports: ConflictReport[] = [];
      try {
        const { db } = getSearchComponents();
        semanticReports = await detectSemanticConflicts(db);
      } catch (err: any) {
        defaultLogger.warn('Semantic conflict detection skipped or failed', { error: err.message });
      }

      // Combine reports avoiding duplicate IDs
      const seenIds = new Set<string>();
      const combined: ConflictReport[] = [];
      for (const rep of [...tier1Reports, ...semanticReports]) {
        if (!seenIds.has(rep.id)) {
          seenIds.add(rep.id);
          combined.push(rep);
        }
      }

      res.writeHead(200);
      res.end(
        JSON.stringify({
          success: true,
          count: combined.length,
          conflicts: combined,
        })
      );
      return true;
    } catch (err: any) {
      defaultLogger.error('Failed to analyze conflicts', { error: err.message });
      res.writeHead(500);
      res.end(
        JSON.stringify({
          success: false,
          error: err.message || 'Internal Server Error',
        })
      );
      return true;
    }
  }

  // POST /api/conflicts/resolve
  if (req.method === 'POST' && url.pathname === '/api/conflicts/resolve') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    return new Promise<boolean>((resolve) => {
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}') as ResolutionPayload & { items?: any[] };
          if (!payload.conflictId || !payload.action) {
            res.writeHead(400);
            res.end(
              JSON.stringify({
                success: false,
                error: 'Missing conflictId or action in request payload',
              })
            );
            return resolve(true);
          }

          const resolver = getConflictResolver();
          const result = await resolver.resolve(payload, payload.items || []);

          if (!result.success) {
            const isStale = result.message.includes('E_STALE_HASH');
            res.writeHead(isStale ? 409 : 400);
            res.end(
              JSON.stringify({
                success: false,
                error: result.message,
              })
            );
            return resolve(true);
          }

          res.writeHead(200);
          res.end(JSON.stringify(result));
          resolve(true);
        } catch (err: any) {
          defaultLogger.error('Failed to resolve conflict', { error: err.message });
          res.writeHead(500);
          res.end(
            JSON.stringify({
              success: false,
              error: err.message || 'Internal Server Error',
            })
          );
          resolve(true);
        }
      });
    });
  }

  return false;
}
