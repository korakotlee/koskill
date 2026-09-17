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
  findSemanticDuplicates,
  findSemanticConflicts,
} from '../../../src/core/conflict/semantic.js';
import { routeCapabilities } from '../../../src/core/search/hybrid.js';

describe('Semantic Conflict and Duplicate Detection', () => {
  let testTempDir: string;
  let dbPath: string;
  let db: SearchDatabase;
  let embedder: LocalEmbedder;
  let indexer: IncrementalIndexer;

  beforeEach(async () => {
    testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-conflict-test-'));
    dbPath = path.join(testTempDir, 'cache', 'index.db');
    db = initSearchDb(dbPath);
    embedder = new LocalEmbedder();
    indexer = new IncrementalIndexer(db, embedder);

    // Two semantically identical skills with different names
    await indexer.indexItem({
      id: 'skill:git-commit-helper',
      itemType: 'skill',
      name: 'Git Commit Helper',
      ecosystem: 'gemini',
      sourcePath: '/skills/commit-helper',
      contentHash: 'h1',
      description: 'Generates conventional git commit messages based on staged changes',
      content: 'Analyze git diff and formulate standard conventional commit message headers',
    });

    await indexer.indexItem({
      id: 'skill:auto-conventional-commit',
      itemType: 'skill',
      name: 'Automated Conventional Commits',
      ecosystem: 'claude',
      sourcePath: '/skills/auto-commit',
      contentHash: 'h2',
      description: 'Inspects git staged diff to write conventional commit messages automatically',
      content: 'Analyze git diff and formulate standard conventional commit message headers',
    });

    // An unrelated skill
    await indexer.indexItem({
      id: 'skill:react-component-designer',
      itemType: 'skill',
      name: 'React Component Designer',
      ecosystem: 'gemini',
      sourcePath: '/skills/react-designer',
      contentHash: 'h3',
      description: 'Generates accessible Tailwind CSS and React JSX components',
      content: 'React TypeScript UI design with Tailwind CSS utility classes',
    });

    // Two workflows sharing the exact same command trigger but with divergent instructions
    await indexer.indexItem({
      id: 'workflow:deploy-k8s',
      itemType: 'workflow',
      name: 'Deploy to Kubernetes',
      command: '/deploy',
      ecosystem: 'gemini',
      sourcePath: '/workflows/k8s.md',
      contentHash: 'h4',
      description: 'Deploys docker container image to Amazon EKS Kubernetes cluster via Helm charts',
      content: 'kubectl rollout restart deployment and apply helm upgrade values to production cluster',
    });

    await indexer.indexItem({
      id: 'workflow:deploy-serverless',
      itemType: 'workflow',
      name: 'Deploy Serverless Functions',
      command: '/deploy',
      ecosystem: 'claude',
      sourcePath: '/workflows/serverless.md',
      contentHash: 'h5',
      description: 'Deploys edge worker script to Cloudflare Workers serverless edge environment',
      content: 'wrangler deploy and publish edge handlers across Cloudflare global points of presence',
    });
  });

  afterEach(async () => {
    closeSearchDb(db);
    await fs.rm(testTempDir, { recursive: true, force: true });
  });

  it('detects semantic duplicate skills with similarity >= 0.85 under differing names', async () => {
    const duplicates = await findSemanticDuplicates(db, embedder, { threshold: 0.85 });

    expect(duplicates.length).toBeGreaterThan(0);
    const match = duplicates.find(
      (d) =>
        (d.firstId === 'skill:git-commit-helper' && d.secondId === 'skill:auto-conventional-commit') ||
        (d.firstId === 'skill:auto-conventional-commit' && d.secondId === 'skill:git-commit-helper')
    );
    expect(match).toBeDefined();
    expect(match?.similarity).toBeGreaterThanOrEqual(0.85);

    // Make sure unrelated React skill is not marked as duplicate
    const reactMatch = duplicates.find(
      (d) => d.firstId === 'skill:react-component-designer' || d.secondId === 'skill:react-component-designer'
    );
    expect(reactMatch).toBeUndefined();
  });

  it('detects prompt instruction conflicts when same command trigger has divergent instructions', async () => {
    const conflicts = await findSemanticConflicts(db, embedder, { divergenceThreshold: 0.2 });

    expect(conflicts.length).toBeGreaterThan(0);
    const deployConflict = conflicts.find((c) => c.command === '/deploy');
    expect(deployConflict).toBeDefined();
    expect(deployConflict?.firstId).toMatch(/deploy-(k8s|serverless)/);
    expect(deployConflict?.secondId).toMatch(/deploy-(k8s|serverless)/);
    expect(deployConflict?.divergence).toBeGreaterThan(0.2);
  });

  it('routes capabilities to top matching skills or workflows', async () => {
    const results = await routeCapabilities(db, 'deploy to kubernetes helm cluster', { limit: 2 });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('workflow:deploy-k8s');
  });
});
