import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  getKoskillHomeDir,
  getKoskillSkillsDir,
  getKoskillWorkflowsDir,
  getKoskillMcpDir,
  getKoskillJournalPath,
  getSkillCentralPath,
  getWorkflowCentralPath,
  initCentralStore,
} from '../../../src/core/storage/store.js';

describe('Central Store Core Infrastructure', () => {
  let testTempDir: string;

  beforeEach(async () => {
    testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-store-test-'));
  });

  afterEach(async () => {
    await fs.rm(testTempDir, { recursive: true, force: true });
  });

  it('resolves default storage paths based on home or custom root', () => {
    const home = getKoskillHomeDir(testTempDir);
    expect(home).toBe(testTempDir);

    const skillsDir = getKoskillSkillsDir(testTempDir);
    expect(skillsDir).toBe(path.join(testTempDir, 'skills'));

    const mcpDir = getKoskillMcpDir(testTempDir);
    expect(mcpDir).toBe(path.join(testTempDir, 'mcp'));

    const journalPath = getKoskillJournalPath(testTempDir);
    expect(journalPath).toBe(path.join(testTempDir, 'journal.json'));

    const skillPath = getSkillCentralPath('web-search', testTempDir);
    expect(skillPath).toBe(path.join(testTempDir, 'skills', 'web-search'));

    const workflowPath = getWorkflowCentralPath('commit', testTempDir);
    expect(workflowPath).toBe(path.join(testTempDir, 'workflows', 'commit.md'));
  });

  it('initializes central store layout with skills, workflows, and mcp directories', async () => {
    const res = await initCentralStore(testTempDir);

    expect(res.skillsDir).toBe(path.join(testTempDir, 'skills'));
    expect(res.workflowsDir).toBe(path.join(testTempDir, 'workflows'));
    expect(res.mcpDir).toBe(path.join(testTempDir, 'mcp'));
    expect(res.journalPath).toBe(path.join(testTempDir, 'journal.json'));

    const skillsStat = await fs.stat(res.skillsDir);
    expect(skillsStat.isDirectory()).toBe(true);

    const workflowsStat = await fs.stat(res.workflowsDir);
    expect(workflowsStat.isDirectory()).toBe(true);

    const mcpStat = await fs.stat(res.mcpDir);
    expect(mcpStat.isDirectory()).toBe(true);
  });

  it('is idempotent when initializing existing store layout', async () => {
    await initCentralStore(testTempDir);
    // Call again on existing directory
    const secondCall = await initCentralStore(testTempDir);
    expect(secondCall.skillsDir).toBe(path.join(testTempDir, 'skills'));
  });
});
