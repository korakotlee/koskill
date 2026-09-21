import { spawn, ChildProcess } from 'node:child_process';
import * as readline from 'node:readline';
import { loadMcpRegistry } from '../storage/mcp-store.js';
import { defaultLogger } from '../logger.js';
import { PidTracker } from './pid-tracker.js';

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpProxyOptions {
  maxConcurrentServers?: number;
  idleTimeoutMs?: number;
  callTimeoutMs?: number;
  pidsFilePath?: string;
  manifestResolver?: (serverName: string) => Promise<McpServerConfig | undefined>;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: NodeJS.Timeout;
}

interface PooledServer {
  serverName: string;
  proc: ChildProcess;
  lastUsed: number;
  idleTimer?: NodeJS.Timeout;
  pendingRequests: Map<number | string, PendingRequest>;
  nextRequestId: number;
}

/**
 * Manages downstream MCP server child processes lazily over stdio.
 */
export class McpProxy {
  private readonly maxConcurrentServers: number;
  private readonly idleTimeoutMs: number;
  private readonly callTimeoutMs: number;
  private readonly pidTracker: PidTracker;
  private readonly manifestResolver: (serverName: string) => Promise<McpServerConfig | undefined>;
  private readonly pool = new Map<string, PooledServer>();

  constructor(options?: McpProxyOptions) {
    this.maxConcurrentServers = options?.maxConcurrentServers ?? 5;
    this.idleTimeoutMs = options?.idleTimeoutMs ?? 5 * 60 * 1000;
    this.callTimeoutMs = options?.callTimeoutMs ?? 15000;
    this.pidTracker = new PidTracker(options?.pidsFilePath);

    this.manifestResolver =
      options?.manifestResolver ??
      (async (name: string) => {
        const reg = await loadMcpRegistry();
        const s = reg[name];
        if (!s) return undefined;
        return { command: s.command, args: s.args, env: s.env };
      });

    this.pidTracker.sweepOrphanPids();
  }

  public getActiveServersCount(): number {
    return this.pool.size;
  }

  private async getOrCreateServer(serverName: string): Promise<PooledServer> {
    const existing = this.pool.get(serverName);
    if (existing && !existing.proc.killed) {
      existing.lastUsed = Date.now();
      this.resetIdleTimer(existing);
      return existing;
    }

    if (this.pool.size >= this.maxConcurrentServers) {
      this.evictLruServer();
    }

    const config = await this.manifestResolver(serverName);
    if (!config || !config.command) {
      throw new Error(`Downstream MCP server '${serverName}' not found in registry`);
    }

    const proc = spawn(config.command, config.args || [], {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.pidTracker.recordPid(proc.pid);

    const pooled: PooledServer = {
      serverName,
      proc,
      lastUsed: Date.now(),
      pendingRequests: new Map(),
      nextRequestId: 1,
    };

    this.setupProcessHandlers(pooled);
    this.pool.set(serverName, pooled);
    this.resetIdleTimer(pooled);

    await this.initializeServer(pooled);
    return pooled;
  }

  private setupProcessHandlers(pooled: PooledServer): void {
    const { proc, serverName } = pooled;
    const rl = readline.createInterface({ input: proc.stdout! });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
        defaultLogger.debug('Non-JSON stdout from child MCP', { serverName, line: trimmed });
        return;
      }
      try {
        const msg = JSON.parse(trimmed);
        if (msg.id !== undefined && pooled.pendingRequests.has(msg.id)) {
          const req = pooled.pendingRequests.get(msg.id)!;
          clearTimeout(req.timer);
          pooled.pendingRequests.delete(msg.id);
          if (msg.error) {
            req.reject(new Error(msg.error.message || 'MCP Error'));
          } else {
            req.resolve(msg.result);
          }
        }
      } catch {
        // Line was not valid JSON-RPC
      }
    });

    proc.stderr?.on('data', (chunk) => {
      defaultLogger.debug('Child MCP stderr', { serverName, stderr: chunk.toString() });
    });

    proc.on('exit', () => {
      this.cleanupServer(serverName);
    });

    proc.on('error', (err) => {
      defaultLogger.warn('Child MCP process error', { serverName, error: err.message });
      this.cleanupServer(serverName);
    });
  }

  private async initializeServer(pooled: PooledServer): Promise<void> {
    await this.sendRequest(pooled, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'koskill-router', version: '0.1.0' },
    });
    this.sendNotification(pooled, 'notifications/initialized', {});
  }

  private sendNotification(pooled: PooledServer, method: string, params: Record<string, any>): void {
    if (pooled.proc.stdin && !pooled.proc.killed) {
      pooled.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
    }
  }

  private sendRequest(pooled: PooledServer, method: string, params: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = pooled.nextRequestId++;
      const timer = setTimeout(() => {
        pooled.pendingRequests.delete(id);
        reject(new Error(`MCP request '${method}' to '${pooled.serverName}' timed out after ${this.callTimeoutMs}ms`));
      }, this.callTimeoutMs);

      pooled.pendingRequests.set(id, { resolve, reject, timer });

      try {
        pooled.proc.stdin?.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      } catch (err: any) {
        clearTimeout(timer);
        pooled.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  public async executeTool(
    serverName: string,
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    const pooled = await this.getOrCreateServer(serverName);
    pooled.lastUsed = Date.now();
    this.resetIdleTimer(pooled);

    return this.sendRequest(pooled, 'tools/call', {
      name: toolName,
      arguments: args,
    });
  }

  private resetIdleTimer(pooled: PooledServer): void {
    if (pooled.idleTimer) clearTimeout(pooled.idleTimer);
    pooled.idleTimer = setTimeout(() => {
      defaultLogger.info('Reclaiming idle downstream MCP server', { serverName: pooled.serverName });
      this.cleanupServer(pooled.serverName);
    }, this.idleTimeoutMs);
  }

  private evictLruServer(): void {
    let oldestName: string | undefined;
    let oldestTime = Infinity;

    for (const [name, s] of this.pool.entries()) {
      if (s.lastUsed < oldestTime) {
        oldestTime = s.lastUsed;
        oldestName = name;
      }
    }

    if (oldestName) {
      this.cleanupServer(oldestName);
    }
  }

  private cleanupServer(serverName: string): void {
    const s = this.pool.get(serverName);
    if (!s) return;
    this.pool.delete(serverName);
    if (s.idleTimer) clearTimeout(s.idleTimer);
    for (const req of s.pendingRequests.values()) {
      clearTimeout(req.timer);
      req.reject(new Error(`Child MCP server '${serverName}' terminated`));
    }
    s.pendingRequests.clear();
    this.pidTracker.removePid(s.proc.pid);
    try {
      if (!s.proc.killed) {
        s.proc.kill('SIGTERM');
        setTimeout(() => {
          if (!s.proc.killed) s.proc.kill('SIGKILL');
        }, 500).unref();
      }
    } catch {
      // Ignore termination errors
    }
  }

  public async closeAll(): Promise<void> {
    for (const name of Array.from(this.pool.keys())) {
      this.cleanupServer(name);
    }
  }
}

export const defaultMcpProxy = new McpProxy();
