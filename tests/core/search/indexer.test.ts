/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { initSearchDb, closeSearchDb, SearchDatabase } from '../../../src/core/search/db.js';
import { IncrementalIndexer, computeContentHash } from '../../../src/core/search/indexer.js';
import { LocalEmbedder } from '../../../src/core/search/embedder.js';
import { SkillManifest, WorkflowManifest } from '../../../src/core/types.js';

describe('Incremental Search Indexer', () => {
  let testTempDir: string;
  let dbPath: string;
  let db: SearchDatabase;
  let indexer: IncrementalIndexer;
  let embedder: LocalEmbedder;

  beforeEach(async () => {
    testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-indexer-test-'));
    dbPath = path.join(testTempDir, 'cache', 'index.db');
    db = initSearchDb(dbPath);
    embedder = new LocalEmbedder();
    indexer = new IncrementalIndexer(db, embedder);
  });

  afterEach(async () => {
    closeSearchDb(db);
    await fs.rm(testTempDir, { recursive: true, force: true });
  });

  it('computes consistent SHA-256 content hashes', () => {
    const hash1 = computeContentHash('Sample skill instructions');
    const hash2 = computeContentHash('Sample skill instructions');
    const hash3 = computeContentHash('Different skill instructions');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1.length).toBe(64);
  });

  it('indexes a new item into metadata, vector, and FTS tables', async () => {
    const raw = '# Weather Skill\nGet forecast for a city.';
    const hash = computeContentHash(raw);

    const status = await indexer.indexItem({
      id: 'skill:weather',
      itemType: 'skill',
      name: 'Weather Skill',
      command: 'weather',
      ecosystem: 'gemini',
      sourcePath: '/path/to/weather',
      contentHash: hash,
      description: 'Get weather forecast',
      content: raw,
    });

    expect(status).toBe('indexed');

    const meta = db.prepare('SELECT * FROM items_meta WHERE id = ?').get('skill:weather') as { name: string; content_hash: string };
    expect(meta.name).toBe('Weather Skill');
    expect(meta.content_hash).toBe(hash);

    const fts = db.prepare('SELECT id FROM items_fts WHERE items_fts MATCH ?').all('forecast') as { id: string }[];
    expect(fts.length).toBe(1);
    expect(fts[0].id).toBe('skill:weather');

    const count = db.prepare('SELECT count(*) as count FROM items_vec WHERE id = ?').get('skill:weather') as { count: number };
    expect(count.count).toBe(1);
  });

  it('skips unchanged items based on CAS content hash check', async () => {
    const raw = 'Stable documentation content';
    const hash = computeContentHash(raw);

    const first = await indexer.indexItem({
      id: 'skill:stable',
      itemType: 'skill',
      name: 'Stable Skill',
      ecosystem: 'claude',
      sourcePath: '/path/stable',
      contentHash: hash,
      description: 'Stable',
      content: raw,
    });
    expect(first).toBe('indexed');

    // Second call with same hash
    const second = await indexer.indexItem({
      id: 'skill:stable',
      itemType: 'skill',
      name: 'Stable Skill',
      ecosystem: 'claude',
      sourcePath: '/path/stable',
      contentHash: hash,
      description: 'Stable',
      content: raw,
    });
    expect(second).toBe('skipped');
  });

  it('updates records atomically when content hash changes', async () => {
    const v1 = 'Version 1 instructions';
    await indexer.indexItem({
      id: 'skill:updatable',
      itemType: 'skill',
      name: 'Updatable Skill',
      ecosystem: 'gemini',
      sourcePath: '/path/updatable',
      contentHash: computeContentHash(v1),
      description: 'Version 1',
      content: v1,
    });

    const v2 = 'Version 2 updated guidance for deployment';
    const updateStatus = await indexer.indexItem({
      id: 'skill:updatable',
      itemType: 'skill',
      name: 'Updatable Skill V2',
      ecosystem: 'gemini',
      sourcePath: '/path/updatable',
      contentHash: computeContentHash(v2),
      description: 'Version 2 updated',
      content: v2,
    });

    expect(updateStatus).toBe('updated');

    const meta = db.prepare('SELECT name FROM items_meta WHERE id = ?').get('skill:updatable') as { name: string };
    expect(meta.name).toBe('Updatable Skill V2');

    const fts = db.prepare('SELECT id FROM items_fts WHERE items_fts MATCH ?').all('deployment') as { id: string }[];
    expect(fts.length).toBe(1);
    expect(fts[0].id).toBe('skill:updatable');
  });

  it('indexes skill and workflow manifests cleanly via batch methods', async () => {
    const skills: SkillManifest[] = [
      {
        id: 'git-commit',
        name: 'Git Commit',
        description: 'Auto commit with conventional standards',
        sourcePath: '/skills/commit',
        targetEcosystem: 'gemini',
        status: 'original',
        rawContent: '# Git Commit\nFormats conventional commits.',
      },
    ];

    const workflows: WorkflowManifest[] = [
      {
        id: 'deploy-prod',
        name: 'Deploy Production',
        command: '/deploy',
        description: 'Deploys current build to production',
        sourcePath: '/workflows/deploy.md',
        targetEcosystem: 'claude',
        scope: 'workspace',
        rawContent: 'Instructions for production deploy',
      },
    ];

    const skillStats = await indexer.indexSkills(skills);
    expect(skillStats.indexed).toBe(1);
    expect(skillStats.total).toBe(1);

    const workflowStats = await indexer.indexWorkflows(workflows);
    expect(workflowStats.indexed).toBe(1);
    expect(workflowStats.total).toBe(1);

    expect(indexer.getItemCount()).toBe(2);
  });

  it('prunes deleted items no longer in active manifests', async () => {
    await indexer.indexItem({
      id: 'skill:alive',
      itemType: 'skill',
      name: 'Alive',
      ecosystem: 'gemini',
      sourcePath: '/alive',
      contentHash: computeContentHash('alive'),
      content: 'alive',
    });

    await indexer.indexItem({
      id: 'skill:dead',
      itemType: 'skill',
      name: 'Dead',
      ecosystem: 'gemini',
      sourcePath: '/dead',
      contentHash: computeContentHash('dead'),
      content: 'dead',
    });

    expect(indexer.getItemCount()).toBe(2);

    const deleted = indexer.pruneStale(['skill:alive']);
    expect(deleted).toBe(1);
    expect(indexer.getItemCount()).toBe(1);

    const dead = db.prepare('SELECT id FROM items_meta WHERE id = ?').get('skill:dead');
    expect(dead).toBeUndefined();
  });
});
