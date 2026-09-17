import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  getSearchDbPath,
  initSearchDb,
  closeSearchDb,
} from '../../../src/core/search/db.js';

describe('Search Database and Extension Infrastructure', () => {
  let testTempDir: string;
  let dbPath: string;

  beforeEach(async () => {
    testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-search-test-'));
    dbPath = path.join(testTempDir, 'cache', 'index.db');
  });

  afterEach(async () => {
    await fs.rm(testTempDir, { recursive: true, force: true });
  });

  it('resolves default search db path under ~/.koskill/cache/index.db', () => {
    const resolved = getSearchDbPath(testTempDir);
    expect(resolved).toBe(path.join(testTempDir, 'cache', 'index.db'));
  });

  it('initializes sqlite database with WAL mode and creates required tables', () => {
    const db = initSearchDb(dbPath);
    try {
      // Check WAL mode
      const journalMode = db.prepare('PRAGMA journal_mode').pluck().get();
      expect(String(journalMode).toLowerCase()).toBe('wal');

      // Verify sqlite-vec is loaded
      const vecVersion = db.prepare('SELECT vec_version()').pluck().get();
      expect(typeof vecVersion).toBe('string');

      // Verify items_meta table exists
      const metaTable = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='items_meta'"
      ).get();
      expect(metaTable).toBeDefined();

      // Verify items_fts table exists
      const ftsTable = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='items_fts'"
      ).get();
      expect(ftsTable).toBeDefined();

      // Verify items_vec table exists
      const vecTable = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='items_vec'"
      ).get();
      expect(vecTable).toBeDefined();
    } finally {
      closeSearchDb(db);
    }
  });

  it('supports inserting and querying relational metadata, dense vector, and FTS tables', () => {
    const db = initSearchDb(dbPath);
    try {
      const dummyVector = new Float32Array(384).fill(0.05);

      db.transaction(() => {
        db.prepare(`
          INSERT INTO items_meta (id, item_type, name, command, ecosystem, source_path, content_hash, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run('skill:search-helper', 'skill', 'Search Helper', 'search', 'gemini', '/path/to/skill', 'hash123', Date.now());

        db.prepare(`
          INSERT INTO items_vec (id, embedding)
          VALUES (?, ?)
        `).run('skill:search-helper', dummyVector);

        db.prepare(`
          INSERT INTO items_fts (id, name, command, description, content)
          VALUES (?, ?, ?, ?, ?)
        `).run('skill:search-helper', 'Search Helper', 'search', 'A fast search tool', 'Full content text');
      })();

      const meta = db.prepare('SELECT * FROM items_meta WHERE id = ?').get('skill:search-helper') as { name: string };
      expect(meta.name).toBe('Search Helper');

      const fts = db.prepare('SELECT id FROM items_fts WHERE items_fts MATCH ?').all('search') as { id: string }[];
      expect(fts.length).toBeGreaterThan(0);
      expect(fts[0].id).toBe('skill:search-helper');

      const knn = db.prepare(`
        SELECT id, distance
        FROM items_vec
        WHERE embedding MATCH ? AND k = 1
      `).all(dummyVector) as { id: string; distance: number }[];
      expect(knn.length).toBe(1);
      expect(knn[0].id).toBe('skill:search-helper');
    } finally {
      closeSearchDb(db);
    }
  });

  it('is idempotent when initializing an existing database file', () => {
    const db1 = initSearchDb(dbPath);
    db1.prepare(`
      INSERT INTO items_meta (id, item_type, name, command, ecosystem, source_path, content_hash, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('skill:1', 'skill', 'Skill 1', null, 'gemini', '/path/1', 'h1', Date.now());
    closeSearchDb(db1);

    const db2 = initSearchDb(dbPath);
    try {
      const row = db2.prepare('SELECT id FROM items_meta WHERE id = ?').get('skill:1') as { id: string };
      expect(row.id).toBe('skill:1');
    } finally {
      closeSearchDb(db2);
    }
  });
});
