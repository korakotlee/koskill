import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  initCentralStore,
  getSkillCentralPath,
  getKoskillSkillsDir,
  getKoskillJournalPath,
} from './store.js';
import { appendJournalEntry } from './journal.js';
import { defaultLogger } from '../logger.js';
import { SkillStatus } from '../types.js';

/**
 * Options required to centralize an existing skill.
 */
export interface CentralizeSkillOptions {
  skillId: string;
  skillName: string;
  sourcePath: string;
  customHome?: string;
}

/**
 * Result of a skill centralization operation.
 */
export interface CentralizeResult {
  success: boolean;
  status: SkillStatus;
  skillId: string;
  originalPath: string;
  centralPath: string;
  symlinkPath: string;
}

/**
 * Options required to revert a symlinked skill back to original physical state.
 */
export interface RevertSkillOptions {
  skillId: string;
  skillName: string;
  sourcePath: string;
  customHome?: string;
}

/**
 * Result of a skill reversion operation.
 */
export interface RevertResult {
  success: boolean;
  status: SkillStatus;
  skillId: string;
  originalPath: string;
}

/**
 * Storage inspection output for a skill path.
 */
export interface StorageInspectionResult {
  status: SkillStatus;
  targetPath?: string;
}

/**
 * Inspects a filesystem path to determine its current skill storage state.
 *
 * @param skillPath - Absolute path to inspect
 * @param customHome - Optional custom KoSkill home override
 * @returns Detected status and canonical target path if symlinked
 */
export async function getSkillStorageStatus(
  skillPath: string,
  customHome?: string
): Promise<StorageInspectionResult> {
  const centralSkillsDir = getKoskillSkillsDir(customHome);

  try {
    const lstat = await fs.lstat(skillPath);

    if (lstat.isSymbolicLink()) {
      const linkTarget = await fs.readlink(skillPath);
      const resolvedTarget = path.isAbsolute(linkTarget)
        ? linkTarget
        : path.resolve(path.dirname(skillPath), linkTarget);

      try {
        await fs.stat(skillPath);
        return { status: 'symlinked', targetPath: resolvedTarget };
      } catch {
        return { status: 'broken-link', targetPath: resolvedTarget };
      }
    }

    const normalizedPath = path.resolve(skillPath);
    if (normalizedPath.startsWith(path.resolve(centralSkillsDir))) {
      return { status: 'centralized' };
    }

    return { status: 'original' };
  } catch (err: unknown) {
    const nodeErr = err as { code?: string };
    if (nodeErr.code === 'ENOENT') {
      return { status: 'original' };
    }
    defaultLogger.warn('Failed to inspect skill storage status', {
      skillPath,
      error: err instanceof Error ? err.message : String(err),
    });
    return { status: 'original' };
  }
}

/**
 * Migrates a skill directory to the central store and replaces source with a symlink.
 *
 * @param options - Centralization parameters
 * @returns Centralization result details
 */
