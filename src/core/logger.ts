import fs from 'fs';
import path from 'path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Formats a log entry into an ISO timestamped string with metadata.
 */
export function formatLogEntry(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  const metaString = metadata && Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaString}\n`;
}

/**
 * Centralized file and console structured logger.
 */
export class Logger {
  private logFilePath: string;

  constructor(logFilePath?: string) {
    this.logFilePath = logFilePath || path.resolve(process.cwd(), 'log', 'agent.log');
  }

  private write(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const formatted = formatLogEntry(level, message, metadata);

    // Ensure directory exists
    try {
      const dir = path.dirname(this.logFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.appendFileSync(this.logFilePath, formatted, 'utf8');
    } catch {
      // Fallback silently if disk write is temporarily unavailable
    }

    // Write to console
    const consoleMsg = formatted.trimEnd();
    switch (level) {
      case 'ERROR':
        console.error(consoleMsg);
        break;
      case 'WARN':
        console.warn(consoleMsg);
        break;
      default:
        console.log(consoleMsg);
        break;
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.write('DEBUG', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.write('INFO', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.write('WARN', message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.write('ERROR', message, metadata);
  }
}

export const defaultLogger = new Logger();

/**
 * Common timestamped debug log method callable from anywhere in the codebase.
 */
export function debugLog(message: string, metadata?: Record<string, unknown>): void {
  defaultLogger.debug(message, metadata);
}
