import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  centralizeSkill,
  revertSkill,
  getSkillStorageStatus,
} from '../../../src/core/storage/symlink-manager.js';
import { readJournal } from '../../../src/core/storage/journal.js';

describe('Symlink Manager Lifecycle', () => {
  let tempRoot: string;
  let fakeKoskillHome: string;
  let fakeVendorSkillsDir: string;
  let testSkillDir: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-symlink-test-'));
    fakeKoskillHome = path.join(tempRoot, '.koskill');
    fakeVendorSkillsDir = path.join(tempRoot, '.gemini', 'skills');
    testSkillDir = path.join(fakeVendorSkillsDir, 'test-skill');

    await fs.mkdir(testSkillDir, { recursive: true });
    await fs.writeFile(
      path.join(testSkillDir, 'SKILL.md'),
      '# Test Skill\n\nInstructions here.',
      'utf8'
    );
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('detects original physical directory status initially', async () => {
    const res = await getSkillStorageStatus(testSkillDir, fakeKoskillHome);
    expect(res.status).toBe('original');
  });

  it('centralizes skill: moves to central store, generates valid symlink, and journals', async () => {
    const result = await centralizeSkill({
      skillId: 'gemini:test-skill',
      skillName: 'test-skill',
      sourcePath: testSkillDir,
      customHome: fakeKoskillHome,
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('symlinked');
    expect(result.centralPath).toBe(path.join(fakeKoskillHome, 'skills', 'test-skill'));

    // Check original location is a symlink
    const lstat = await fs.lstat(testSkillDir);
    expect(lstat.isSymbolicLink()).toBe(true);

    // Verify reading content through symlink works transparently
    const contentThroughLink = await fs.readFile(path.join(testSkillDir, 'SKILL.md'), 'utf8');
    expect(contentThroughLink).toContain('# Test Skill');

    // Verify central store contains files
    const centralContent = await fs.readFile(
      path.join(result.centralPath, 'SKILL.md'),
      'utf8'
    );
    expect(centralContent).toContain('# Test Skill');

    // Verify status now reports symlinked
    const statusCheck = await getSkillStorageStatus(testSkillDir, fakeKoskillHome);
    expect(statusCheck.status).toBe('symlinked');

    // Verify journal
    const journal = await readJournal(path.join(fakeKoskillHome, 'journal.json'));
    expect(journal.length).toBe(1);
    expect(journal[0].action).toBe('CENTRALIZE');
    expect(journal[0].status).toBe('COMPLETED');
  });

  it('reverts centralized skill back to original physical directory', async () => {
    // First centralize
    await centralizeSkill({
      skillId: 'gemini:test-skill',
      skillName: 'test-skill',
      sourcePath: testSkillDir,
      customHome: fakeKoskillHome,
    });

    // Now revert
    const revertResult = await revertSkill({
      skillId: 'gemini:test-skill',
      skillName: 'test-skill',
      sourcePath: testSkillDir,
      customHome: fakeKoskillHome,
    });

    expect(revertResult.success).toBe(true);
    expect(revertResult.status).toBe('original');

    // Verify original location is a physical directory, not a symlink
    const lstat = await fs.lstat(testSkillDir);
    expect(lstat.isSymbolicLink()).toBe(false);
    expect(lstat.isDirectory()).toBe(true);

    // Verify content still exists
    const restoredContent = await fs.readFile(path.join(testSkillDir, 'SKILL.md'), 'utf8');
    expect(restoredContent).toContain('# Test Skill');

    // Verify central store directory was cleaned up
    const centralExists = await fs
      .stat(path.join(fakeKoskillHome, 'skills', 'test-skill'))
      .then(() => true)
      .catch(() => false);
    expect(centralExists).toBe(false);

    // Verify journal
    const journal = await readJournal(path.join(fakeKoskillHome, 'journal.json'));
    expect(journal.length).toBe(2);
    expect(journal[1].action).toBe('REVERT');
    expect(journal[1].status).toBe('COMPLETED');
  });

  it('rejects centralizing an already symlinked skill', async () => {
    await centralizeSkill({
      skillId: 'gemini:test-skill',
      skillName: 'test-skill',
      sourcePath: testSkillDir,
      customHome: fakeKoskillHome,
    });

    await expect(
      centralizeSkill({
        skillId: 'gemini:test-skill',
        skillName: 'test-skill',
        sourcePath: testSkillDir,
        customHome: fakeKoskillHome,
      })
    ).rejects.toThrow(/already symlinked|already centralized/i);
  });

  it('rejects reverting an original physical directory', async () => {
    await expect(
      revertSkill({
        skillId: 'gemini:test-skill',
        skillName: 'test-skill',
        sourcePath: testSkillDir,
        customHome: fakeKoskillHome,
      })
    ).rejects.toThrow(/not a symbolic link/i);
  });
});
