/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { startServer, AppServer } from '../../../src/server/index.js';

describe('Backup REST API Routes', () => {
  let app: AppServer;
  let baseUrl: string;
  let tempDir: string;
  let fakeKoskillHome: string;
  let targetExportPath: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-api-backup-'));
    fakeKoskillHome = path.join(tempDir, '.koskill');
    process.env.KOSKILL_HOME = fakeKoskillHome;

    const skillsDir = path.join(fakeKoskillHome, 'skills', 'backup-skill');
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(path.join(skillsDir, 'SKILL.md'), '# Backup Skill', 'utf8');

    targetExportPath = path.join(tempDir, 'exported.tar.gz');

    app = await startServer(0);
    baseUrl = `http://127.0.0.1:${app.port}`;
  }, 30000);

  afterAll(async () => {
    await app.close();
    delete process.env.KOSKILL_HOME;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('exports backup bundle via POST /api/backup/export', async () => {
    const res = await fetch(`${baseUrl}/api/backup/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outputPath: targetExportPath,
        notes: 'Integration test backup',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.archivePath).toBe(targetExportPath);
    expect(body.sizeBytes).toBeGreaterThan(0);
    expect(body.manifest.entityCounts.skills).toBe(1);

    await expect(fs.access(targetExportPath)).resolves.toBeUndefined();
  });

  it('imports backup archive via POST /api/backup/import', async () => {
    // Import the exported backup
    const res = await fetch(`${baseUrl}/api/backup/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        archivePath: targetExportPath,
        overwrite: true,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.importedCounts.skills).toBe(1);
  });

  it('returns 400 when archivePath is missing in import', async () => {
    const res = await fetch(`${baseUrl}/api/backup/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/archivePath is required/i);
  });
});
