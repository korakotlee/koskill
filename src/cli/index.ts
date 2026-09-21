#!/usr/bin/env node
import { runRouterCommand } from './commands/router.js';
import { runReindexCommand } from './commands/reindex.js';

/**
 * Universal CLI entrypoint for KoSkill.
 */
export async function runCli(
  args: string[] = process.argv.slice(2),
  stdin: NodeJS.ReadableStream = process.stdin,
  stdout: NodeJS.WritableStream = process.stdout
): Promise<void> {
  const command = args[0];
  const subArgs = args.slice(1);

  if (!command || command === '--help' || command === '-h') {
    stdout.write(
      `Usage: koskill <command> [options]\n\n` +
      `Commands:\n` +
      `  router    Manage and run the KoSkill Meta-MCP Auto-Router\n` +
      `  reindex   Synchronize skills, workflows, and MCP tools in search index\n` +
      `  --help    Show this help message\n`
    );
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
