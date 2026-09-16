import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { scanClaudeMcp, scanClaudeSkills } from '../../../src/core/scanner/claude.js';

describe('Claude Scanner', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-claude-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('scanClaudeMcp', () => {
    it('discovers MCP servers declared in mcp.json', async () => {
      const mcpFile = path.join(tempDir, 'mcp.json');
      const data = {
        mcpServers: {
          github: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: { GITHUB_TOKEN: 'secret-token' }
          }
        }
      };

      await fs.writeFile(mcpFile, JSON.stringify(data), 'utf-8');

      const servers = await scanClaudeMcp(mcpFile);
      expect(servers).toHaveLength(1);
      expect(servers[0]).toMatchObject({
        id: 'claude:github',
        name: 'github',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github']
      });
    });

    it('returns empty array when mcp file is not found', async () => {
      const missing = path.join(tempDir, 'does-not-exist.json');
      const servers = await scanClaudeMcp(missing);
      expect(servers).toEqual([]);
    });
  });

  describe('scanClaudeSkills', () => {
    it('parses installed skills or commands from settings.json', async () => {
      const settingsFile = path.join(tempDir, 'settings.json');
      const data = {
        skills: [
          {
            name: 'code-review',
            description: 'Automated code review skill',
            path: '/Users/test/.claude/skills/code-review'
          }
        ]
      };

      await fs.writeFile(settingsFile, JSON.stringify(data), 'utf-8');

      const skills = await scanClaudeSkills(settingsFile);
      expect(skills).toHaveLength(1);
      expect(skills[0]).toMatchObject({
        id: 'claude:code-review',
        name: 'code-review',
        description: 'Automated code review skill',
        targetEcosystem: 'claude',
        status: 'original'
      });
    });

    it('returns empty list when settings.json is missing or contains no skills', async () => {
      const missing = path.join(tempDir, 'no-settings.json');
      const skills = await scanClaudeSkills(missing);
      expect(skills).toEqual([]);
    });
  });
});
