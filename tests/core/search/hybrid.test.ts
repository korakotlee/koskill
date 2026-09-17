/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { initSearchDb, closeSearchDb, SearchDatabase } from '../../../src/core/search/db.js';
import { IncrementalIndexer } from '../../../src/core/search/indexer.js';
import { LocalEmbedder } from '../../../src/core/search/embedder.js';
import {
  HybridSearchEngine,
  calculateRrfScore,
} from '../../../src/core/search/hybrid.js';

describe('Hybrid Search Engine and RRF Scoring', () => {
  let testTempDir: string;
  let dbPath: string;
  let db: SearchDatabase;
  let embedder: LocalEmbedder;
  let indexer: IncrementalIndexer;
  let engine: HybridSearchEngine;

  beforeEach(async () => {
    testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-hybrid-test-'));
    dbPath = path.join(testTempDir, 'cache', 'index.db');
    db = initSearchDb(dbPath);
    embedder = new LocalEmbedder();
    indexer = new IncrementalIndexer(db, embedder);
    engine = new HybridSearchEngine(db, embedder);

    // Seed test items
    await indexer.indexItem({
      id: 'skill:meteorology',
      itemType: 'skill',
      name: 'Meteorology Advisor',
      command: 'forecast',
      ecosystem: 'gemini',
      sourcePath: '/skills/meteorology',
      contentHash: 'hash-met',
      description: 'Predict rain, humidity, temperature, and atmospheric conditions',
      content: 'Atmospheric analysis and rain forecasting guidance',
    });

    await indexer.indexItem({
      id: 'skill:git-helper',
      itemType: 'skill',
      name: 'Git Workflow Assistant',
      command: 'git',
      ecosystem: 'gemini',
      sourcePath: '/skills/git-helper',
      contentHash: 'hash-git',
      description: 'Interactive rebase, squash commits, and format conventional changelog',
      content: 'Git commit helper tool',
    });

    await indexer.indexItem({
      id: 'workflow:deploy-prod',
      itemType: 'workflow',
      name: 'Production Deployer',
      command: '/deploy',
      ecosystem: 'claude',
      sourcePath: '/workflows/deploy.md',
      contentHash: 'hash-deploy',
      description: 'Kubernetes cluster rolling deployment pipeline',
      content: 'Trigger blue-green deployment on production cluster',
    });
  });

  afterEach(async () => {
    closeSearchDb(db);
    await fs.rm(testTempDir, { recursive: true, force: true });
  });

  it('calculates Reciprocal Rank Fusion score correctly', () => {
    const bothScore = calculateRrfScore(1, 1, 60);
    // 1/(60+1) + 1/(60+1) = 2/61 ≈ 0.032786
    expect(bothScore).toBeCloseTo(2 / 61, 5);

    const vecOnly = calculateRrfScore(1, undefined, 60);
    expect(vecOnly).toBeCloseTo(1 / 61, 5);

    const ftsOnly = calculateRrfScore(undefined, 1, 60);
    expect(ftsOnly).toBeCloseTo(1 / 61, 5);

    expect(bothScore).toBeGreaterThan(vecOnly);
    expect(bothScore).toBeGreaterThan(ftsOnly);
  });

  it('performs semantic vector search matching conceptual queries', async () => {
    // Query contains synonyms not present verbatim in the text ("weather prediction")
    const results = await engine.search('weather prediction tomorrow', { limit: 3 });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('skill:meteorology');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('performs exact lexical matching for specific keywords and commands', async () => {
    const results = await engine.search('Kubernetes blue-green', { limit: 3 });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('workflow:deploy-prod');
  });

  it('ranks items matching both lexical and semantic higher via RRF', async () => {
    const results = await engine.search('Git Workflow Assistant rebase commits', { limit: 3 });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('skill:git-helper');
    expect(results[0].vectorRank).toBeDefined();
    expect(results[0].bm25Rank).toBeDefined();
  });

  it('filters results by itemType and ecosystem', async () => {
    const skillsOnly = await engine.search('deployment or git', { itemType: 'skill' });
    for (const item of skillsOnly) {
      expect(item.itemType).toBe('skill');
    }

    const claudeOnly = await engine.search('deployment or git', { ecosystem: 'claude' });
    for (const item of claudeOnly) {
      expect(item.ecosystem).toBe('claude');
    }
  });

  it('gracefully executes lexical-only search when vector support is disabled', async () => {
    const fallbackEngine = new HybridSearchEngine(db, embedder, { disableVector: true });
    const results = await fallbackEngine.search('Kubernetes cluster', { limit: 5 });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('workflow:deploy-prod');
    expect(results[0].vectorRank).toBeUndefined();
    expect(results[0].bm25Rank).toBe(1);
  });

  it('executes hybrid search queries within latency budget (< 50ms)', async () => {
    // Warm up embedding model first
    await engine.search('warmup', { limit: 1 });

    const start = performance.now();
    await engine.search('rain atmospheric conditions', { limit: 5 });
    const durationMs = performance.now() - start;

    expect(durationMs).toBeLessThan(50);
  });
});