export async function centralizeSkill(options: CentralizeSkillOptions): Promise<CentralizeResult> {
  const { skillId, skillName, sourcePath, customHome } = options;
  const journalPath = getKoskillJournalPath(customHome);

  await initCentralStore(customHome);
  const targetCentralPath = getSkillCentralPath(skillName, customHome);

  const lstat = await fs.lstat(sourcePath);
  if (lstat.isSymbolicLink()) {
    throw new Error(`Skill at ${sourcePath} is already symlinked or centralized.`);
  }

  const centralExists = await fs
    .stat(targetCentralPath)
    .then(() => true)
    .catch(() => false);
  if (centralExists) {
    throw new Error(`Target central path already exists at ${targetCentralPath}.`);
  }

  const backupPath = `${sourcePath}.koskill_backup_${Date.now()}`;
  let centralCopied = false;
  let sourceBackedUp = false;

  try {
    await fs.cp(sourcePath, targetCentralPath, { recursive: true });
    centralCopied = true;

    await fs.rename(sourcePath, backupPath);
    sourceBackedUp = true;

    await fs.symlink(targetCentralPath, sourcePath, 'dir');
    await fs.rm(backupPath, { recursive: true, force: true });

    await appendJournalEntry(
      {
        action: 'CENTRALIZE',
        skillId,
        skillName,
        originalPath: sourcePath,
        centralPath: targetCentralPath,
        symlinkPath: sourcePath,
        status: 'COMPLETED',
      },
      journalPath
    );

    defaultLogger.info('Successfully centralized skill and generated symlink', {
      skillId,
      sourcePath,
      targetCentralPath,
    });

    return {
      success: true,
      status: 'symlinked',
      skillId,
      originalPath: sourcePath,
      centralPath: targetCentralPath,
      symlinkPath: sourcePath,
    };
  } catch (err) {
    defaultLogger.error('Centralization failed, triggering rollback', {
      skillId,
      sourcePath,
      error: err instanceof Error ? err.message : String(err),
    });

    if (sourceBackedUp) {
      try {
        await fs.rm(sourcePath, { recursive: true, force: true }).catch(() => {});
        await fs.rename(backupPath, sourcePath);
      } catch (rollbackErr) {
        defaultLogger.error('Failed to restore source backup during rollback', { rollbackErr });
      }
    }

    if (centralCopied) {
      await fs.rm(targetCentralPath, { recursive: true, force: true }).catch(() => {});
    }

    await appendJournalEntry(
      {
        action: 'CENTRALIZE',
        skillId,
        skillName,
        originalPath: sourcePath,
        centralPath: targetCentralPath,
        symlinkPath: sourcePath,
        status: 'ROLLED_BACK',
        error: err instanceof Error ? err.message : String(err),
      },
      journalPath
    ).catch(() => {});

    throw err;
  }
}

/**
 * Reverts a symlinked skill back to an original physical directory.
 *
 * @param options - Reversion parameters
 * @returns Reversion result details
 */
export async function revertSkill(options: RevertSkillOptions): Promise<RevertResult> {
  const { skillId, skillName, sourcePath, customHome } = options;
  const journalPath = getKoskillJournalPath(customHome);
  const targetCentralPath = getSkillCentralPath(skillName, customHome);

  const lstat = await fs.lstat(sourcePath);
  if (!lstat.isSymbolicLink()) {
    throw new Error(`Skill path at ${sourcePath} is not a symbolic link.`);
  }

  const centralExists = await fs
    .stat(targetCentralPath)
    .then(() => true)
    .catch(() => false);
  if (!centralExists) {
    throw new Error(`Central storage directory missing for ${skillName} at ${targetCentralPath}.`);
  }

  try {
    await fs.unlink(sourcePath);
    await fs.cp(targetCentralPath, sourcePath, { recursive: true });
    await fs.rm(targetCentralPath, { recursive: true, force: true });

    await appendJournalEntry(
      {
        action: 'REVERT',
        skillId,
        skillName,
        originalPath: sourcePath,
        centralPath: targetCentralPath,
        symlinkPath: sourcePath,
        status: 'COMPLETED',
      },
      journalPath
    );

    defaultLogger.info('Successfully reverted skill to original directory', {
      skillId,
      sourcePath,
    });

    return {
      success: true,
      status: 'original',
      skillId,
      originalPath: sourcePath,
    };
  } catch (err) {
    defaultLogger.error('Reversion failed', {
      skillId,
      sourcePath,
      error: err instanceof Error ? err.message : String(err),
    });

    await appendJournalEntry(
      {
        action: 'REVERT',
        skillId,
        skillName,
        originalPath: sourcePath,
        centralPath: targetCentralPath,
        symlinkPath: sourcePath,
        status: 'FAILED',
        error: err instanceof Error ? err.message : String(err),
      },
      journalPath
    ).catch(() => {});

    throw err;
  }
}
