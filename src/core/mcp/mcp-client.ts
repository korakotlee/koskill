import { spawn } from 'node:child_process';
import { McpToolDefinition } from '../types.js';
import { defaultLogger } from '../logger.js';

export interface QueryMcpToolsOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Connects to a local MCP server over stdio, performs JSON-RPC handshake,
 * queries tools/list, and returns the tool definitions.
 */
export async function queryMcpServerTools(
  options: QueryMcpToolsOptions
): Promise<McpToolDefinition[]> {
  const { command, args = [], env, timeoutMs = 6000 } = options;

  if (!command) {
    throw new Error('MCP server command is empty');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let stdoutBuffer = '';

    const spawnEnv = {
      ...process.env,
      ...env,
    };

    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(command, args, {
        env: spawnEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: any) {
      return reject(new Error(`Failed to spawn MCP server '${command}': ${err.message}`));
    }

    const cleanup = () => {
      clearTimeout(timer);
      if (proc && !proc.killed) {
        try {
          proc.kill('SIGTERM');
          setTimeout(() => {
            if (!proc.killed) proc.kill('SIGKILL');
          }, 500).unref();
        } catch {
          // ignore kill failure
        }
      }
    };

    const finish = (err: Error | null, tools?: McpToolDefinition[]) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (err) {
        reject(err);
      } else {
        resolve(tools || []);
      }
    };

    const timer = setTimeout(() => {
      finish(new Error(`MCP server query timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('error', (err) => {
      finish(new Error(`MCP server process error: ${err.message}`));
    });

    proc.stderr?.on('data', (chunk) => {
      defaultLogger.debug('MCP server stderr', { stderr: chunk.toString() });
    });

    const sendJsonRpc = (payload: Record<string, unknown>) => {
      if (!proc.stdin || proc.stdin.destroyed) return;
      const json = JSON.stringify(payload);
      proc.stdin.write(`${json}\n`);
    };

    // Step 1: Start handshake with initialize request
    sendJsonRpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'koskill',
          version: '0.1.0',
        },
      },
    });

    const handleMessage = (msg: any) => {
      if (!msg || typeof msg !== 'object') return;

      // Handle initialize response
      if (msg.id === 1 && msg.result) {
        // Send initialized notification
        sendJsonRpc({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        });

        // Step 2: Request tool listing
        sendJsonRpc({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        });
        return;
      }

      // Handle tools/list response
      if (msg.id === 2) {
        if (msg.error) {
          finish(new Error(`tools/list returned error: ${msg.error.message || JSON.stringify(msg.error)}`));
          return;
        }

        const rawTools = msg.result?.tools;
        if (!Array.isArray(rawTools)) {
          finish(null, []);
          return;
        }

        const tools: McpToolDefinition[] = rawTools.map((t: any) => ({
          name: String(t.name || ''),
          description: t.description ? String(t.description) : undefined,
          parameters: t.inputSchema || t.parameters,
        }));

        finish(null, tools);
      }
    };

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString('utf-8');

      // Process newline-delimited or headers+json messages
      let newlineIdx: number;
      while ((newlineIdx = stdoutBuffer.indexOf('\n')) !== -1) {
        const line = stdoutBuffer.slice(0, newlineIdx).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIdx + 1);

        if (!line) continue;

        // Strip Content-Length header lines if present
        if (line.startsWith('Content-Length:') || line.startsWith('content-length:')) {
          continue;
        }

        try {
          const parsed = JSON.parse(line);
          handleMessage(parsed);
        } catch {
          // May be partial or non-json log line; ignore and continue
        }
      }
    });

    proc.on('close', (code) => {
      if (!settled) {
        finish(new Error(`MCP server process exited prematurely with code ${code}`));
      }
    });
  });
}
