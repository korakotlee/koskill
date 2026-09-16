import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { scanGeminiSkills, scanGeminiMcp } from '../../../src/core/scanner/gemini.js';

describe('Gemini Scanner', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-gemini-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('scanGeminiSkills', () => {
    it('discovers skills with YAML frontmatter from skills directory', async () => {
      const skillsDir = path.join(tempDir, 'skills');
      const sampleSkillDir = path.join(skillsDir, 'sample-skill');
      await fs.mkdir(sampleSkillDir, { recursive: true });

      const skillContent = `---
name: sample-skill
description: A sample test skill for testing
---
# Sample Skill Instructions
Follow these steps.`;

      await fs.writeFile(path.join(sampleSkillDir, 'SKILL.md'), skillContent, 'utf-8');

      const skills = await scanGeminiSkills(skillsDir);
      expect(skills).toHaveLength(1);
      expect(skills[0]).toMatchObject({
        id: 'gemini:sample-skill',
        name: 'sample-skill',
        description: 'A sample test skill for testing',
        targetEcosystem: 'gemini',
        status: 'original',
        rawContent: skillContent
      });
      expect(skills[0].sourcePath).toBe(path.join(sampleSkillDir, 'SKILL.md'));
    });

    it('falls back to directory name when frontmatter is missing', async () => {
      const skillsDir = path.join(tempDir, 'skills');
      const plainSkillDir = path.join(skillsDir, 'plain-tool');
      await fs.mkdir(plainSkillDir, { recursive: true });

      const skillContent = `# Plain Tool\nSimple markdown without frontmatter.`;
      await fs.writeFile(path.join(plainSkillDir, 'SKILL.md'), skillContent, 'utf-8');

      const skills = await scanGeminiSkills(skillsDir);
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('plain-tool');
      expect(skills[0].description).toBe('Simple markdown without frontmatter.');
    });

    it('returns empty array when directory does not exist', async () => {
      const nonExistent = path.join(tempDir, 'non-existent');
      const skills = await scanGeminiSkills(nonExistent);
      expect(skills).toEqual([]);
    });
  });

  describe('scanGeminiMcp', () => {
    it('parses mcp_config.json into normalized McpServerManifest records', async () => {
      const configFile = path.join(tempDir, 'mcp_config.json');
      const configData = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
            env: { DEBUG: '1' }
          },
          memory: {
            command: 'node',
            args: ['server.js']
          }
        }
      };

      await fs.writeFile(configFile, JSON.stringify(configData), 'utf-8');

      const servers = await scanGeminiMcp(configFile);
      expect(servers).toHaveLength(2);
      const fsServer = servers.find((s) => s.name === 'filesystem');
      expect(fsServer).toBeDefined();
      expect(fsServer?.transport).toBe('stdio');
      expect(fsServer?.command).toBe('npx');
      expect(fsServer?.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem', '/tmp']);
      expect(fsServer?.env).toEqual({ DEBUG: '1' });
    });

    it('returns empty array when mcp_config.json is missing', async () => {
      const missingConfig = path.join(tempDir, 'missing_mcp.json');
      const servers = await scanGeminiMcp(missingConfig);
      expect(servers).toEqual([]);
    });
  });
});
