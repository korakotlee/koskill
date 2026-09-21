#!/usr/bin/env node
import { runRouterCommand } from './commands/router.js';
import { runReindexCommand } from './commands/reindex.js';
import { runDaemonCommand, DaemonOptions } from './commands/daemon.js';

export interface CliOptions extends DaemonOptions {}

/**
 * Universal CLI entrypoint for KoSkill.
 */
export async function runCli(
  args: string[] = process.argv.slice(2),
  stdin: NodeJS.ReadableStream = process.stdin,
  stdout: NodeJS.WritableStream = process.stdout,
  options: CliOptions = {}
): Promise<void> {
  const command = args[0];
  const subArgs = args.slice(1);

  if (command === '--help' || command === '-h') {
    stdout.write(
      `Usage: koskill [command] [options]\n\n` +
      `Universal developer tool for cross-agent skill and MCP synchronization.\n\n` +
      `Commands:\n` +
      `  (default)  Launch the local dashboard daemon and open browser\n` +
      `  router     Manage and run the KoSkill Meta-MCP Auto-Router\n` +
      `  reindex    Synchronize skills, workflows, and MCP tools in search index\n` +
      `  --help     Show this help message\n\n` +
      `Options:\n` +
      `  --no-open  Start daemon without opening the web browser\n`
    );
    return;
  }

  // Default invocation without subcommands or explicit start/dashboard
  if (!command || command === 'start' || command === 'dashboard') {
    await runDaemonCommand(args, stdout, options);
    return;
  }

  if (command === 'router') {
    await runRouterCommand(subArgs, stdin, stdout);
    return;
  }

  if (command === 'reindex') {
    await runReindexCommand(subArgs, stdout);
    return;
  }

  stdout.write(`Unknown command: ${command}. Run 'koskill --help' for usage.\n`);
}

// Auto-run if executed directly
const isDirectRun = process.argv[1]?.endsWith('src/cli/index.ts') || process.argv[1]?.endsWith('bin/koskill');
if (isDirectRun) {
  runCli().catch((err) => {
    console.error('Fatal CLI error:', err);
    process.exit(1);
  });
}
