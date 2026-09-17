import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { ExportBackupOptions, ExportBackupResult, BackupManifest } from './types.js';
import { getKoskillHomeDir, getKoskillSkillsDir, getKoskillWorkflowsDir, getKoskillMcpDir, getKoskillJournalPath } from '../storage/store.js';
import { loadMcpRegistry } from '../storage/mcp-store.js';
import { appendJournalEntry } from '../storage/journal.js';
import { defaultLogger } from '../logger.js';

const execFileAsync = promisify(execFile);

/**
 * Recursively copies a directory if it exists on disk.
 */
async function copyDirIfExists(src: string, dest: string): Promise<boolean> {
  try {
    await fs.access(src);
    await fs.mkdir(dest, { recursive: true });
    await fs.cp(src, dest, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Counts top-level entries inside a directory.
 */
async function countEntries(dirPath: string): Promise<number> {
  try {
    const entries = await fs.readdir(dirPath);
    return entries.filter((e) => !e.startsWith('.')).length;
  } catch {
    return 0;
  }
}

/**
 * Exports centralized ~/.koskill resources into a portable .tar.gz backup archive.
 */
export async function exportBackup(options: ExportBackupOptions): Promise<ExportBackupResult> {
  const { outputPath, customHome, includeSecrets = false, notes } = options;
  const homeDir = getKoskillHomeDir(customHome);
  const skillsDir = getKoskillSkillsDir(customHome);
  const workflowsDir = getKoskillWorkflowsDir(customHome);
  const mcpDir = getKoskillMcpDir(customHome);
  const journalPath = getKoskillJournalPath(customHome);
  const vaultDir = path.join(homeDir, 'vault');

  const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-export-staging-'));

  try {
    // Copy centralized entities
    await copyDirIfExists(skillsDir, path.join(stagingDir, 'skills'));
    await copyDirIfExists(workflowsDir, path.join(stagingDir, 'workflows'));
    await copyDirIfExists(mcpDir, path.join(stagingDir, 'mcp'));

    try {
      await fs.access(journalPath);
      await fs.copyFile(journalPath, path.join(stagingDir, 'journal.json'));
    } catch {
      // Journal not present yet
    }

    if (includeSecrets) {
      await copyDirIfExists(vaultDir, path.join(stagingDir, 'vault'));
    }

    // Compute manifest item counts
    const skillCount = await countEntries(skillsDir);
    const workflowCount = await countEntries(workflowsDir);
    const mcpRegistry = await loadMcpRegistry(customHome);
    const mcpCount = Object.keys(mcpRegistry).length;

    const manifest: BackupManifest = {
      version: '0.1.0',
      createdAt: new Date().toISOString(),
      entityCounts: {
        skills: skillCount,
        workflows: workflowCount,
        mcpServers: mcpCount,
      },
      includedSecrets: Boolean(includeSecrets),
      notes,
    };

    await fs.writeFile(
      path.join(stagingDir, 'backup-manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    // Ensure output directory exists
    const outputDir = path.dirname(path.resolve(outputPath));
    await fs.mkdir(outputDir, { recursive: true });

    // Package gzip tarball
    await execFileAsync('tar', ['-czf', path.resolve(outputPath), '-C', stagingDir, '.']);

    const stat = await fs.stat(path.resolve(outputPath));

    // Record export in journal
    await appendJournalEntry(
      {
        action: 'BACKUP_EXPORT',
        status: 'COMPLETED',
        originalPath: homeDir,
        centralPath: path.resolve(outputPath),
        symlinkPath: '',
        metadata: {
          manifest,
          sizeBytes: stat.size,
        },
      },
      journalPath
    );

    defaultLogger.info('Exported backup archive', { outputPath, sizeBytes: stat.size });

    return {
      success: true,
      archivePath: path.resolve(outputPath),
      manifest,
      sizeBytes: stat.size,
    };
  } catch (err: any) {
    defaultLogger.error('Failed to export backup archive', { error: err.message, outputPath });
    throw err;
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
  }
}
