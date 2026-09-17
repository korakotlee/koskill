/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { ConflictResolver } from './resolver.js';
import { calculateSha256 } from './detector.js';
import { ConflictItem, ResolutionPayload } from './types.js';

describe('Atomic Conflict Resolver', () => {
  let testTempDir: string;
  let backupDir: string;
  let archiveDir: string;
  let resolver: ConflictResolver;

  let fileA: string;
  let fileB: string;
  let contentA: string;
  let contentB: string;
  let hashA: string;
  let hashB: string;
  let items: ConflictItem[];

  beforeEach(async () => {
    testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-resolver-test-'));
    backupDir = path.join(testTempDir, 'backups');
    archiveDir = path.join(testTempDir, 'archive');

    resolver = new ConflictResolver({
      backupDir,
      archiveDir,
    });

    fileA = path.join(testTempDir, 'gemini', 'skill-a', 'SKILL.md');
    fileB = path.join(testTempDir, 'claude', 'skill-b', 'SKILL.md');

    await fs.mkdir(path.dirname(fileA), { recursive: true });
    await fs.mkdir(path.dirname(fileB), { recursive: true });

    contentA = '# Skill A\n\nPrompt instructions A.\n';
    contentB = '# Skill B\n\nPrompt instructions B.\n';

    await fs.writeFile(fileA, contentA, 'utf8');
    await fs.writeFile(fileB, contentB, 'utf8');

    hashA = calculateSha256(contentA);
    hashB = calculateSha256(contentB);

    items = [
      {
        id: 'skill:gemini-a',
        name: 'Skill A',
        ecosystem: 'gemini',
        sourcePath: fileA,
        contentHash: hashA,
        content: contentA,
      },
      {
        id: 'skill:claude-b',
        name: 'Skill B',
        ecosystem: 'claude',
        sourcePath: fileB,
        contentHash: hashB,
        content: contentB,
      },
    ];
  });

  afterEach(async () => {
    await fs.rm(testTempDir, { recursive: true, force: true });
  });

  it('rejects resolution with E_STALE_HASH if file content drifted concurrently', async () => {
    // Intentionally simulate concurrent external modification
    await fs.writeFile(fileA, '# Skill A\n\nModified externally!\n', 'utf8');

    const payload: ResolutionPayload = {
      conflictId: 'conflict-123',
      action: 'PICK',
      winnerId: 'skill:gemini-a',
      expectedHashes: {
        'skill:gemini-a': hashA,
        'skill:claude-b': hashB,
      },
    };

    const result = await resolver.resolve(payload, items);
    expect(result.success).toBe(false);
    expect(result.message).toContain('E_STALE_HASH');

    // Make sure no archive or mutation occurred
    const stillExistsB = await fs.stat(fileB).then(() => true).catch(() => false);
    expect(stillExistsB).toBe(true);
  });

  it('resolves conflict via PICK action, creates backup, and moves loser to archive', async () => {
    const payload: ResolutionPayload = {
      conflictId: 'conflict-123',
      action: 'PICK',
      winnerId: 'skill:gemini-a',
      expectedHashes: {
        'skill:gemini-a': hashA,
        'skill:claude-b': hashB,
      },
    };

    const result = await resolver.resolve(payload, items);
    expect(result.success).toBe(true);
    expect(result.action).toBe('PICK');
    expect(result.backupPath).toBeDefined();

    // Winner remains in place
    const winnerExists = await fs.stat(fileA).then(() => true).catch(() => false);
    expect(winnerExists).toBe(true);

    // Loser file was moved to archive
    const loserExists = await fs.stat(fileB).then(() => true).catch(() => false);
    expect(loserExists).toBe(false);

    expect(result.archivedPaths?.length).toBeGreaterThan(0);
    const archivedFile = result.archivedPaths![0];
    const archivedContent = await fs.readFile(archivedFile, 'utf8');
    expect(archivedContent).toBe(contentB);
  });

  it('resolves conflict via ALIAS action, updating item identifier without deleting source', async () => {
    const payload: ResolutionPayload = {
      conflictId: 'conflict-456',
      action: 'ALIAS',
      winnerId: 'skill:claude-b',
      newAlias: 'skill-b-aliased',
      expectedHashes: {
        'skill:gemini-a': hashA,
        'skill:claude-b': hashB,
      },
    };

    const result = await resolver.resolve(payload, items);
    expect(result.success).toBe(true);
    expect(result.action).toBe('ALIAS');
    expect(result.message).toContain('skill-b-aliased');

    // Both files still exist
    const fileAExists = await fs.stat(fileA).then(() => true).catch(() => false);
    const fileBExists = await fs.stat(fileB).then(() => true).catch(() => false);
    expect(fileAExists).toBe(true);
    expect(fileBExists).toBe(true);
  });

  it('resolves conflict via MERGE action, writing unified content and archiving alternate', async () => {
    const mergedContent = '# Merged Unified Skill\n\nCombined prompt instructions.\n';
    const payload: ResolutionPayload = {
      conflictId: 'conflict-789',
      action: 'MERGE',
      winnerId: 'skill:gemini-a',
      mergedContent,
      expectedHashes: {
        'skill:gemini-a': hashA,
        'skill:claude-b': hashB,
      },
    };

    const result = await resolver.resolve(payload, items);
    expect(result.success).toBe(true);
    expect(result.action).toBe('MERGE');

    // Winner has merged content
    const updatedContent = await fs.readFile(fileA, 'utf8');
    expect(updatedContent).toBe(mergedContent);

    // Alternate is archived
    const loserExists = await fs.stat(fileB).then(() => true).catch(() => false);
    expect(loserExists).toBe(false);
  });
});
