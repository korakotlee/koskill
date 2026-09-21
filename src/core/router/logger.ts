import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  RouterTransaction,
  RouterMetrics,
  RouterLogFilterOptions,
} from './types.js';

export interface RouterLoggerOptions {
  logFilePath?: string;
  maxEntries?: number;
}

/**
 * High-throughput transaction logger and circular ring buffer for the KoSkill router.
 * Maintains recent transactions in-memory and appends to a local WAL JSONL log file.
 */
export class RouterLogger {
  private readonly maxEntries: number;
  private readonly logFilePath: string;
  private readonly ringBuffer: RouterTransaction[] = [];
  private totalCumulativeSavedTokens = 0;

  constructor(options?: RouterLoggerOptions) {
    this.maxEntries = options?.maxEntries ?? 1000;
    this.logFilePath =
      options?.logFilePath ??
      path.join(os.homedir(), '.koskill', 'cache', 'router_tx.log');

    this.ensureLogDirectory();
  }

  /**
   * Ensures parent directories exist for the WAL log file.
   */
  private ensureLogDirectory(): void {
    try {
      const dir = path.dirname(this.logFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {
      // Ignore directory creation failure during initialization
    }
  }

  /**
   * Records a new routing transaction in-memory and appends to the log file.
   */
  public record(tx: RouterTransaction): void {
    if (this.ringBuffer.length >= this.maxEntries) {
      this.ringBuffer.shift();
    }
    this.ringBuffer.push(tx);

    if (tx.status === 'SUCCESS' && tx.tokensSavedEstimate > 0) {
      this.totalCumulativeSavedTokens += tx.tokensSavedEstimate;
    }

    this.appendToDisk(tx);
  }

  /**
   * Appends the transaction to disk synchronously in JSONL format.
   */
  private appendToDisk(tx: RouterTransaction): void {
    try {
      const line = JSON.stringify(tx) + '\n';
      fs.appendFileSync(this.logFilePath, line, 'utf-8');
    } catch {
      // Non-blocking disk failure fallback to preserve router speed
    }
  }

  /**
   * Returns transactions in reverse chronological order (newest first).
   */
  public getTransactions(options?: RouterLogFilterOptions): RouterTransaction[] {
    let results = [...this.ringBuffer].reverse();

    if (options?.action) {
      results = results.filter((tx) => tx.action === options.action);
    }

    if (options?.search) {
      const q = options.search.toLowerCase();
      results = results.filter(
        (tx) =>
          tx.id.toLowerCase().includes(q) ||
          tx.query?.toLowerCase().includes(q) ||
          tx.targetServer?.toLowerCase().includes(q) ||
          tx.targetTool?.toLowerCase().includes(q) ||
          tx.skillName?.toLowerCase().includes(q) ||
          tx.error?.toLowerCase().includes(q)
      );
    }

    if (options?.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Computes dynamic router metrics for dashboard views.
   */
  public getMetrics(activeServersCount = 0): RouterMetrics {
    const estimatedTokensSaved = this.ringBuffer.reduce(
      (sum, tx) => sum + (tx.tokensSavedEstimate || 0),
      0
    );

    return {
      activeServersCount,
      totalTransactions: this.ringBuffer.length,
      estimatedTokensSaved,
    };
  }

  /**
   * Clears the in-memory ring buffer.
   */
  public clear(): void {
    this.ringBuffer.length = 0;
    this.totalCumulativeSavedTokens = 0;
  }

  /**
   * Returns the configured path to the log file.
   */
  public getLogFilePath(): string {
    return this.logFilePath;
  }
}

/**
 * Singleton instance of RouterLogger.
 */
export const defaultRouterLogger = new RouterLogger();
