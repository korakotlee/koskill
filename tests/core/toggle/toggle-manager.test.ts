import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { toggleEntity, getEntityToggleStatus } from '../../../src/core/toggle/toggle-manager.js';
import { readJournal } from '../../../src/core/storage/journal.js';
import { saveMcpRegistry } from '../../../src/core/storage/mcp-store.js';
import { McpServerManifest } from '../../../src/core/types.js';

describe('Filesystem-Level Activation Toggle Manager', () => {
  let tempRoot: string;
  let fakeKoskillHome: string;
  let skillsDir: string;
  let workflowsDir: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-toggle-test-'));
    fakeKoskillHome = path.join(tempRoot, '.koskill');
    skillsDir = path.join(tempRoot, 'skills');
    workflowsDir = path.join(tempRoot, 'workflows');

    await fs.mkdir(fakeKoskillHome, { recursive: true });
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.mkdir(workflowsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  describe('Skill Toggling', () => {
    it('deactivates an active skill directory by renaming to .disabled', async () => {
      const skillPath = path.join(skillsDir, 'test-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), '# Test Skill', 'utf8');

      // Check initially active
      const initialStatus = await getEntityToggleStatus({
        entityType: 'skills',
        id: 'test-skill',
        targetPath: skillPath,
        customHome: fakeKoskillHome,
      });
      expect(initialStatus.enabled).toBe(true);

      // Deactivate
      const deactivateRes = await toggleEntity({
        entityType: 'skills',
        id: 'test-skill',
        targetPath: skillPath,
        customHome: fakeKoskillHome,
      });

      expect(deactivateRes.success).toBe(true);
      expect(deactivateRes.enabled).toBe(false);
      expect(deactivateRes.status).toBe('inactive');

      // Check filesystem
      await expect(fs.access(skillPath)).rejects.toThrow();
      await expect(fs.access(`${skillPath}.disabled`)).resolves.toBeUndefined();

      // Check journal was updated
      const journal = await readJournal(path.join(fakeKoskillHome, 'journal.json'));
      expect(journal.length).toBeGreaterThan(0);
      expect(journal[journal.length - 1].action).toBe('TOGGLE');
      expect(journal[journal.length - 1].status).toBe('COMPLETED');
    });

    it('reactivates a disabled skill directory by removing .disabled suffix', async () => {
      const skillPath = path.join(skillsDir, 'test-skill');
      const disabledSkillPath = `${skillPath}.disabled`;
      await fs.mkdir(disabledSkillPath, { recursive: true });
      await fs.writeFile(path.join(disabledSkillPath, 'SKILL.md'), '# Test Skill', 'utf8');

      const activateRes = await toggleEntity({
        entityType: 'skills',
        id: 'test-skill',
        targetPath: skillPath,
        customHome: fakeKoskillHome,
      });

      expect(activateRes.success).toBe(true);
      expect(activateRes.enabled).toBe(true);
      expect(activateRes.status).not.toBe('inactive');

      // Verify files restored
      await expect(fs.access(skillPath)).resolves.toBeUndefined();
      await expect(fs.access(disabledSkillPath)).rejects.toThrow();
    });

    it('handles explicit enabled target states', async () => {
      const skillPath = path.join(skillsDir, 'explicit-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), '# Explicit Skill', 'utf8');

      // Setting enabled: true when already true should be idempotent
      const noOpRes = await toggleEntity({
        entityType: 'skills',
        id: 'explicit-skill',
        targetPath: skillPath,
        enabled: true,
        customHome: fakeKoskillHome,
      });
      expect(noOpRes.success).toBe(true);
      expect(noOpRes.enabled).toBe(true);
      await expect(fs.access(skillPath)).resolves.toBeUndefined();

      // Explicitly set enabled: false
      const disableRes = await toggleEntity({
        entityType: 'skills',
        id: 'explicit-skill',
        targetPath: skillPath,
        enabled: false,
        customHome: fakeKoskillHome,
      });
      expect(disableRes.success).toBe(true);
      expect(disableRes.enabled).toBe(false);
      await expect(fs.access(`${skillPath}.disabled`)).resolves.toBeUndefined();
    });
  });

  describe('Workflow Toggling', () => {
    it('toggles a workflow file by appending and removing .disabled suffix', async () => {
      const workflowPath = path.join(workflowsDir, 'commit.md');
      await fs.writeFile(workflowPath, '# Commit Workflow', 'utf8');

      // Deactivate
      const deactivateRes = await toggleEntity({
        entityType: 'workflows',
        id: 'commit',
        targetPath: workflowPath,
        customHome: fakeKoskillHome,
      });

      expect(deactivateRes.success).toBe(true);
      expect(deactivateRes.enabled).toBe(false);
      await expect(fs.access(workflowPath)).rejects.toThrow();
      await expect(fs.access(`${workflowPath}.disabled`)).resolves.toBeUndefined();

      // Reactivate
      const reactivateRes = await toggleEntity({
        entityType: 'workflows',
        id: 'commit',
        targetPath: workflowPath,
        customHome: fakeKoskillHome,
      });

      expect(reactivateRes.success).toBe(true);
      expect(reactivateRes.enabled).toBe(true);
      await expect(fs.access(workflowPath)).resolves.toBeUndefined();
      await expect(fs.access(`${workflowPath}.disabled`)).rejects.toThrow();
    });
  });

  describe('MCP Server Toggling', () => {
    it('toggles an MCP server enabled state in central registry', async () => {
      const mockManifest: McpServerManifest = {
        id: 'mcp:test-server',
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
        declaredToolsCount: 2,
        enabled: true,
      };

      await saveMcpRegistry({ 'test-server': mockManifest }, fakeKoskillHome);

      // Toggle off
      const toggleOffRes = await toggleEntity({
        entityType: 'mcp-servers',
        id: 'test-server',
        customHome: fakeKoskillHome,
      });

      expect(toggleOffRes.success).toBe(true);
      expect(toggleOffRes.enabled).toBe(false);

      // Toggle back on
      const toggleOnRes = await toggleEntity({
        entityType: 'mcp-servers',
        id: 'test-server',
        customHome: fakeKoskillHome,
      });

      expect(toggleOnRes.success).toBe(true);
      expect(toggleOnRes.enabled).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('returns error when target entity does not exist', async () => {
      const nonExistentPath = path.join(skillsDir, 'does-not-exist');
      const res = await toggleEntity({
        entityType: 'skills',
        id: 'does-not-exist',
        targetPath: nonExistentPath,
        customHome: fakeKoskillHome,
      });

      expect(res.success).toBe(false);
      expect(res.message).toMatch(/not found/i);
    });
  });
});
