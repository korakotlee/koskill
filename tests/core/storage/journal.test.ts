import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  readJournal,
  appendJournalEntry,
  getJournalEntriesForSkill,
  JournalEntry,
} from '../../../src/core/storage/journal.js';

describe('Transaction Journal Manager', () => {
  let testTempDir: string;
  let journalPath: string;

  beforeEach(async () => {
    testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-journal-test-'));
    journalPath = path.join(testTempDir, 'journal.json');
  });

  afterEach(async () => {
    await fs.rm(testTempDir, { recursive: true, force: true });
  });

  it('returns empty array if journal file does not exist', async () => {
    const entries = await readJournal(journalPath);
    expect(entries).toEqual([]);
  });

  it('appends and reads transaction journal entries atomically', async () => {
    const entry1 = await appendJournalEntry(
      {
        action: 'CENTRALIZE',
        skillId: 'gemini:web-search',
        skillName: 'web-search',
        originalPath: '/tmp/original/web-search',
        centralPath: '/tmp/central/web-search',
        symlinkPath: '/tmp/original/web-search',
        status: 'COMPLETED',
      },
      journalPath
    );

    expect(entry1.id).toBeDefined();
    expect(entry1.timestamp).toBeDefined();
    expect(entry1.action).toBe('CENTRALIZE');

    const entry2 = await appendJournalEntry(
      {
        action: 'REVERT',
        skillId: 'gemini:web-search',
        skillName: 'web-search',
        originalPath: '/tmp/original/web-search',
        centralPath: '/tmp/central/web-search',
        symlinkPath: '/tmp/original/web-search',
        status: 'COMPLETED',
      },
      journalPath
    );

    const entries = await readJournal(journalPath);
    expect(entries.length).toBe(2);
    expect(entries[0].action).toBe('CENTRALIZE');
    expect(entries[1].action).toBe('REVERT');
  });

  it('filters journal entries by skillId', async () => {
    await appendJournalEntry(
      {
        action: 'CENTRALIZE',
        skillId: 'gemini:code-review',
        skillName: 'code-review',
        originalPath: '/tmp/code-review',
        centralPath: '/tmp/central/code-review',
        symlinkPath: '/tmp/code-review',
        status: 'COMPLETED',
      },
      journalPath
    );

    await appendJournalEntry(
      {
        action: 'CENTRALIZE',
        skillId: 'gemini:other-skill',
        skillName: 'other-skill',
        originalPath: '/tmp/other-skill',
        centralPath: '/tmp/central/other-skill',
        symlinkPath: '/tmp/other-skill',
        status: 'FAILED',
        error: 'Permission denied',
      },
      journalPath
    );

    const matching = await getJournalEntriesForSkill('gemini:code-review', journalPath);
    expect(matching.length).toBe(1);
    expect(matching[0].skillId).toBe('gemini:code-review');
    expect(matching[0].status).toBe('COMPLETED');
  });

  it('records rolled back status on failures', async () => {
    const rolledBack = await appendJournalEntry(
      {
        action: 'CENTRALIZE',
        skillId: 'gemini:failed-skill',
        skillName: 'failed-skill',
        originalPath: '/tmp/failed',
        centralPath: '/tmp/central/failed',
        symlinkPath: '/tmp/failed',
        status: 'ROLLED_BACK',
        error: 'Symlink creation failed',
      },
      journalPath
    );

    expect(rolledBack.status).toBe('ROLLED_BACK');
    expect(rolledBack.error).toBe('Symlink creation failed');
  });
});
