import { exec } from 'child_process';
import { defaultLogger } from '../core/logger.js';

/**
 * Returns the OS-specific browser launch command.
 */
export function getOpenCommand(platform: string = process.platform): string {
  switch (platform) {
    case 'darwin':
      return 'open';
    case 'win32':
      return 'start';
    default:
      return 'xdg-open';
  }
}

/**
 * Attempts to open a URL in the user's default browser across platforms.
 * Fails gracefully in headless environments or containerized environments.
 *
 * @param url The URL to open in the browser
 * @param platform Target platform override for testing
 */
export async function openBrowser(url: string, platform: string = process.platform): Promise<boolean> {
  // If NO_COLOR or CI or KOSKILL_NO_BROWSER is set, skip opening browser
  if (process.env.CI || process.env.KOSKILL_NO_BROWSER) {
    return false;
  }

  const cmd = getOpenCommand(platform);
  const fullCommand = platform === 'win32' ? `start "" "${url}"` : `${cmd} "${url}"`;

  return new Promise((resolve) => {
    exec(fullCommand, (err) => {
      if (err) {
        defaultLogger.warn('Failed to launch browser automatically', { error: err.message, url });
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}
