import { startServer, AppServer } from '../../server/index.js';
import { openBrowser } from '../browser.js';
import { defaultLogger } from '../../core/logger.js';

export interface DaemonOptions {
  noBrowser?: boolean;
  port?: number;
  autoCloseAfterMs?: number;
}

/**
 * Renders the terminal banner for the running KoSkill daemon.
 */
export function formatBanner(url: string, cwd: string): string {
  return [
    '',
    '  ╭─────────────────────────────────────────────────────────╮',
    '  │                                                         │',
    '  │   KoSkill Developer Cockpit                             │',
    `  │   URL:       ${url.padEnd(43)}│`,
    `  │   Workspace: ${cwd.slice(0, 43).padEnd(43)}│`,
    '  │                                                         │',
    '  │   Press Ctrl+C to stop the daemon                       │',
    '  │                                                         │',
    '  ╰─────────────────────────────────────────────────────────╯',
    ''
  ].join('\n') + '\n';
}

/**
 * Runs the KoSkill dashboard daemon and opens the default browser.
 */
export async function runDaemonCommand(
  args: string[] = [],
  stdout: NodeJS.WritableStream = process.stdout,
  options: DaemonOptions = {}
): Promise<void> {
  const noBrowserFlag = args.includes('--no-open') || options.noBrowser;
  const preferredPort = options.port !== undefined ? options.port : (Number(process.env.PORT) || 3900);

  const appServer: AppServer = await startServer(preferredPort);
  const url = `http://127.0.0.1:${appServer.port}`;

  stdout.write(formatBanner(url, process.cwd()));

  if (!noBrowserFlag) {
    await openBrowser(url);
  }

  return new Promise((resolve) => {
    let closed = false;

    const cleanup = async () => {
      if (closed) return;
      closed = true;
      stdout.write('\nGracefully shutting down KoSkill daemon...\n');
      try {
        await appServer.close();
      } catch (err: any) {
        defaultLogger.error('Error stopping server during shutdown', { error: err.message });
      }
      resolve();
    };

    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);

    if (options.autoCloseAfterMs && options.autoCloseAfterMs > 0) {
      setTimeout(cleanup, options.autoCloseAfterMs);
    }
  });
}
