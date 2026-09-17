/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { startServer, AppServer } from '../../../src/server/index.js';
import { calculateSha256 } from '../../../src/core/conflict/detector.js';

describe('Conflict REST API Routes', () => {
  let app: AppServer;
  let baseUrl: string;
  let tempDir: string;
  let skillFileA: string;
  let skillFileB: string;
  let hashA: string;
  let hashB: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-api-conflict-'));
    skillFileA = path.join(tempDir, 'gemini-skill', 'SKILL.md');
    skillFileB = path.join(tempDir, 'claude-skill', 'SKILL.md');

    await fs.mkdir(path.dirname(skillFileA), { recursive: true });
    await fs.mkdir(path.dirname(skillFileB), { recursive: true });

    const contentA = '# Commit Helper\n\nPrompt instructions A\n';
    const contentB = '# Commit Helper\n\nPrompt instructions B\n';

    await fs.writeFile(skillFileA, contentA, 'utf8');
    await fs.writeFile(skillFileB, contentB, 'utf8');

    hashA = calculateSha256(contentA);
    hashB = calculateSha256(contentB);

    app = await startServer(0);
    baseUrl = `http://127.0.0.1:${app.port}`;
  }, 30000);

  afterAll(async () => {
    await app.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('GET /api/conflicts', () => {
    it('returns HTTP 200 with structured conflict reports and count', async () => {
      const res = await fetch(`${baseUrl}/api/conflicts`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty('success', true);
      expect(json).toHaveProperty('count');
      expect(json).toHaveProperty('conflicts');
      expect(Array.isArray(json.conflicts)).toBe(true);
    });
  });

  describe('POST /api/conflicts/resolve', () => {
    it('returns 400 if conflictId or action is missing', async () => {
      const res = await fetch(`${baseUrl}/api/conflicts/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toHaveProperty('error');
    });

    it('returns 409 if CAS hash verification fails due to stale hash', async () => {
      const res = await fetch(`${baseUrl}/api/conflicts/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conflictId: 'test-conflict-stale',
          action: 'PICK',
          winnerId: 'item-1',
          items: [
            {
              id: 'item-1',
              name: 'Item 1',
              ecosystem: 'gemini',
              sourcePath: skillFileA,
              contentHash: 'stale-hash-value',
            },
          ],
          expectedHashes: {
            'item-1': 'expected-different-hash',
          },
        }),
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('E_STALE_HASH');
    });

    it('returns 200 and performs atomic resolution for valid payload', async () => {
      const res = await fetch(`${baseUrl}/api/conflicts/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conflictId: 'test-conflict-valid',
          action: 'PICK',
          winnerId: 'item-1',
          items: [
            {
              id: 'item-1',
              name: 'Item 1',
              ecosystem: 'gemini',
              sourcePath: skillFileA,
              contentHash: hashA,
            },
            {
              id: 'item-2',
              name: 'Item 2',
              ecosystem: 'claude',
              sourcePath: skillFileB,
              contentHash: hashB,
            },
          ],
          expectedHashes: {
            'item-1': hashA,
            'item-2': hashB,
          },
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.action).toBe('PICK');
      expect(json.message).toContain('Conflict resolved');
    });
  });
});
