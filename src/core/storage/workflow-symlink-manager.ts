import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  initCentralStore,
  getWorkflowCentralPath,
  getKoskillWorkflowsDir,
  getKoskillJournalPath,
} from './store.js';
import { appendJournalEntry } from './journal.js';
import { defaultLogger } from '../logger.js';
import { SkillStatus } from '../types.js';

export interface CentralizeWorkflowOptions {
  workflowId: string;
  workflowName: string;
  sourcePath: string;
  customHome?: string;
}

export interface CentralizeWorkflowResult {
  success: boolean;
  status: SkillStatus;
  workflowId: string;
  originalPath: string;
  centralPath: string;
  symlinkPath: string;
}

export interface RevertWorkflowOptions {
  workflowId: string;
  workflowName: string;
  sourcePath: string;
  customHome?: string;
}

export interface RevertWorkflowResult {
  success: boolean;
  status: SkillStatus;
  workflowId: string;
  originalPath: string;
}

export interface WorkflowStorageInspection {
  status: SkillStatus;
  targetPath?: string;
}

/**
 * Inspects a workflow file to determine its current storage status.
 */
export async function inspectWorkflowStorage(
  workflowPath: string,
  customHome?: string
): Promise<WorkflowStorageInspection> {
  const centralWorkflowsDir = getKoskillWorkflowsDir(customHome);

  if (workflowPath.endsWith('.disabled')) {
    return { status: 'inactive' };
  }

  try {
    const lstat = await fs.lstat(workflowPath);

    if (lstat.isSymbolicLink()) {
      const rawLink = await fs.readlink(workflowPath);
      const resolvedLink = path.isAbsolute(rawLink)
        ? rawLink
        : path.resolve(path.dirname(workflowPath), rawLink);

      try {
        await fs.stat(resolvedLink);

        if (resolvedLink.startsWith(centralWorkflowsDir)) {
          return { status: 'centralized', targetPath: resolvedLink };
        }
        return { status: 'symlinked', targetPath: resolvedLink };
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          const disabledTarget = `${resolvedLink}.disabled`;
          try {
            await fs.access(disabledTarget);
            return { status: 'inactive', targetPath: disabledTarget };
          } catch {
            return { status: 'broken-link' };
          }
        }
        throw err;
      }
    }

    if (workflowPath.startsWith(centralWorkflowsDir)) {
      return { status: 'centralized', targetPath: workflowPath };
    }

    return { status: 'original' };
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return { status: 'broken-link' };
    }
    throw err;
  }
}

/**
 * Migrates a standalone workflow markdown file into the central store and leaves a symlink.
 */
export async function centralizeWorkflow(
  opts: CentralizeWorkflowOptions
): Promise<CentralizeWorkflowResult> {
  const { workflowId, workflowName, sourcePath, customHome } = opts;
  await initCentralStore(customHome);

  const centralPath = getWorkflowCentralPath(workflowName, customHome);
  const inspection = await inspectWorkflowStorage(sourcePath, customHome);

  if (inspection.status === 'centralized') {
    return {
      success: true,
      status: 'centralized',
      workflowId,
      originalPath: sourcePath,
      centralPath: inspection.targetPath || centralPath,
      symlinkPath: sourcePath,
    };
  }

  defaultLogger.info('Centralizing workflow file', { workflowId, sourcePath, centralPath });

  const tempBackup = `${sourcePath}.koskill-backup-${Date.now()}`;
  try {
    // Read source content
    const content = await fs.readFile(sourcePath, 'utf-8');

    // Write to central path
    await fs.writeFile(centralPath, content, { encoding: 'utf-8', mode: 0o644 });

    // Backup original before unlinking
    await fs.copyFile(sourcePath, tempBackup);
    await fs.unlink(sourcePath);

    // Create relative or absolute symlink to central file
    await fs.symlink(centralPath, sourcePath);

    // Clean up temporary backup
    await fs.unlink(tempBackup).catch(() => {});

    await appendJournalEntry(
      {
        action: 'CENTRALIZE',
        skillId: workflowId,
        skillName: workflowName,
        originalPath: sourcePath,
        centralPath,
        symlinkPath: sourcePath,
        status: 'COMPLETED',
      },
      getKoskillJournalPath(customHome)
    );

    return {
      success: true,
      status: 'centralized',
      workflowId,
      originalPath: sourcePath,
      centralPath,
      symlinkPath: sourcePath,
    };
  } catch (error) {
    defaultLogger.error('Failed to centralize workflow, triggering rollback', {
      workflowId,
      sourcePath,
      error: String(error),
    });

    try {
      await fs.unlink(sourcePath).catch(() => {});
      const hasBackup = await fs
        .stat(tempBackup)
        .then(() => true)
        .catch(() => false);
      if (hasBackup) {
        await fs.rename(tempBackup, sourcePath);
      }
    } catch (rbErr) {
      defaultLogger.error('Workflow rollback failed', { rbErr });
    }

    throw error;
  }
}

/**
 * Reverts a centralized workflow symlink back to a standalone local markdown file.
 */
export async function revertWorkflow(
  opts: RevertWorkflowOptions
): Promise<RevertWorkflowResult> {
  const { workflowId, sourcePath, customHome } = opts;

  const inspection = await inspectWorkflowStorage(sourcePath, customHome);
  if (inspection.status !== 'centralized' && inspection.status !== 'symlinked') {
    return {
      success: true,
      status: inspection.status,
      workflowId,
      originalPath: sourcePath,
    };
  }

  const targetPath = inspection.targetPath || getWorkflowCentralPath(opts.workflowName, customHome);
  defaultLogger.info('Reverting centralized workflow', { workflowId, sourcePath, targetPath });

  const content = await fs.readFile(targetPath, 'utf-8');

  // Remove symlink
  await fs.unlink(sourcePath);

  // Write standalone file at sourcePath
  await fs.writeFile(sourcePath, content, { encoding: 'utf-8', mode: 0o644 });

  await appendJournalEntry(
    {
      action: 'REVERT',
      skillId: workflowId,
      skillName: opts.workflowName,
      originalPath: sourcePath,
      centralPath: targetPath,
      symlinkPath: sourcePath,
      status: 'COMPLETED',
    },
    getKoskillJournalPath(customHome)
  );

  return {
    success: true,
    status: 'original',
    workflowId,
    originalPath: sourcePath,
  };
}
