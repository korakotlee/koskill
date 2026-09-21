import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { defaultLogger } from '../logger.js';
import { loadMcpRegistry } from '../storage/mcp-store.js';
import { resolveRouterCommand, type RouterCommandConfig } from './resolve-command.js';

export interface RouterToggleOperation {
  type: 'RENAME' | 'INJECT_RULE' | 'REGISTER_MCP';
  target: string;
  original?: string;
  description: string;
}

export interface RouterPreviewResult {
  operations: RouterToggleOperation[];
  targetPromptFiles: string[];
  skillsAffectedCount: number;
}

export interface RouterToggleResult {
  success: boolean;
  enabled: boolean;
  message: string;
  operationsPerformed: number;
}

export interface RouterToggleOptions {
  skillsDir?: string;
  promptFiles?: string[];
  mcpConfigFiles?: string[];
  stateFilePath?: string;
  centralizedMcpNames?: string[];
  routerCommand?: RouterCommandConfig;
}

const ROUTER_RULE_START = '<!-- KOSKILL_ROUTER_START -->';
const ROUTER_RULE_END = '<!-- KOSKILL_ROUTER_END -->';

const ROUTER_PROMPT_BLOCK = `${ROUTER_RULE_START}
## KoSkill Auto-Router Instructions
When solving user requests, use the \`discover_capabilities\` tool from the \`koskill-router\` MCP server to dynamically find skills, workflows, and downstream tools on demand. Load full skill instructions via \`load_skill\` and execute tools via \`invoke_tool\`.
${ROUTER_RULE_END}`;

/**
 * Manages atomic Auto-Router activation, symlink takeover (.disabled renaming),
 * prompt rule injection, and MCP server registration with downstream delegation.
 */
export class RouterToggleManager {
  private readonly skillsDir: string;
  private readonly customPromptFiles?: string[];
  private readonly customMcpConfigFiles?: string[];
  private readonly customCentralizedMcpNames?: string[];
  private readonly customRouterCommand?: RouterCommandConfig;
  private readonly stateFilePath: string;

  constructor(options?: RouterToggleOptions) {
    this.skillsDir = options?.skillsDir ?? path.join(os.homedir(), '.koskill', 'skills');
    this.customPromptFiles = options?.promptFiles;
    this.customMcpConfigFiles = options?.mcpConfigFiles;
    this.customCentralizedMcpNames = options?.centralizedMcpNames;
    this.customRouterCommand = options?.routerCommand;
    this.stateFilePath = options?.stateFilePath ?? path.join(os.homedir(), '.koskill', 'cache', 'router_state.json');
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    try {
      const dir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore cache dir creation errors
    }
  }

