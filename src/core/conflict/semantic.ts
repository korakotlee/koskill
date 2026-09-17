import { SearchDatabase, isVectorSupported } from '../search/db.js';
import {
  SearchItemType,
  SemanticDuplicateMatch,
  SemanticConflictMatch,
} from '../search/types.js';
import { LocalEmbedder, getEmbedder } from '../search/embedder.js';
import { ConflictReport, ConflictItem } from './types.js';
import { generateDiff } from './diff.js';

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

export interface DetectSemanticConflictOptions {
  duplicateThreshold?: number;
  divergenceThreshold?: number;
}

/**
 * Executes Tier 2 and Tier 3 conflict analysis using vector KNN and trigger comparisons,
 * compiling unified ConflictReport objects with diffs and similarity scores.
 */
export async function detectSemanticConflicts(
  db: SearchDatabase,
  embedder?: LocalEmbedder,
  options: DetectSemanticConflictOptions = {}
): Promise<ConflictReport[]> {
  const reports: ConflictReport[] = [];

  const getItemDetails = (id: string): ConflictItem | null => {
    const row = db
      .prepare(
        `SELECT m.id, m.name, m.ecosystem, m.source_path, m.content_hash, m.command, f.content, f.description
         FROM items_meta m
         LEFT JOIN items_fts f ON m.id = f.id
         WHERE m.id = ?`
      )
      .get(id) as {
        id: string;
        name: string;
        ecosystem: string;
        source_path: string;
        content_hash: string;
        command?: string;
        content?: string;
        description?: string;
      } | undefined;

    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      ecosystem: row.ecosystem,
      sourcePath: row.source_path,
      contentHash: row.content_hash,
      command: row.command,
      content: row.content,
      description: row.description,
    };
  };

  // 1. Tier 2: Semantic Duplicates
  const duplicates = await findSemanticDuplicates(db, embedder, {
    threshold: options.duplicateThreshold ?? 0.85,
  });

  for (const dup of duplicates) {
    const itemA = getItemDetails(dup.firstId);
    const itemB = getItemDetails(dup.secondId);
    if (!itemA || !itemB) continue;

    const diffSummary = generateDiff(itemA.content || '', itemB.content || '', {
      oldHeader: `${itemA.ecosystem}/${itemA.name}`,
      newHeader: `${itemB.ecosystem}/${itemB.name}`,
    });

    const percentMatch = Math.round(dup.similarity * 100);
    reports.push({
      id: `semantic-dup-${dup.firstId}-${dup.secondId}`,
      conflictType: 'SEMANTIC_DUPLICATE',
      severity: 'WARNING',
      title: `Semantic Duplicate: ${itemA.name} & ${itemB.name}`,
      description: `Skills "${itemA.name}" and "${itemB.name}" exhibit ${percentMatch}% semantic similarity.`,
      similarityScore: dup.similarity,
      matchedSnippet: `${percentMatch}% match`,
      items: [itemA, itemB],
      diffSummary,
    });
  }

  // 2. Tier 3: Instruction Divergence
  const divergences = await findSemanticConflicts(db, embedder, {
    divergenceThreshold: options.divergenceThreshold ?? 0.2,
  });

  for (const div of divergences) {
    const itemA = getItemDetails(div.firstId);
    const itemB = getItemDetails(div.secondId);
    if (!itemA || !itemB) continue;

    const diffSummary = generateDiff(itemA.content || '', itemB.content || '', {
      oldHeader: `${itemA.ecosystem}/${itemA.name}`,
      newHeader: `${itemB.ecosystem}/${itemB.name}`,
    });

    reports.push({
      id: `instruction-div-${div.command.replace(/^\//, '')}-${div.firstId}-${div.secondId}`,
      conflictType: 'INSTRUCTION_DIVERGENCE',
      severity: 'WARNING',
      title: `Instruction Divergence on Command: ${div.command}`,
      description: `Multiple items share command trigger "${div.command}" but present conflicting prompt directives.`,
      similarityScore: div.similarity,
      matchedSnippet: `Trigger: ${div.command}`,
      items: [itemA, itemB],
      diffSummary,
    });
  }

  return reports;
}

