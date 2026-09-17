/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { startServer, AppServer } from '../../../src/server/index.js';
import { saveMcpRegistry } from '../../../src/core/storage/mcp-store.js';

describe('Unified Toggle REST API Route', () => {
  let app: AppServer;
  let baseUrl: string;
  let tempDir: string;
  let fakeKoskillHome: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-api-toggle-'));
    fakeKoskillHome = path.join(tempDir, '.koskill');
    process.env.KOSKILL_HOME = fakeKoskillHome;

    app = await startServer(0);
    baseUrl = `http://127.0.0.1:${app.port}`;
  }, 30000);

  afterAll(async () => {
    await app.close();
    delete process.env.KOSKILL_HOME;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('rejects unsupported entity types with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/unsupported-type/item1/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unsupported/i);
  });

  it('toggles an MCP server state via POST /api/mcp-servers/:id/toggle', async () => {
    await saveMcpRegistry(
      {
        'sample-mcp': {
          id: 'mcp:sample-mcp',
          name: 'sample-mcp',
          transport: 'stdio',
          command: 'node',
          args: ['index.js'],
          declaredToolsCount: 1,
          enabled: true,
        },
      },
      fakeKoskillHome
    );

    // Toggle off
    const resOff = await fetch(`${baseUrl}/api/mcp-servers/sample-mcp/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });

    expect(resOff.status).toBe(200);
    const bodyOff = await resOff.json();
    expect(bodyOff.success).toBe(true);
    expect(bodyOff.enabled).toBe(false);

    // Toggle on
    const resOn = await fetch(`${baseUrl}/api/mcp-servers/sample-mcp/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });

    expect(resOn.status).toBe(200);
    const bodyOn = await resOn.json();
    expect(bodyOn.success).toBe(true);
    expect(bodyOn.enabled).toBe(true);
  });

  it('toggles a skill directory via POST /api/skills/:id/toggle', async () => {
    const skillsDir = path.join(fakeKoskillHome, 'skills');
    const skillPath = path.join(skillsDir, 'api-skill');
    await fs.mkdir(skillPath, { recursive: true });
    await fs.writeFile(path.join(skillPath, 'SKILL.md'), '# API Skill', 'utf8');

    // Toggle off
    const resOff = await fetch(`${baseUrl}/api/skills/api-skill/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath: skillPath }),
    });

    expect(resOff.status).toBe(200);
    const bodyOff = await resOff.json();
    expect(bodyOff.success).toBe(true);
    expect(bodyOff.enabled).toBe(false);

    // Verify file renamed to .disabled
    await expect(fs.access(`${skillPath}.disabled`)).resolves.toBeUndefined();
  });
});
