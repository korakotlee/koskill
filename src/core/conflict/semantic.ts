import { SearchDatabase, isVectorSupported } from '../search/db.js';
import {
  SearchItemType,
  SemanticDuplicateMatch,
  SemanticConflictMatch,
} from '../search/types.js';
import { LocalEmbedder, getEmbedder } from '../search/embedder.js';

export interface SemanticDuplicateOptions {
  threshold?: number;
  itemType?: SearchItemType;
}

export interface SemanticConflictOptions {
  divergenceThreshold?: number;
}

/**
 * Discovers skills or capabilities with divergent names that exhibit semantic cosine similarity
 * at or above the configured threshold (default 0.85).
 */
export async function findSemanticDuplicates(
  db: SearchDatabase,
  _embedder?: LocalEmbedder,
  options: SemanticDuplicateOptions = {}
): Promise<SemanticDuplicateMatch[]> {
  if (!isVectorSupported(db)) {
    return [];
  }

  const threshold = options.threshold ?? 0.85;
  const itemType = options.itemType ?? 'skill';

  const items = db
    .prepare('SELECT id, name FROM items_meta WHERE item_type = ?')
    .all(itemType) as { id: string; name: string }[];

  if (items.length < 2) {
    return [];
  }

  const nameMap = new Map<string, string>();
  for (const item of items) {
    nameMap.set(item.id, item.name);
  }

  const pairs = new Map<string, SemanticDuplicateMatch>();

  for (const item of items) {
    // Query nearest neighbors using native vector cosine metric
    const knnRows = db
      .prepare(`
        SELECT id, distance
        FROM items_vec
        WHERE embedding MATCH (SELECT embedding FROM items_vec WHERE id = ?) AND k = 10
      `)
      .all(item.id) as { id: string; distance: number }[];

    for (const neighbor of knnRows) {
      if (neighbor.id === item.id) continue;
      const neighborName = nameMap.get(neighbor.id);
      if (!neighborName) continue;

      // Ensure they have different names
      if (neighborName.toLowerCase() === item.name.toLowerCase()) continue;

      // In sqlite-vec cosine metric: similarity = 1 - distance
      const similarity = 1 - neighbor.distance;
      if (similarity >= threshold) {
        // Canonical pair key to prevent A-B vs B-A duplicates
        const [firstId, secondId] = [item.id, neighbor.id].sort();
        const key = `${firstId}::${secondId}`;
        if (!pairs.has(key)) {
          pairs.set(key, {
            firstId,
            firstName: nameMap.get(firstId) || firstId,
            secondId,
            secondName: nameMap.get(secondId) || secondId,
            similarity,
          });
        }
      }
    }
  }

  return Array.from(pairs.values());
}

/**
 * Identifies command collision conflicts where two or more skills or workflows share the
 * exact same trigger but provide divergent prompt instructions.
 */
export async function findSemanticConflicts(
  db: SearchDatabase,
  embedder?: LocalEmbedder,
  options: SemanticConflictOptions = {}
): Promise<SemanticConflictMatch[]> {
  if (!isVectorSupported(db)) {
    return [];
  }

  const divergenceThreshold = options.divergenceThreshold ?? 0.2;

  // Find all commands with multiple registered implementations
  const commandsWithCollisions = db
    .prepare(`
      SELECT command, count(*) as count
      FROM items_meta
      WHERE command IS NOT NULL AND command != ''
      GROUP BY command
      HAVING count > 1
    `)
    .all() as { command: string; count: number }[];

  if (commandsWithCollisions.length === 0) {
    return [];
  }

  const activeEmbedder = embedder || getEmbedder();
  const conflicts: SemanticConflictMatch[] = [];

  for (const { command } of commandsWithCollisions) {
    const items = db
      .prepare('SELECT id, name FROM items_meta WHERE command = ?')
      .all(command) as { id: string; name: string }[];

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const itemA = items[i];
        const itemB = items[j];

        // Retrieve stored embeddings
        const rowA = db.prepare('SELECT embedding FROM items_vec WHERE id = ?').get(itemA.id) as { embedding: Buffer } | undefined;
        const rowB = db.prepare('SELECT embedding FROM items_vec WHERE id = ?').get(itemB.id) as { embedding: Buffer } | undefined;

        if (rowA?.embedding && rowB?.embedding) {
          const vecA = new Float32Array(rowA.embedding.buffer, rowA.embedding.byteOffset, rowA.embedding.byteLength / 4);
          const vecB = new Float32Array(rowB.embedding.buffer, rowB.embedding.byteOffset, rowB.embedding.byteLength / 4);

          const similarity = activeEmbedder.cosineSimilarity(vecA, vecB);
          const divergence = 1 - similarity;

          if (divergence >= divergenceThreshold) {
            conflicts.push({
              command,
              firstId: itemA.id,
              firstName: itemA.name,
              secondId: itemB.id,
              secondName: itemB.name,
              similarity,
              divergence,
            });
          }
        }
      }
    }
  }

  return conflicts;
}
