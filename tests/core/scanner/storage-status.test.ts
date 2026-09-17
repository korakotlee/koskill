import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { scanGeminiSkills } from '../../../src/core/scanner/gemini.js';

describe('Skill Storage Status Detection in Scanner', () => {
  let tempRoot: string;
  let skillsDir: string;
  let centralSkillsDir: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-scanner-storage-test-'));
    skillsDir = path.join(tempRoot, 'vendor-skills');
    centralSkillsDir = path.join(tempRoot, '.koskill', 'skills');

    await fs.mkdir(skillsDir, { recursive: true });
    await fs.mkdir(centralSkillsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('scans physical original skill with status original', async () => {
    const originalSkillDir = path.join(skillsDir, 'orig-skill');
    await fs.mkdir(originalSkillDir, { recursive: true });
    await fs.writeFile(
      path.join(originalSkillDir, 'SKILL.md'),
      '---\nname: orig-skill\ndescription: Original Skill\n---\nBody'
    );

    const scanned = await scanGeminiSkills(skillsDir, { customHome: path.join(tempRoot, '.koskill') });
    const found = scanned.find((s) => s.name === 'orig-skill');
    expect(found).toBeDefined();
    expect(found?.status).toBe('original');
  });

  it('scans symlinked skill directory with status symlinked and targetPath', async () => {
    // Create skill in central store
    const centralSkillDir = path.join(centralSkillsDir, 'centralized-skill');
    await fs.mkdir(centralSkillDir, { recursive: true });
    await fs.writeFile(
      path.join(centralSkillDir, 'SKILL.md'),
      '---\nname: centralized-skill\ndescription: Centralized Skill\n---\nBody'
    );

    // Symlink it into vendor skills dir
    const symlinkPath = path.join(skillsDir, 'centralized-skill');
    await fs.symlink(centralSkillDir, symlinkPath, 'dir');

    const scanned = await scanGeminiSkills(skillsDir, { customHome: path.join(tempRoot, '.koskill') });
    const found = scanned.find((s) => s.name === 'centralized-skill');
    expect(found).toBeDefined();
    expect(found?.status).toBe('symlinked');
    expect(found?.targetPath).toBe(centralSkillDir);
  });

  it('detects broken symlinks with status broken-link', async () => {
    const nonexistentTarget = path.join(tempRoot, 'ghost-skill');
    const symlinkPath = path.join(skillsDir, 'broken-skill');
    await fs.symlink(nonexistentTarget, symlinkPath, 'dir');

    const scanned = await scanGeminiSkills(skillsDir, { customHome: path.join(tempRoot, '.koskill') });
    const found = scanned.find((s) => s.name === 'broken-skill');
    expect(found).toBeDefined();
    expect(found?.status).toBe('broken-link');
  });
});
