import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { ImportBackupOptions, ImportBackupResult, BackupManifest } from './types.js';
import { getKoskillHomeDir, getKoskillSkillsDir, getKoskillWorkflowsDir, getKoskillJournalPath, initCentralStore } from '../storage/store.js';
import { loadMcpRegistry, saveMcpRegistry } from '../storage/mcp-store.js';
import { appendJournalEntry } from '../storage/journal.js';
import { defaultLogger } from '../logger.js';

const execFileAsync = promisify(execFile);

/**
 * Validates a list of tar entries against path traversal and tar-slip attempts.
 */
export function validateArchiveEntries(
  entries: string[],
  targetDest: string
): { isValid: boolean; traversalEntries: string[] } {
  const normalizedDest = path.resolve(targetDest);
  const traversalEntries: string[] = [];

  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry || entry === './' || entry === '.') continue;

    // Check for explicit root prefixes
    if (path.isAbsolute(entry) || entry.startsWith('/') || entry.startsWith('\\')) {
      traversalEntries.push(entry);
      continue;
    }

    // Check for relative traversal segments
    const parts = entry.split(/[/\\]+/);
    if (parts.includes('..')) {
      traversalEntries.push(entry);
      continue;
    }

    // Check canonical resolved path
    const resolvedPath = path.resolve(normalizedDest, entry);
    if (resolvedPath !== normalizedDest && !resolvedPath.startsWith(normalizedDest + path.sep)) {
      traversalEntries.push(entry);
    }
  }

  return {
    isValid: traversalEntries.length === 0,
    traversalEntries,
  };
}

/**
 * Extracts and applies a backup archive to the centralized ~/.koskill layout.
 */
export async function importBackup(options: ImportBackupOptions): Promise<ImportBackupResult> {
  const { archivePath, customHome, overwrite = false, importSecrets = false } = options;
  const absArchivePath = path.resolve(archivePath);

  await initCentralStore(customHome);
  const homeDir = getKoskillHomeDir(customHome);
  const skillsDir = getKoskillSkillsDir(customHome);
  const workflowsDir = getKoskillWorkflowsDir(customHome);
  const journalPath = getKoskillJournalPath(customHome);

  // 1. Inspect archive entries for tar-slip prevention
  const { stdout: entryListRaw } = await execFileAsync('tar', ['-tf', absArchivePath]);
  const entries = entryListRaw.split('\n').map((e) => e.trim()).filter(Boolean);

  const validation = validateArchiveEntries(entries, homeDir);
  if (!validation.isValid) {
    const msg = `Archive rejected: path traversal detected in entries: ${validation.traversalEntries.join(', ')}`;
    defaultLogger.error(msg);
    throw new Error(msg);
  }

  // 2. Extract into isolated temporary directory
  const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-import-staging-'));

  try {
    await execFileAsync('tar', ['-xzf', absArchivePath, '-C', stagingDir]);

    // 3. Read manifest if present
    let manifest: BackupManifest | undefined;
    try {
      const manifestRaw = await fs.readFile(path.join(stagingDir, 'backup-manifest.json'), 'utf8');
      manifest = JSON.parse(manifestRaw);
    } catch {
      defaultLogger.warn('Backup manifest not found in archive root');
    }

    const collisions: string[] = [];
    let importedSkills = 0;
    let importedWorkflows = 0;
    let importedMcpServers = 0;

    // 4. Restore skills
    const stagingSkillsDir = path.join(stagingDir, 'skills');
    try {
      const skillEntries = await fs.readdir(stagingSkillsDir, { withFileTypes: true });
      for (const entry of skillEntries) {
        if (!entry.isDirectory()) continue;
        const targetPath = path.join(skillsDir, entry.name);
        const exists = await fs.access(targetPath).then(() => true).catch(() => false);

        if (exists && !overwrite) {
          collisions.push(`skills/${entry.name}`);
          continue;
        }

        if (exists && overwrite) {
          await fs.rm(targetPath, { recursive: true, force: true });
        }

        await fs.cp(path.join(stagingSkillsDir, entry.name), targetPath, { recursive: true });
        importedSkills++;
      }
    } catch {
      // No skills directory in backup
    }

    // 5. Restore workflows
    const stagingWorkflowsDir = path.join(stagingDir, 'workflows');
    try {
      const workflowEntries = await fs.readdir(stagingWorkflowsDir, { withFileTypes: true });
      for (const entry of workflowEntries) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
        const targetPath = path.join(workflowsDir, entry.name);
        const exists = await fs.access(targetPath).then(() => true).catch(() => false);

        if (exists && !overwrite) {
          collisions.push(`workflows/${entry.name}`);
          continue;
        }

        await fs.copyFile(path.join(stagingWorkflowsDir, entry.name), targetPath);
        importedWorkflows++;
      }
    } catch {
      // No workflows directory in backup
    }

    // 6. Restore MCP configurations
    const stagingMcpServersFile = path.join(stagingDir, 'mcp', 'servers.json');
    try {
      const rawMcp = await fs.readFile(stagingMcpServersFile, 'utf8');
      const parsedMcp = JSON.parse(rawMcp);
      const incomingServers = parsedMcp.mcpServers || {};
      const currentRegistry = await loadMcpRegistry(customHome);

      for (const [name, manifest] of Object.entries(incomingServers)) {
        if (currentRegistry[name] && !overwrite) {
          collisions.push(`mcp/${name}`);
          continue;
        }
        currentRegistry[name] = manifest as any;
        importedMcpServers++;
      }

      await saveMcpRegistry(currentRegistry, customHome);
    } catch {
      // No MCP registry in backup
    }

    // 7. Restore local credentials if present and explicitly requested
    const stagingVaultDir = path.join(stagingDir, 'vault');
    try {
      const vaultExists = await fs.access(stagingVaultDir).then(() => true).catch(() => false);
      if (vaultExists && importSecrets) {
        const targetVaultDir = path.join(homeDir, 'vault');
        await fs.mkdir(targetVaultDir, { recursive: true, mode: 0o700 });
        const sourceSecrets = path.join(stagingVaultDir, 'secrets.json');
        const targetSecrets = path.join(targetVaultDir, 'secrets.json');
        await fs.copyFile(sourceSecrets, targetSecrets);
        try {
          await fs.chmod(targetSecrets, 0o600);
        } catch {
          // Best effort chmod
        }
      }
    } catch {
      // No vault directory in backup
    }

    // 8. Record transaction in journal
    await appendJournalEntry(
      {
        action: 'BACKUP_IMPORT',
        status: 'COMPLETED',
        originalPath: absArchivePath,
        centralPath: homeDir,
        symlinkPath: '',
        metadata: {
          importedSkills,
          importedWorkflows,
          importedMcpServers,
          collisions,
        },
      },
      journalPath
    );

    defaultLogger.info('Imported backup archive successfully', {
      importedSkills,
      importedWorkflows,
      importedMcpServers,
      collisionsCount: collisions.length,
    });

    return {
      success: true,
      importedCounts: {
        skills: importedSkills,
        workflows: importedWorkflows,
        mcpServers: importedMcpServers,
      },
      collisions,
      manifest,
    };
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
  }
}
