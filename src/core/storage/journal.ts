import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { getKoskillJournalPath } from './store.js';
import { defaultLogger } from '../logger.js';

/**
 * Supported storage transaction mutation actions.
 */
export type JournalAction = 'CENTRALIZE' | 'REVERT';

/**
 * Status states for a storage transaction.
 */
export type JournalStatus = 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';

/**
 * Represents a single logged storage mutation transaction.
 */
export interface JournalEntry {
  id: string;
  timestamp: string;
  action: JournalAction;
  skillId: string;
  skillName: string;
  originalPath: string;
  centralPath: string;
  symlinkPath: string;
  status: JournalStatus;
  error?: string;
}

/**
 * On-disk container format for the journal file.
 */
interface JournalFilePayload {
  entries: JournalEntry[];
}

/**
 * Reads all journal entries recorded in the transaction journal.
 *
 * @param customJournalPath - Optional custom journal file path override
 * @returns Array of journal entries in chronological order
 */
export async function readJournal(customJournalPath?: string): Promise<JournalEntry[]> {
  const targetPath = customJournalPath || getKoskillJournalPath();
  try {
    const content = await fs.readFile(targetPath, 'utf8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed as JournalEntry[];
    }
    if (parsed && Array.isArray((parsed as JournalFilePayload).entries)) {
      return (parsed as JournalFilePayload).entries;
    }
    return [];
  } catch (err: unknown) {
    const nodeErr = err as { code?: string };
    if (nodeErr.code === 'ENOENT') {
      return [];
    }
    defaultLogger.warn('Failed to parse storage journal file, defaulting to empty list', {
      targetPath,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Appends a new transaction entry atomically to the journal file.
 *
 * @param entryData - Transaction entry fields without generated id/timestamp
 * @param customJournalPath - Optional custom journal file path override
 * @returns Complete journal entry recorded to disk
 */
export async function appendJournalEntry(
  entryData: Omit<JournalEntry, 'id' | 'timestamp'>,
  customJournalPath?: string
): Promise<JournalEntry> {
  const targetPath = customJournalPath || getKoskillJournalPath();
  const entry: JournalEntry = {
    ...entryData,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };

  const dir = path.dirname(targetPath);
  await fs.mkdir(dir, { recursive: true, mode: 0o755 });

  const currentEntries = await readJournal(targetPath);
  const updatedEntries = [...currentEntries, entry];
  const tempPath = `${targetPath}.${crypto.randomBytes(4).toString('hex')}.tmp`;

  const payload: JournalFilePayload = { entries: updatedEntries };
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf8');
  await fs.rename(tempPath, targetPath);

  defaultLogger.debug('Appended transaction journal entry', {
    id: entry.id,
    action: entry.action,
    skillId: entry.skillId,
    status: entry.status,
  });

  return entry;
}

/**
 * Queries all journal entries associated with a specific skill identifier.
 *
 * @param skillId - Unique skill identifier
 * @param customJournalPath - Optional custom journal file path override
 * @returns Array of journal entries matching the skill
 */
export async function getJournalEntriesForSkill(
  skillId: string,
  customJournalPath?: string
): Promise<JournalEntry[]> {
  const allEntries = await readJournal(customJournalPath);
  return allEntries.filter((e) => e.skillId === skillId);
}
