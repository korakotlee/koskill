import { useState, useCallback } from 'react';

/**
 * Custom hook providing state and operations for backup/restore and credential vault.
 */
export function useBackupAndVault(onRefresh?: () => Promise<void>) {
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [vaultSecrets, setVaultSecrets] = useState<Array<{ key: string; maskedValue: string }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [backupError, setBackupError] = useState<string | undefined>();
  const [backupSuccess, setBackupSuccess] = useState<string | undefined>();
  const [vaultError, setVaultError] = useState<string | undefined>();
  const [vaultSuccess, setVaultSuccess] = useState<string | undefined>();

  const fetchSecrets = useCallback(async () => {
    try {
      const res = await fetch('/api/vault');
      if (res.ok) {
        const data = await res.json();
        setVaultSecrets(data.secrets || []);
      }
    } catch {
      // Fallback in mock/test mode
    }
  }, []);

  const handleExportBackup = async (includeSecrets: boolean) => {
    setIsProcessing(true);
    setBackupError(undefined);
    setBackupSuccess(undefined);
    try {
      const res = await fetch('/api/backup/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeSecrets }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Export failed');
      setBackupSuccess(`Backup exported: ${data.archivePath} (${data.sizeBytes} bytes)`);
    } catch (err: any) {
      setBackupError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportBackup = async (archivePath: string, overwrite: boolean) => {
    setIsProcessing(true);
    setBackupError(undefined);
    setBackupSuccess(undefined);
    try {
      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivePath, overwrite }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setBackupSuccess(
        `Imported: ${data.importedCounts.skills} skills, ${data.importedCounts.workflows} workflows, ${data.importedCounts.mcpServers} MCP servers.`
      );
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      setBackupError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveSecret = async (key: string, value: string) => {
    setVaultError(undefined);
    setVaultSuccess(undefined);
    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save secret');
      setVaultSuccess(`Stored secret for ${key}`);
      await fetchSecrets();
    } catch (err: any) {
      setVaultError(err.message);
    }
  };

  return {
    isBackupOpen,
    setIsBackupOpen,
    isVaultOpen,
    setIsVaultOpen,
    vaultSecrets,
    fetchSecrets,
    isProcessing,
    backupError,
    backupSuccess,
    vaultError,
    vaultSuccess,
    handleExportBackup,
    handleImportBackup,
    handleSaveSecret,
  };
}
