/**
 * Manifest record embedded inside every backup tarball.
 */
export interface BackupManifest {
  version: string;
  createdAt: string;
  entityCounts: {
    skills: number;
    workflows: number;
    mcpServers: number;
  };
  includedSecrets: boolean;
  notes?: string;
}

/**
 * Options for creating an export backup archive.
 */
export interface ExportBackupOptions {
  outputPath: string;
  customHome?: string;
  includeSecrets?: boolean;
  notes?: string;
}

/**
 * Result details returned after creating a backup archive.
 */
export interface ExportBackupResult {
  success: boolean;
  archivePath: string;
  manifest: BackupManifest;
  sizeBytes: number;
  message?: string;
}

/**
 * Options for extracting and applying a backup archive.
 */
export interface ImportBackupOptions {
  archivePath: string;
  customHome?: string;
  overwrite?: boolean;
  importSecrets?: boolean;
}

/**
 * Result details returned after restoring a backup archive.
 */
export interface ImportBackupResult {
  success: boolean;
  importedCounts: {
    skills: number;
    workflows: number;
    mcpServers: number;
  };
  collisions: string[];
  manifest?: BackupManifest;
  message?: string;
}
