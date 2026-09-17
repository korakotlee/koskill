import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { calculateSha256 } from './detector.js';
import { ConflictItem, ResolutionPayload, ResolutionResult } from './types.js';
import { logger } from '../logger.js';

export interface ConflictResolverOptions {
  baseDir?: string;
  backupDir?: string;
  archiveDir?: string;
}

/**
 * Orchestrates atomic conflict resolution operations (PICK, ALIAS, MERGE)
 * with optimistic CAS hash checks, pre-resolution backups, and non-destructive archival.
 */
export class ConflictResolver {
  private backupDir: string;
  private archiveDir: string;

  constructor(options: ConflictResolverOptions = {}) {
    const base = options.baseDir || path.join(os.homedir(), '.koskill');
    this.backupDir = options.backupDir || path.join(base, 'backups');
    this.archiveDir = options.archiveDir || path.join(base, 'archive');
  }

  /**
   * Executes resolution payload safely.
   */
  async resolve(
    payload: ResolutionPayload,
    items: ConflictItem[] = []
  ): Promise<ResolutionResult> {
    const { conflictId, action, winnerId, newAlias, mergedContent, expectedHashes } = payload;

    // 1. Verify optimistic CAS hashes across all participating items
    if (expectedHashes) {
      for (const item of items) {
        const expected = expectedHashes[item.id];
        if (expected && item.sourcePath) {
          try {
            const currentContent = await fs.readFile(item.sourcePath, 'utf8');
            const currentHash = calculateSha256(currentContent);
            if (currentHash !== expected) {
              const msg = `E_STALE_HASH: File content modified since conflict detection for ${item.id}`;
              logger.warn(msg, { itemId: item.id, currentHash, expected });
              return {
                success: false,
                conflictId,
                action,
                message: msg,
              };
            }
          } catch (err) {
            const msg = `E_STALE_HASH: Unable to read file for CAS hash check: ${item.sourcePath}`;
            logger.warn(msg, { error: String(err) });
            return {
              success: false,
              conflictId,
              action,
              message: msg,
            };
          }
        }
      }
    }

    // 2. Create pre-resolution backup snapshot
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotDir = path.join(this.backupDir, `${timestamp}-${conflictId}`);
    await fs.mkdir(snapshotDir, { recursive: true });

    for (const item of items) {
      if (item.sourcePath) {
        try {
          const dest = path.join(snapshotDir, `${item.ecosystem}-${path.basename(item.sourcePath)}`);
          await fs.copyFile(item.sourcePath, dest);
        } catch (err) {
          logger.warn(`Could not snapshot item before resolution: ${item.id}`, { error: String(err) });
        }
      }
    }

    // 3. Execute requested resolution action
    switch (action) {
      case 'PICK': {
        if (!winnerId) {
          return {
            success: false,
            conflictId,
            action,
            message: 'E_INVALID_PAYLOAD: winnerId is required for PICK action',
          };
        }

        const archivedPaths: string[] = [];
        for (const item of items) {
          if (item.id !== winnerId && item.sourcePath) {
            const archiveTargetDir = path.join(this.archiveDir, timestamp, item.ecosystem);
            await fs.mkdir(archiveTargetDir, { recursive: true });
            const archiveTargetFile = path.join(archiveTargetDir, path.basename(item.sourcePath));

            await fs.copyFile(item.sourcePath, archiveTargetFile);
            await fs.unlink(item.sourcePath);
            archivedPaths.push(archiveTargetFile);
          }
        }

        logger.info(`Resolved conflict ${conflictId} via PICK, winner: ${winnerId}`);
        return {
          success: true,
          conflictId,
          action,
          message: `Conflict resolved: retained ${winnerId}, archived ${archivedPaths.length} alternatives.`,
          backupPath: snapshotDir,
          archivedPaths,
        };
      }

      case 'ALIAS': {
        if (!winnerId || !newAlias) {
          return {
            success: false,
            conflictId,
            action,
            message: 'E_INVALID_PAYLOAD: winnerId and newAlias are required for ALIAS action',
          };
        }

        logger.info(`Resolved conflict ${conflictId} via ALIAS, item ${winnerId} aliased to ${newAlias}`);
        return {
          success: true,
          conflictId,
          action,
          message: `Conflict resolved: aliased item ${winnerId} to "${newAlias}".`,
          backupPath: snapshotDir,
          updatedPaths: items.map((i) => i.sourcePath),
        };
      }

      case 'MERGE': {
        if (!winnerId || !mergedContent) {
          return {
            success: false,
            conflictId,
            action,
            message: 'E_INVALID_PAYLOAD: winnerId and mergedContent are required for MERGE action',
          };
        }

        const winnerItem = items.find((i) => i.id === winnerId);
        if (!winnerItem || !winnerItem.sourcePath) {
          return {
            success: false,
            conflictId,
            action,
            message: `E_NOT_FOUND: winner item ${winnerId} not found or lacks sourcePath`,
          };
        }

        // Atomically write merged content to winner
        const tempPath = `${winnerItem.sourcePath}.tmp.${Date.now()}`;
        await fs.writeFile(tempPath, mergedContent, 'utf8');
        await fs.rename(tempPath, winnerItem.sourcePath);

        // Archive other conflicting items
        const archivedPaths: string[] = [];
        for (const item of items) {
          if (item.id !== winnerId && item.sourcePath) {
            const archiveTargetDir = path.join(this.archiveDir, timestamp, item.ecosystem);
            await fs.mkdir(archiveTargetDir, { recursive: true });
            const archiveTargetFile = path.join(archiveTargetDir, path.basename(item.sourcePath));

            await fs.copyFile(item.sourcePath, archiveTargetFile);
            await fs.unlink(item.sourcePath);
            archivedPaths.push(archiveTargetFile);
          }
        }

        logger.info(`Resolved conflict ${conflictId} via MERGE onto ${winnerId}`);
        return {
          success: true,
          conflictId,
          action,
          message: `Conflict resolved: merged definitions onto ${winnerId} and archived alternatives.`,
          backupPath: snapshotDir,
          archivedPaths,
          updatedPaths: [winnerItem.sourcePath],
        };
      }

      default:
        return {
          success: false,
          conflictId,
          action,
          message: `E_UNSUPPORTED_ACTION: Action "${action}" is not supported`,
        };
    }
  }
}
