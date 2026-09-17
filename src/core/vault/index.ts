import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { getKoskillHomeDir } from '../storage/store.js';
import { defaultLogger } from '../logger.js';
import { VaultOptions, VaultKeySummary } from './types.js';

export * from './types.js';

/**
 * Masks a sensitive string preview for safe public rendering.
 * Values shorter than 8 characters or empty strings return '****'.
 * Longer strings preserve the first 3 and last 4 characters.
 */
export function maskSecret(value: string): string {
  if (!value || value.length < 8) {
    return '****';
  }
  const prefix = value.slice(0, 3);
  const suffix = value.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Manages local credential storage under `~/.koskill/vault/` with POSIX 0600 isolation.
 */
export class VaultManager {
  private customHome?: string;

  constructor(options?: VaultOptions) {
    this.customHome = options?.customHome;
  }

  /**
   * Resolves the vault root directory (`~/.koskill/vault`).
   */
  getVaultDir(): string {
    return path.join(getKoskillHomeDir(this.customHome), 'vault');
  }

  /**
   * Resolves the primary secrets storage file path (`~/.koskill/vault/secrets.json`).
   */
  getSecretsPath(): string {
    return path.join(this.getVaultDir(), 'secrets.json');
  }

  /**
   * Resolves the secrets backup file path (`~/.koskill/vault/secrets.json.bak`).
   */
  getSecretsBackupPath(): string {
    return path.join(this.getVaultDir(), 'secrets.json.bak');
  }

  /**
   * Initializes vault directories and secret store with strict POSIX permissions.
   */
  async init(): Promise<void> {
    const vaultDir = this.getVaultDir();
    const secretsPath = this.getSecretsPath();

    await fs.mkdir(vaultDir, { recursive: true, mode: 0o700 });
    try {
      await fs.chmod(vaultDir, 0o700);
    } catch {
      // Best effort on platforms that don't support chmod
    }

    try {
      await fs.access(secretsPath);
    } catch {
      await this.writeSecretsAtomically({});
    }
  }

  /**
   * Loads the current secrets dictionary from disk.
   */
  private async loadSecrets(): Promise<Record<string, string>> {
    const secretsPath = this.getSecretsPath();
    try {
      const raw = await fs.readFile(secretsPath, 'utf8');
      return JSON.parse(raw);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return {};
      }
      defaultLogger.warn('Failed to parse secrets file, attempting backup recovery', { error: err.message });
      try {
        const backupRaw = await fs.readFile(this.getSecretsBackupPath(), 'utf8');
        return JSON.parse(backupRaw);
      } catch {
        return {};
      }
    }
  }

  /**
   * Writes the secrets dictionary to disk atomically with permissions 0600.
   */
  private async writeSecretsAtomically(data: Record<string, string>): Promise<void> {
    const vaultDir = this.getVaultDir();
    const secretsPath = this.getSecretsPath();
    const backupPath = this.getSecretsBackupPath();

    await fs.mkdir(vaultDir, { recursive: true, mode: 0o700 });
    try {
      await fs.chmod(vaultDir, 0o700);
    } catch {
      // Best-effort chmod
    }

    // Preserve previous copy as .bak if it exists
    try {
      await fs.access(secretsPath);
      await fs.copyFile(secretsPath, backupPath);
      try {
        await fs.chmod(backupPath, 0o600);
      } catch {
        // Best-effort chmod
      }
    } catch {
      // Secrets file does not exist yet
    }

    const tempFile = path.join(vaultDir, `secrets.${crypto.randomBytes(4).toString('hex')}.tmp`);
    await fs.writeFile(tempFile, JSON.stringify(data, null, 2), { mode: 0o600, encoding: 'utf8' });
    try {
      await fs.chmod(tempFile, 0o600);
    } catch {
      // Best-effort chmod
    }

    await fs.rename(tempFile, secretsPath);
    try {
      await fs.chmod(secretsPath, 0o600);
    } catch {
      // Best-effort chmod
    }
  }

  /**
   * Retrieves a secret value by key strictly in memory.
   */
  async getSecret(key: string): Promise<string | undefined> {
    await this.init();
    const secrets = await this.loadSecrets();
    return secrets[key];
  }

  /**
   * Stores or updates a credential in the local vault.
   */
  async setSecret(key: string, value: string): Promise<void> {
    await this.init();
    const secrets = await this.loadSecrets();
    secrets[key] = value;
    await this.writeSecretsAtomically(secrets);
    defaultLogger.info('Stored credential in local vault', { key });
  }

  /**
   * Deletes a credential from the vault.
   */
  async deleteSecret(key: string): Promise<boolean> {
    await this.init();
    const secrets = await this.loadSecrets();
    if (!(key in secrets)) {
      return false;
    }
    delete secrets[key];
    await this.writeSecretsAtomically(secrets);
    defaultLogger.info('Deleted credential from local vault', { key });
    return true;
  }

  /**
   * Returns a list of stored credential keys with masked preview strings.
   */
  async listSecrets(): Promise<VaultKeySummary[]> {
    await this.init();
    const secrets = await this.loadSecrets();
    return Object.entries(secrets).map(([key, val]) => ({
      key,
      maskedValue: maskSecret(val),
    }));
  }
}
