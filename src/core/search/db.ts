import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { Logger } from '../logger.js';

const logger = new Logger();

export interface InitSearchDbOptions {
  allowVectorFallback?: boolean;
}

/**
 * Extended Database type tracking vector support capability.
 */
export interface SearchDatabase extends Database.Database {
  hasVectorSupport?: boolean;
}

/**
 * Resolves the canonical file path to the search index SQLite database.
 */
export function getSearchDbPath(baseDir?: string): string {
  if (baseDir) {
    return path.join(baseDir, 'cache', 'index.db');
  }
  return path.join(os.homedir(), '.koskill', 'cache', 'index.db');
}

/**
 * Initializes the SQLite search database with WAL mode, loads the sqlite-vec
 * extension, and provisions the items_meta, items_fts, and items_vec tables.
 */
export function initSearchDb(
  dbPath?: string,
  options: InitSearchDbOptions = {}
): SearchDatabase {
  const targetPath = dbPath || getSearchDbPath();
  const dir = path.dirname(targetPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(targetPath) as SearchDatabase;

  // Configure high-performance WAL journaling
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // Attempt dynamic vector extension loading
  let vectorLoaded = false;
  try {
    sqliteVec.load(db);
    vectorLoaded = true;
    db.hasVectorSupport = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to load sqlite-vec extension: ${msg}`, { dbPath: targetPath });
    if (!options.allowVectorFallback) {
      db.close();
      throw err;
    }
    db.hasVectorSupport = false;
  }

  // Provision relational metadata table
  db.exec(`
    CREATE TABLE IF NOT EXISTS items_meta (
      id TEXT PRIMARY KEY,
      item_type TEXT NOT NULL CHECK(item_type IN ('skill', 'workflow', 'mcp_tool')),
      name TEXT NOT NULL,
      command TEXT,
      ecosystem TEXT NOT NULL,
      source_path TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Provision sparse lexical search table using SQLite FTS5
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
      id UNINDEXED,
      name,
      command,
      description,
      content,
      tokenize = 'porter unicode61'
    );
  `);

  // Provision dense vector table if sqlite-vec is available
  if (vectorLoaded) {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS items_vec USING vec0(
        id TEXT PRIMARY KEY,
        embedding float[384] distance_metric=cosine
      );
    `);
  }

  return db;
}

/**
 * Checks whether the given database connection has native vector search enabled.
 */
export function isVectorSupported(db: SearchDatabase): boolean {
  if (db.hasVectorSupport !== undefined) {
    return db.hasVectorSupport;
  }
  try {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='items_vec'").get();
    return !!row;
  } catch {
    return false;
  }
}

/**
 * Safely closes the database connection if open.
 */
export function closeSearchDb(db: Database.Database): void {
  if (db && db.open) {
    db.close();
  }
}
