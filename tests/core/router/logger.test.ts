import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { RouterLogger } from '../../../src/core/router/logger.js';
import { RouterTransaction } from '../../../src/core/router/types.js';

describe('RouterLogger', () => {
  let tmpDir: string;
  let logFile: string;
  let logger: RouterLogger;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koskill-router-test-'));
    logFile = path.join(tmpDir, 'router_tx.log');
    logger = new RouterLogger({ logFilePath: logFile, maxEntries: 1000 });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('records transactions and returns them in reverse chronological order', () => {
    const tx1: RouterTransaction = {
      id: 'tx-1',
      timestamp: 1000,
      action: 'DISCOVER',
      query: 'accessibility testing',
      durationMs: 15,
      status: 'SUCCESS',
      tokensSavedEstimate: 14200,
    };
    const tx2: RouterTransaction = {
      id: 'tx-2',
      timestamp: 2000,
      action: 'LOAD_SKILL',
      skillName: 'accessibility',
      durationMs: 4,
      status: 'SUCCESS',
      tokensSavedEstimate: 8600,
    };

    logger.record(tx1);
    logger.record(tx2);

    const logs = logger.getTransactions();
    expect(logs).toHaveLength(2);
    expect(logs[0].id).toBe('tx-2');
    expect(logs[1].id).toBe('tx-1');
  });

  it('persists transactions to WAL log file in JSONL format', () => {
    const tx: RouterTransaction = {
      id: 'tx-wal-1',
      timestamp: Date.now(),
      action: 'INVOKE_TOOL',
      targetServer: 'chrome-devtools',
      targetTool: 'click',
      durationMs: 42,
      status: 'SUCCESS',
      tokensSavedEstimate: 32100,
    };

    logger.record(tx);

    expect(fs.existsSync(logFile)).toBe(true);
    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.id).toBe('tx-wal-1');
    expect(parsed.targetServer).toBe('chrome-devtools');
  });

  it('truncates ring buffer to maxEntries (1000 entries)', () => {
    const smallLogger = new RouterLogger({ logFilePath: logFile, maxEntries: 5 });
    for (let i = 1; i <= 8; i++) {
      smallLogger.record({
        id: `tx-${i}`,
        timestamp: 1000 + i,
        action: 'DISCOVER',
        durationMs: i,
        status: 'SUCCESS',
        tokensSavedEstimate: 1000,
      });
    }

    const logs = smallLogger.getTransactions();
    expect(logs).toHaveLength(5);
    expect(logs[0].id).toBe('tx-8');
    expect(logs[4].id).toBe('tx-4');
  });

  it('calculates dynamic aggregate metrics correctly', () => {
    logger.record({
      id: 'tx-m1',
      timestamp: 1000,
      action: 'DISCOVER',
      durationMs: 12,
      status: 'SUCCESS',
      tokensSavedEstimate: 15000,
    });
    logger.record({
      id: 'tx-m2',
      timestamp: 2000,
      action: 'INVOKE_TOOL',
      targetServer: 'github',
      durationMs: 65,
      status: 'ERROR',
      tokensSavedEstimate: 0,
      error: 'Connection timeout',
    });

    const metrics = logger.getMetrics(2);
    expect(metrics.totalTransactions).toBe(2);
    expect(metrics.estimatedTokensSaved).toBe(15000);
    expect(metrics.activeServersCount).toBe(2);
  });

  it('filters transactions by action and search query', () => {
    logger.record({
      id: 'tx-f1',
      timestamp: 1000,
      action: 'DISCOVER',
      query: 'find git workflows',
      durationMs: 10,
      status: 'SUCCESS',
      tokensSavedEstimate: 5000,
    });
    logger.record({
      id: 'tx-f2',
      timestamp: 2000,
      action: 'INVOKE_TOOL',
      targetServer: 'github',
      targetTool: 'list_repos',
      durationMs: 50,
      status: 'SUCCESS',
      tokensSavedEstimate: 12000,
    });

    const discoverOnly = logger.getTransactions({ action: 'DISCOVER' });
    expect(discoverOnly).toHaveLength(1);
    expect(discoverOnly[0].id).toBe('tx-f1');

    const searchFilter = logger.getTransactions({ search: 'github' });
    expect(searchFilter).toHaveLength(1);
    expect(searchFilter[0].id).toBe('tx-f2');
  });
});
