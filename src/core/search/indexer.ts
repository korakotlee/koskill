import crypto from 'node:crypto';
import { SearchDatabase, isVectorSupported } from './db.js';
import { SearchItemInput, SearchItemMeta, IndexSyncStats } from './types.js';
import { LocalEmbedder, getEmbedder } from './embedder.js';
import { SkillManifest, WorkflowManifest } from '../types.js';
import { Logger } from '../logger.js';

const logger = new Logger();

/**
 * Generates a deterministic SHA-256 hash string for content invalidation.
 */
export function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content || '', 'utf8').digest('hex');
}

/**
 * Incremental synchronization service for embedding and indexing skills and workflows into SQLite.
 */
export class IncrementalIndexer {
  private db: SearchDatabase;
  private embedder: LocalEmbedder;

  constructor(db: SearchDatabase, embedder?: LocalEmbedder) {
    this.db = db;
    this.embedder = embedder || getEmbedder();
  }

  /**
   * Synchronizes a single item, checking CAS content hash to avoid unnecessary re-embedding.
   */
  public async indexItem(item: SearchItemInput): Promise<'indexed' | 'updated' | 'skipped'> {
    // 1. Check existing hash
    const existing = this.db
      .prepare('SELECT content_hash FROM items_meta WHERE id = ?')
      .get(item.id) as { content_hash: string } | undefined;

    if (existing && existing.content_hash === item.contentHash) {
      return 'skipped';
    }

    // 2. Generate vector embedding if vector is supported and not already provided
    let embedding = item.embedding;
    const vectorEnabled = isVectorSupported(this.db);

    if (vectorEnabled && !embedding) {
      const textToEmbed = [
        item.name,
        item.command ? `Trigger: ${item.command}` : '',
        item.description || '',
        item.content || '',
      ]
        .filter(Boolean)
        .join('\n');

      try {
        embedding = await this.embedder.embed(textToEmbed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`Failed to generate vector embedding for ${item.id}: ${msg}`);
      }
    }

    // 3. Atomically upsert metadata, FTS, and vector records
    const isUpdate = !!existing;
    const now = Date.now();

    this.db.transaction(() => {
      // Upsert metadata
      this.db
        .prepare(`
          INSERT INTO items_meta (id, item_type, name, command, ecosystem, source_path, content_hash, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            item_type = excluded.item_type,
            name = excluded.name,
            command = excluded.command,
            ecosystem = excluded.ecosystem,
            source_path = excluded.source_path,
            content_hash = excluded.content_hash,
            updated_at = excluded.updated_at
        `)
        .run(
          item.id,
          item.itemType,
          item.name,
          item.command || null,
          item.ecosystem,
          item.sourcePath,
          item.contentHash,
          now
        );

      // Upsert FTS5 record
      this.db.prepare('DELETE FROM items_fts WHERE id = ?').run(item.id);
      this.db
        .prepare(`
          INSERT INTO items_fts (id, name, command, description, content)
          VALUES (?, ?, ?, ?, ?)
        `)
        .run(
          item.id,
          item.name,
          item.command || null,
          item.description || '',
          item.content || ''
        );

      // Upsert vector record if supported and available
      if (vectorEnabled && embedding) {
        this.db.prepare('DELETE FROM items_vec WHERE id = ?').run(item.id);
        this.db
          .prepare('INSERT INTO items_vec (id, embedding) VALUES (?, ?)')
          .run(item.id, embedding);
      }
    })();

    return isUpdate ? 'updated' : 'indexed';
  }

  /**
   * Synchronizes a batch of generic SearchItemInput objects.
   */
  public async indexBatch(items: SearchItemInput[]): Promise<IndexSyncStats> {
    const stats: IndexSyncStats = {
      indexed: 0,
      updated: 0,
      skipped: 0,
      deleted: 0,
      total: items.length,
    };

    for (const item of items) {
      const status = await this.indexItem(item);
      stats[status]++;
    }

    return stats;
  }

  /**
   * Transforms and indexes an array of SkillManifest definitions.
   */
  public async indexSkills(skills: SkillManifest[]): Promise<IndexSyncStats> {
    const inputs: SearchItemInput[] = skills.map((s) => ({
      id: `skill:${s.id}`,
      itemType: 'skill',
      name: s.name,
      command: (s.metadata?.command as string) || null,
      ecosystem: s.targetEcosystem,
      sourcePath: s.sourcePath,
      contentHash: computeContentHash(s.rawContent || `${s.name}\n${s.description}`),
      description: s.description,
      content: s.rawContent,
    }));

    return this.indexBatch(inputs);
  }

  /**
   * Transforms and indexes an array of WorkflowManifest definitions.
   */
  public async indexWorkflows(workflows: WorkflowManifest[]): Promise<IndexSyncStats> {
    const inputs: SearchItemInput[] = workflows.map((w) => ({
      id: `workflow:${w.id}`,
      itemType: 'workflow',
      name: w.name,
      command: w.command,
      ecosystem: w.targetEcosystem,
      sourcePath: w.sourcePath,
      contentHash: computeContentHash(w.rawContent || `${w.name}\n${w.command}\n${w.description}`),
      description: w.description,
      content: w.rawContent,
    }));

    return this.indexBatch(inputs);
  }

  /**
   * Removes items from all search tables that are no longer present in active scanned manifests.
   */
  public pruneStale(activeIds: string[]): number {
    if (activeIds.length === 0) {
      const total = this.getItemCount();
      this.db.transaction(() => {
        this.db.exec('DELETE FROM items_meta;');
        this.db.exec('DELETE FROM items_fts;');
        if (isVectorSupported(this.db)) {
          this.db.exec('DELETE FROM items_vec;');
        }
      })();
      return total;
    }

    const placeholders = activeIds.map(() => '?').join(',');
    const staleRows = this.db
      .prepare(`SELECT id FROM items_meta WHERE id NOT IN (${placeholders})`)
      .all(...activeIds) as { id: string }[];

    if (staleRows.length === 0) {
      return 0;
    }

    const deleteIds = staleRows.map((r) => r.id);
    this.db.transaction(() => {
      const deletePlaceholders = deleteIds.map(() => '?').join(',');
      this.db.prepare(`DELETE FROM items_meta WHERE id IN (${deletePlaceholders})`).run(...deleteIds);
      this.db.prepare(`DELETE FROM items_fts WHERE id IN (${deletePlaceholders})`).run(...deleteIds);
      if (isVectorSupported(this.db)) {
        this.db.prepare(`DELETE FROM items_vec WHERE id IN (${deletePlaceholders})`).run(...deleteIds);
      }
    })();

    return deleteIds.length;
  }

  /**
   * Returns total count of indexed items.
   */
  public getItemCount(): number {
    const row = this.db.prepare('SELECT count(*) as count FROM items_meta').get() as { count: number };
    return row ? row.count : 0;
  }

  /**
   * Retrieves single item metadata by ID.
   */
  public getItem(id: string): SearchItemMeta | null {
    const row = this.db.prepare('SELECT * FROM items_meta WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      itemType: row.item_type as 'skill' | 'workflow' | 'mcp_tool',
      name: row.name as string,
      command: (row.command as string) || null,
      ecosystem: row.ecosystem as string,
      sourcePath: row.source_path as string,
      contentHash: row.content_hash as string,
      updatedAt: row.updated_at as number,
    };
  }
}
