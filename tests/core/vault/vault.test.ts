import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { VaultManager, maskSecret } from '../../../src/core/vault/index.js';

describe('Local Credential Vault Manager', () => {
  let tempRoot: string;
  let fakeKoskillHome: string;
  let vault: VaultManager;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-vault-test-'));
    fakeKoskillHome = path.join(tempRoot, '.koskill');
    vault = new VaultManager({ customHome: fakeKoskillHome });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('initializes vault with directory mode 0700 and file mode 0600', async () => {
    await vault.init();

    const vaultDir = path.join(fakeKoskillHome, 'vault');
    const secretsFile = path.join(vaultDir, 'secrets.json');

    const dirStat = await fs.stat(vaultDir);
    const fileStat = await fs.stat(secretsFile);

    // Verify POSIX modes on non-Windows
    if (process.platform !== 'win32') {
      expect(dirStat.mode & 0o777).toBe(0o700);
      expect(fileStat.mode & 0o777).toBe(0o600);
    }

    const content = await fs.readFile(secretsFile, 'utf8');
    expect(JSON.parse(content)).toEqual({});
  });

  it('sets and gets secrets securely', async () => {
    await vault.setSecret('ANTHROPIC_API_KEY', 'sk-ant-api03-1234567890abcdef');

    const secret = await vault.getSecret('ANTHROPIC_API_KEY');
    expect(secret).toBe('sk-ant-api03-1234567890abcdef');

    const nonExistent = await vault.getSecret('UNKNOWN_KEY');
    expect(nonExistent).toBeUndefined();
  });

  it('lists stored secrets with masked previews without exposing plaintext', async () => {
    await vault.setSecret('OPENAI_API_KEY', 'sk-proj-abc123def456xyz789');
    await vault.setSecret('SHORT_PIN', '1234');

    const list = await vault.listSecrets();
    expect(list).toHaveLength(2);

    const openAiEntry = list.find((item) => item.key === 'OPENAI_API_KEY');
    expect(openAiEntry).toBeDefined();
    expect(openAiEntry?.maskedValue).toBe('sk-...z789');
    expect(openAiEntry?.maskedValue).not.toContain('def456');

    const shortEntry = list.find((item) => item.key === 'SHORT_PIN');
    expect(shortEntry?.maskedValue).toBe('****');
  });

  it('masks secret strings according to length rules', () => {
    expect(maskSecret('')).toBe('****');
    expect(maskSecret('secret')).toBe('****');
    expect(maskSecret('sk-1234567890')).toBe('sk-...7890');
    expect(maskSecret('ghp_abcdef1234567890xyz')).toBe('ghp...0xyz');
  });

  it('deletes secrets and updates storage atomically', async () => {
    await vault.setSecret('TEMP_KEY', 'some-secret-token-value');
    expect(await vault.getSecret('TEMP_KEY')).toBe('some-secret-token-value');

    const deleted = await vault.deleteSecret('TEMP_KEY');
    expect(deleted).toBe(true);
    expect(await vault.getSecret('TEMP_KEY')).toBeUndefined();

    const deleteAgain = await vault.deleteSecret('TEMP_KEY');
    expect(deleteAgain).toBe(false);
  });

  it('creates backup file .bak before updating secrets', async () => {
    await vault.setSecret('FIRST_KEY', 'first-value-12345');
    await vault.setSecret('SECOND_KEY', 'second-value-67890');

    const vaultDir = path.join(fakeKoskillHome, 'vault');
    const backupFile = path.join(vaultDir, 'secrets.json.bak');

    await expect(fs.access(backupFile)).resolves.toBeUndefined();
    const backupContent = await fs.readFile(backupFile, 'utf8');
    const parsedBackup = JSON.parse(backupContent);
    expect(parsedBackup['FIRST_KEY']).toBe('first-value-12345');
  });
});
