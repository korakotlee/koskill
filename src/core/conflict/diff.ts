import { DiffLine, DiffSummary } from './types.js';

export interface DiffOptions {
  oldHeader?: string;
  newHeader?: string;
  contextLines?: number;
}

/**
 * Computes Longest Common Subsequence of lines between two strings.
 */
function computeLCS(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  return dp;
}

/**
 * Backtracks LCS matrix to produce line-by-line diff changes.
 */
function backtrackDiff(
  dp: number[][],
  oldLines: string[],
  newLines: string[]
): DiffLine[] {
  let i = oldLines.length;
  let j = newLines.length;
  const result: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({
        type: 'unchanged',
        value: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({
        type: 'added',
        value: newLines[j - 1],
        newLineNumber: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.push({
        type: 'removed',
        value: oldLines[i - 1],
        oldLineNumber: i,
      });
      i--;
    }
  }

  return result.reverse();
}

/**
 * Formats DiffLine array into standard unified diff textual output.
 */
export function formatUnifiedDiff(
  lines: DiffLine[],
  oldHeader = 'a/original',
  newHeader = 'b/modified'
): string {
  const header = `--- ${oldHeader}\n+++ ${newHeader}\n`;
  if (lines.length === 0) {
    return header;
  }

  const hasChanges = lines.some((l) => l.type !== 'unchanged');
  if (!hasChanges) {
    const body = lines.map((l) => ` ${l.value}`).join('\n');
    return `${header}@@ -1,${lines.length} +1,${lines.length} @@\n${body}\n`;
  }

  const oldTotal = lines.filter((l) => l.type !== 'added').length;
  const newTotal = lines.filter((l) => l.type !== 'removed').length;

  const hunkHeader = `@@ -1,${oldTotal} +1,${newTotal} @@\n`;
  const body = lines
    .map((l) => {
      if (l.type === 'added') return `+${l.value}`;
      if (l.type === 'removed') return `-${l.value}`;
      return ` ${l.value}`;
    })
    .join('\n');

  return `${header}${hunkHeader}${body}\n`;
}

/**
 * Generates unified textual diff and summary between two file contents.
 */
export function generateDiff(
  oldContent = '',
  newContent = '',
  options: DiffOptions = {}
): DiffSummary {
  const oldLines = oldContent ? oldContent.split(/\r?\n/) : [];
  const newLines = newContent ? newContent.split(/\r?\n/) : [];

  const dp = computeLCS(oldLines, newLines);
  const diffLines = backtrackDiff(dp, oldLines, newLines);

  let additions = 0;
  let deletions = 0;
  for (const line of diffLines) {
    if (line.type === 'added') additions++;
    if (line.type === 'removed') deletions++;
  }

  const oldHeader = options.oldHeader ?? 'a/original';
  const newHeader = options.newHeader ?? 'b/modified';
  const unifiedDiff = formatUnifiedDiff(diffLines, oldHeader, newHeader);

  return {
    additions,
    deletions,
    unifiedDiff,
    chunks: diffLines,
  };
}
