import { spawn } from 'node:child_process';
import { defaultLogger } from '../logger.js';

export interface McpProcessOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
}

export type McpSendFn = (payload: Record<string, unknown>) => void;
export type McpFinishFn<T> = (err: Error | null, result?: T) => void;
export type McpMessageHandler<T> = (msg: any, send: McpSendFn, finish: McpFinishFn<T>) => void;
export type McpStartHook = (send: McpSendFn) => void;

/**
 * Runs a JSON-RPC session over child process stdio with timeout and SIGTERM/SIGKILL cleanup.
 */
export function runMcpStdioSession<T>(
  options: McpProcessOptions,
  onStart: McpStartHook,
  onMessage: McpMessageHandler<T>
): Promise<T> {
  const { command, args = [], env, timeoutMs = 6000 } = options;

  if (!command) {
    return Promise.reject(new Error('MCP server command is empty'));
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let stdoutBuffer = '';

    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(command, args, {
        env: { ...process.env, ...env },
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

    const finish: McpFinishFn<T> = (err, result) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (err) {
        reject(err);
      } else {
        resolve(result as T);
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

    const send: McpSendFn = (payload) => {
      if (!proc.stdin || proc.stdin.destroyed) return;
      proc.stdin.write(`${JSON.stringify(payload)}\n`);
    };

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString('utf-8');

      let newlineIdx: number;
      while ((newlineIdx = stdoutBuffer.indexOf('\n')) !== -1) {
        const line = stdoutBuffer.slice(0, newlineIdx).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIdx + 1);

        if (!line || line.toLowerCase().startsWith('content-length:')) {
          continue;
        }

        try {
          const parsed = JSON.parse(line);
          onMessage(parsed, send, finish);
        } catch {
          // Ignore invalid non-JSON log line
        }
      }
    });

    proc.on('close', (code) => {
      if (!settled) {
        finish(new Error(`MCP server process exited prematurely with code ${code}`));
      }
    });

    // Invoke initiation hook
    onStart(send);
  });
}
