import { describe, it, expect, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { runCli } from '../../src/cli/index.js';

describe('koskill CLI router command', () => {
  it('starts MetaMcpServer and responds to JSON-RPC tools/list when running router run', async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();

    let output = '';
    stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    // Start CLI runner asynchronously
    const cliPromise = runCli(['router', 'run'], stdin, stdout);

    // Send tools/list request
    stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 101,
        method: 'tools/list',
        params: {},
      }) + '\n'
    );

    // Allow event loop ticks for JSON-RPC processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(output).toContain('discover_capabilities');
    expect(output).toContain('invoke_tool');
    expect(output).toContain('load_skill');

    // Close stdin to trigger exit
    stdin.end();
    await cliPromise;
  });

  it('prints help message when run with router --help', async () => {
    const stdout = new PassThrough();
    let output = '';
    stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    await runCli(['router', '--help'], new PassThrough(), stdout);

    expect(output).toContain('Usage: koskill router');
  });

  it('executes bin/koskill executable directly via child process', async () => {
    const { execFileSync } = await import('node:child_process');
    const path = await import('node:path');
    const binPath = path.resolve(__dirname, '../../bin/koskill');

    const output = execFileSync(binPath, ['router', '--help'], { encoding: 'utf-8' });
    expect(output).toContain('Usage: koskill router');
    expect(output).toContain('run       Launch the Meta-MCP server over stdio');
  });

  it('completes standard MCP handshake (initialize -> notifications/initialized -> tools/list) without error frames', async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();

    let output = '';
    stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    const cliPromise = runCli(['router', 'run'], stdin, stdout);

    // 1. Send initialize
    stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0' },
        },
      }) + '\n'
    );

    // 2. Send notifications/initialized
    stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }) + '\n'
    );

    // 3. Send tools/list
    stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }) + '\n'
    );

    await new Promise((resolve) => setTimeout(resolve, 150));

    // Split stdout by newline
    const lines = output.trim().split('\n').filter((l) => l.trim().length > 0).map((l) => JSON.parse(l));

    // Must NOT contain any error for notifications/initialized
    const errorResponses = lines.filter((l) => l.error);
    expect(errorResponses).toEqual([]);

    // Line 1: response to initialize (id: 1)
    expect(lines[0].id).toBe(1);
    expect(lines[0].result.serverInfo.name).toBe('koskill-router');

    // Line 2: response to tools/list (id: 2)
    expect(lines[1].id).toBe(2);
    expect(lines[1].result.tools).toHaveLength(3);

    stdin.end();
    await cliPromise;
  });
});
