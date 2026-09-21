import { describe, it, expect, vi } from 'vitest';
import { runCli } from '../../src/cli/index.js';
import { openBrowser, getOpenCommand } from '../../src/cli/browser.js';
import { Writable } from 'stream';

class MockWritable extends Writable {
  public output: string = '';
  _write(chunk: any, _encoding: string, callback: () => void) {
    this.output += chunk.toString();
    callback();
  }
}

describe('CLI Packaging & Execution (src/cli/)', () => {
  it('returns appropriate open command per platform', () => {
    expect(getOpenCommand('darwin')).toBe('open');
    expect(getOpenCommand('win32')).toBe('start');
    expect(getOpenCommand('linux')).toBe('xdg-open');
    expect(getOpenCommand('freebsd')).toBe('xdg-open');
  });

  it('prints help message when --help or -h is passed', async () => {
    const stdout = new MockWritable();
    await runCli(['--help'], process.stdin, stdout);

    expect(stdout.output).toContain('Usage: koskill');
    expect(stdout.output).toContain('router');
    expect(stdout.output).toContain('reindex');
  });

  it('launches daemon when no arguments are provided', async () => {
    const stdout = new MockWritable();
    let serverCloseCalled = false;

    // Test with special test-only env or options
    const cliPromise = runCli([], process.stdin, stdout, {
      noBrowser: true,
      port: 0,
      autoCloseAfterMs: 100
    });

    await cliPromise;
    expect(stdout.output).toContain('KoSkill');
    expect(stdout.output).toContain('http://127.0.0.1:');
  });
});
