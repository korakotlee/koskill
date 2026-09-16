import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Logger, debugLog, formatLogEntry } from '../logger.js';

describe('Centralized Structured Logger', () => {
  const testLogDir = path.resolve(process.cwd(), 'tmp-test-log');
  const testLogFile = path.join(testLogDir, 'test-agent.log');

  beforeEach(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  it('formats log entries with ISO timestamp and level', () => {
    const entry = formatLogEntry('INFO', 'Test system init', { component: 'scanner' });
    expect(entry).toContain('[INFO]');
    expect(entry).toContain('Test system init');
    expect(entry).toContain('"component":"scanner"');
    // Timestamp ISO check (YYYY-MM-DDTHH:mm:ss...)
    expect(entry).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('creates target log directory automatically and appends entries', () => {
    const logger = new Logger(testLogFile);
    logger.info('Starting server process');
    logger.warn('Low disk space warning', { availableMb: 50 });

    expect(fs.existsSync(testLogFile)).toBe(true);
    const content = fs.readFileSync(testLogFile, 'utf8');
    expect(content).toContain('[INFO]');
    expect(content).toContain('Starting server process');
    expect(content).toContain('[WARN]');
    expect(content).toContain('Low disk space warning');
    expect(content).toContain('50');
  });

  it('global debugLog helper writes to logger without throwing', () => {
    expect(() => {
      debugLog('Test invocation from test suite', { traceId: 'abc-123' });
    }).not.toThrow();
  });
});
