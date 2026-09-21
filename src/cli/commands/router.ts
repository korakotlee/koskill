import { MetaMcpServer } from '../../core/router/meta-mcp.js';
import { defaultMcpProxy } from '../../core/router/mcp-proxy.js';

/**
 * Handles 'koskill router' CLI commands.
 */
export async function runRouterCommand(
  args: string[],
  stdin: NodeJS.ReadableStream = process.stdin,
  stdout: NodeJS.WritableStream = process.stdout
): Promise<void> {
  const subcommand = args[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    stdout.write(
      `Usage: koskill router <subcommand>\n\n` +
      `Subcommands:\n` +
      `  run       Launch the Meta-MCP server over stdio\n` +
      `  --help    Show this help message\n`
    );
    return;
  }

  if (subcommand === 'run') {
    const server = new MetaMcpServer();

    const cleanup = async () => {
      await defaultMcpProxy.closeAll();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    return new Promise((resolve) => {
      server.runStdio(stdin, stdout);
      stdin.on('end', async () => {
        await cleanup();
        resolve();
      });
    });
  }

  stdout.write(`Unknown router subcommand: ${subcommand}\n`);
}
