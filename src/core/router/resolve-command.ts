import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RouterCommandConfig {
  command: string;
  args: string[];
}

/**
 * Resolves the executable command configuration for koskill-router.
 * Checks for global 'koskill' in PATH, then falls back to local bin/koskill.
 */
export function resolveRouterCommand(customCommand?: RouterCommandConfig): RouterCommandConfig {
  if (customCommand) return customCommand;

  try {
    execSync('which koskill', { stdio: 'ignore' });
    return { command: 'koskill', args: ['router', 'run'] };
  } catch {
    const binKoskill = path.resolve(__dirname, '../../../bin/koskill');
    if (fs.existsSync(binKoskill)) {
      return { command: binKoskill, args: ['router', 'run'] };
    }
    return { command: 'koskill', args: ['router', 'run'] };
  }
}