  public isEnabled(): boolean {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.stateFilePath, 'utf-8'));
        return Boolean(data.enabled);
      }
    } catch {
      // Default to false if file missing or corrupt
    }
    return false;
  }

  private getPromptFiles(): string[] {
    if (this.customPromptFiles) return this.customPromptFiles;
    const candidates = [
      path.join(os.homedir(), '.gemini', 'GEMINI.md'),
      path.join(os.homedir(), '.gemini', 'config', 'GEMINI.md'),
      path.join(os.homedir(), '.claude', 'CLAUDE.md'),
    ];
    const existing = candidates.filter((f) => fs.existsSync(f));
    return existing.length > 0 ? existing : [path.join(os.homedir(), '.gemini', 'GEMINI.md'), path.join(os.homedir(), '.claude', 'CLAUDE.md')];
  }

  private getMcpConfigFiles(): string[] {
    if (this.customMcpConfigFiles) return this.customMcpConfigFiles;
    const candidates = [
      path.join(os.homedir(), '.gemini', 'antigravity-ide', 'mcp_config.json'),
      path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json'),
      path.join(os.homedir(), '.claude', 'mcp.json'),
    ];
    return candidates.filter((f) => fs.existsSync(f));
  }

  private async getCentralizedMcpNames(): Promise<string[]> {
    if (this.customCentralizedMcpNames) return this.customCentralizedMcpNames;
    try {
      const reg = await loadMcpRegistry();
      return Object.keys(reg);
    } catch {
      return [];
    }
  }

  public async previewEnable(): Promise<RouterPreviewResult> {
    const operations: RouterToggleOperation[] = [];

    if (fs.existsSync(this.skillsDir)) {
      const entries = fs.readdirSync(this.skillsDir);
      for (const entry of entries) {
        if (!entry.endsWith('.disabled') && !entry.startsWith('.')) {
          operations.push({
            type: 'RENAME',
            original: path.join(this.skillsDir, entry),
            target: path.join(this.skillsDir, `${entry}.disabled`),
            description: `Rename active skill symlink to ${entry}.disabled`,
          });
        }
      }
    }

    const targetPromptFiles: string[] = [];
    for (const promptFile of this.getPromptFiles()) {
      if (fs.existsSync(promptFile)) {
        targetPromptFiles.push(promptFile);
        operations.push({
          type: 'INJECT_RULE',
          target: promptFile,
          description: `Inject KoSkill Auto-Router prompt instruction block into ${path.basename(promptFile)}`,
        });
      }
    }

    for (const mcpFile of this.getMcpConfigFiles()) {
      if (fs.existsSync(mcpFile)) {
        operations.push({
          type: 'REGISTER_MCP',
          target: mcpFile,
          description: `Register koskill-router and delegate centralized servers in ${path.basename(mcpFile)}`,
        });
      }
    }

    return {
      operations,
      targetPromptFiles,
      skillsAffectedCount: operations.filter((o) => o.type === 'RENAME').length,
    };
  }

  public async enable(): Promise<RouterToggleResult> {
    const preview = await this.previewEnable();
    let performed = 0;

    for (const op of preview.operations) {
      if (op.type === 'RENAME' && op.original && fs.existsSync(op.original)) {
        try {
          fs.renameSync(op.original, op.target);
          performed++;
        } catch (err: any) {
          defaultLogger.warn('Failed to rename skill during router enable', { op, error: err.message });
        }
      } else if (op.type === 'INJECT_RULE' && fs.existsSync(op.target)) {
        try {
          const current = fs.readFileSync(op.target, 'utf-8');
          if (!current.includes(ROUTER_RULE_START)) {
            const updated = current + '\n\n' + ROUTER_PROMPT_BLOCK + '\n';
            fs.writeFileSync(op.target, updated, 'utf-8');
            performed++;
          }
        } catch (err: any) {
          defaultLogger.warn('Failed to inject prompt rule during router enable', { op, error: err.message });
        }
      }
    }

    const centralized = new Set(await this.getCentralizedMcpNames());
    for (const mcpFile of this.getMcpConfigFiles()) {
      if (fs.existsSync(mcpFile)) {
        try {
          const raw = fs.readFileSync(mcpFile, 'utf-8');
          const config = JSON.parse(raw);
          if (!config.mcpServers) config.mcpServers = {};

          config.mcpServers['koskill-router'] = resolveRouterCommand(this.customRouterCommand);

          for (const [name, server] of Object.entries(config.mcpServers)) {
            if (name !== 'koskill-router' && centralized.has(name) && typeof server === 'object' && server !== null) {
              (server as any).disabled = true;
              (server as any)._koskillDownstream = true;
            }
          }

          const tmp = `${mcpFile}.tmp-${Date.now()}`;
          fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf-8');
          fs.renameSync(tmp, mcpFile);
          performed++;
        } catch (err: any) {
          defaultLogger.warn('Failed to update MCP config during router enable', { mcpFile, error: err.message });
        }
      }
    }

    fs.writeFileSync(this.stateFilePath, JSON.stringify({ enabled: true, updatedAt: Date.now() }, null, 2), 'utf-8');
    return { success: true, enabled: true, message: 'KoSkill Auto-Router enabled successfully', operationsPerformed: performed };
  }

  public async disable(): Promise<RouterToggleResult> {
    let performed = 0;

    if (fs.existsSync(this.skillsDir)) {
      const entries = fs.readdirSync(this.skillsDir);
      for (const entry of entries) {
        if (entry.endsWith('.disabled')) {
          const disabledPath = path.join(this.skillsDir, entry);
          const activePath = path.join(this.skillsDir, entry.replace(/\.disabled$/, ''));
          try {
            fs.renameSync(disabledPath, activePath);
            performed++;
          } catch (err: any) {
            defaultLogger.warn('Failed to restore skill during router disable', { entry, error: err.message });
          }
        }
      }
    }

    for (const promptFile of this.getPromptFiles()) {
      if (fs.existsSync(promptFile)) {
        try {
          let content = fs.readFileSync(promptFile, 'utf-8');
          if (content.includes(ROUTER_RULE_START)) {
            const regex = new RegExp(`${ROUTER_RULE_START}[\\s\\S]*?${ROUTER_RULE_END}`, 'g');
            content = content.replace(regex, '').trim() + '\n';
            fs.writeFileSync(promptFile, content, 'utf-8');
            performed++;
          }
        } catch (err: any) {
          defaultLogger.warn('Failed to clean prompt rule during router disable', { promptFile, error: err.message });
        }
      }
    }

    for (const mcpFile of this.getMcpConfigFiles()) {
      if (fs.existsSync(mcpFile)) {
        try {
          const raw = fs.readFileSync(mcpFile, 'utf-8');
          const config = JSON.parse(raw);
          if (config.mcpServers) {
            delete config.mcpServers['koskill-router'];
            for (const server of Object.values(config.mcpServers) as any[]) {
              if (server && typeof server === 'object' && server._koskillDownstream) {
                server.disabled = false;
                delete server._koskillDownstream;
              }
            }
            const tmp = `${mcpFile}.tmp-${Date.now()}`;
            fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf-8');
            fs.renameSync(tmp, mcpFile);
            performed++;
          }
        } catch (err: any) {
          defaultLogger.warn('Failed to restore MCP config during router disable', { mcpFile, error: err.message });
        }
      }
    }

    fs.writeFileSync(this.stateFilePath, JSON.stringify({ enabled: false, updatedAt: Date.now() }, null, 2), 'utf-8');
    return { success: true, enabled: false, message: 'KoSkill Auto-Router disabled successfully', operationsPerformed: performed };
  }
}

export const defaultRouterToggleManager = new RouterToggleManager();
