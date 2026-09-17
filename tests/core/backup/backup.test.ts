import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { exportBackup } from '../../../src/core/backup/exporter.js';
import { importBackup, validateArchiveEntries } from '../../../src/core/backup/importer.js';
import { VaultManager } from '../../../src/core/vault/index.js';
import { saveMcpRegistry } from '../../../src/core/storage/mcp-store.js';

describe('Machine-to-Machine Backup & Restore Engine', () => {
  let tempRoot: string;
  let sourceHome: string;
  let targetHome: string;
  let backupFile: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-backup-test-'));
    sourceHome = path.join(tempRoot, 'source-koskill');
    targetHome = path.join(tempRoot, 'target-koskill');
    backupFile = path.join(tempRoot, 'backup.tar.gz');

    // Create source structure
    await fs.mkdir(path.join(sourceHome, 'skills', 'my-skill'), { recursive: true });
    await fs.writeFile(
      path.join(sourceHome, 'skills', 'my-skill', 'SKILL.md'),
      '# My Skill Content',
      'utf8'
    );

    await fs.mkdir(path.join(sourceHome, 'workflows'), { recursive: true });
    await fs.writeFile(
      path.join(sourceHome, 'workflows', 'deploy.md'),
      '# Deploy Workflow',
      'utf8'
    );

    await saveMcpRegistry(
      {
        'github-mcp': {
          id: 'mcp:github-mcp',
          name: 'github-mcp',
          transport: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-github'],
          declaredToolsCount: 4,
          enabled: true,
        },
      },
      sourceHome
    );

    // Create a secret in source vault
    const vault = new VaultManager({ customHome: sourceHome });
    await vault.setSecret('API_KEY', 'secret-key-12345');
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('exports backup bundle excluding secrets by default', async () => {
    const exportRes = await exportBackup({
      outputPath: backupFile,
      customHome: sourceHome,
      includeSecrets: false,
    });

    expect(exportRes.success).toBe(true);
    expect(exportRes.sizeBytes).toBeGreaterThan(0);
    expect(exportRes.manifest.entityCounts.skills).toBe(1);
    expect(exportRes.manifest.entityCounts.workflows).toBe(1);
    expect(exportRes.manifest.entityCounts.mcpServers).toBe(1);
    expect(exportRes.manifest.includedSecrets).toBe(false);

    // Verify file exists
    await expect(fs.access(backupFile)).resolves.toBeUndefined();
  });

  it('restores backup bundle into target home successfully', async () => {
    await exportBackup({
      outputPath: backupFile,
      customHome: sourceHome,
    });

    const importRes = await importBackup({
      archivePath: backupFile,
      customHome: targetHome,
    });

    expect(importRes.success).toBe(true);
    expect(importRes.importedCounts.skills).toBe(1);
    expect(importRes.importedCounts.workflows).toBe(1);
    expect(importRes.importedCounts.mcpServers).toBe(1);
    expect(importRes.collisions).toHaveLength(0);

    // Verify extracted skill exists in targetHome
    const extractedSkill = path.join(targetHome, 'skills', 'my-skill', 'SKILL.md');
    const skillContent = await fs.readFile(extractedSkill, 'utf8');
    expect(skillContent).toBe('# My Skill Content');

    // Verify secret was NOT imported
    const targetVault = new VaultManager({ customHome: targetHome });
    const secret = await targetVault.getSecret('API_KEY');
    expect(secret).toBeUndefined();
  });

  it('detects and flags collisions without overwriting when overwrite is false', async () => {
    await exportBackup({
      outputPath: backupFile,
      customHome: sourceHome,
    });

    // Create colliding item in target
    await fs.mkdir(path.join(targetHome, 'skills', 'my-skill'), { recursive: true });
    await fs.writeFile(
      path.join(targetHome, 'skills', 'my-skill', 'SKILL.md'),
      '# Original Pre-existing Content',
      'utf8'
    );

    const importRes = await importBackup({
      archivePath: backupFile,
      customHome: targetHome,
      overwrite: false,
    });

    expect(importRes.success).toBe(true);
    expect(importRes.collisions).toContain('skills/my-skill');

    // Verify original was preserved
    const skillContent = await fs.readFile(
      path.join(targetHome, 'skills', 'my-skill', 'SKILL.md'),
      'utf8'
    );
    expect(skillContent).toBe('# Original Pre-existing Content');
  });

  it('validates archive entries and detects tar-slip traversal attacks', () => {
    const maliciousEntries = [
      'backup-manifest.json',
      'skills/clean-skill/SKILL.md',
      '../../etc/passwd',
      'skills/../../../malicious.sh',
      '/absolute/path/exploit',
    ];

    const safeDest = '/Users/test/.koskill';
    const validation = validateArchiveEntries(maliciousEntries, safeDest);

    expect(validation.isValid).toBe(false);
    expect(validation.traversalEntries).toHaveLength(3);
    expect(validation.traversalEntries).toContain('../../etc/passwd');
    expect(validation.traversalEntries).toContain('skills/../../../malicious.sh');
    expect(validation.traversalEntries).toContain('/absolute/path/exploit');
  });
});
