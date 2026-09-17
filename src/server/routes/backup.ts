import http from 'http';
import * as path from 'node:path';
import { exportBackup } from '../../core/backup/exporter.js';
import { importBackup } from '../../core/backup/importer.js';
import { getKoskillHomeDir } from '../../core/storage/store.js';
import { defaultLogger } from '../../core/logger.js';

/**
 * Parses JSON request payload safely.
 */
async function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * Handles backup export and restore endpoints.
 */
export async function handleBackupRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<boolean> {
  // POST /api/backup/export
  if (req.method === 'POST' && url.pathname === '/api/backup/export') {
    try {
      const body = await parseJsonBody(req);
      const customHome = process.env.KOSKILL_HOME;
      const defaultOutputPath = path.join(
        getKoskillHomeDir(customHome),
        'backups',
        `koskill-backup-${Date.now()}.tar.gz`
      );

      const outputPath = body?.outputPath || defaultOutputPath;
      const result = await exportBackup({
        outputPath,
        customHome,
        includeSecrets: Boolean(body?.includeSecrets),
        notes: body?.notes,
      });

      res.writeHead(200);
      res.end(JSON.stringify(result));
      return true;
    } catch (err: any) {
      defaultLogger.error('Backup export error', { error: err.message });
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message || 'Backup export failed' }));
      return true;
    }
  }

  // POST /api/backup/import
  if (req.method === 'POST' && url.pathname === '/api/backup/import') {
    try {
      const body = await parseJsonBody(req);
      if (!body?.archivePath) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'archivePath is required for backup import' }));
        return true;
      }

      const customHome = process.env.KOSKILL_HOME;
      const result = await importBackup({
        archivePath: body.archivePath,
        customHome,
        overwrite: Boolean(body.overwrite),
        importSecrets: Boolean(body.importSecrets),
      });

      res.writeHead(200);
      res.end(JSON.stringify(result));
      return true;
    } catch (err: any) {
      defaultLogger.error('Backup import error', { error: err.message });
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message || 'Backup import failed' }));
      return true;
    }
  }

  return false;
}
