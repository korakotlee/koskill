import { syncFullSearchIndex } from '../../core/search/sync.js';

/**
 * Handles 'koskill reindex' CLI command.
 */
export async function runReindexCommand(
  args: string[],
  stdout: NodeJS.WritableStream = process.stdout
): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    stdout.write(
      `Usage: koskill reindex [options]\n\n` +
      `Synchronizes skills, workflows, and MCP tools into the local SQLite vector database.\n\n` +
      `Options:\n` +
      `  --help    Show this help message\n`
    );
    return;
  }

  stdout.write('Scanning inventory and synchronizing search index...\n');
  const start = Date.now();
  const res = await syncFullSearchIndex();
  const duration = Date.now() - start;

  stdout.write(
    `Reindex complete in ${duration}ms:\n` +
    `  Skills:    ${res.skills.indexed} indexed, ${res.skills.updated} updated, ${res.skills.skipped} skipped (total ${res.skills.total})\n` +
    `  Workflows: ${res.workflows.indexed} indexed, ${res.workflows.updated} updated, ${res.workflows.skipped} skipped (total ${res.workflows.total})\n` +
    `  MCP Tools: ${res.mcpTools.indexed} indexed, ${res.mcpTools.updated} updated, ${res.mcpTools.skipped} skipped (total ${res.mcpTools.total})\n` +
    `  Total:     ${res.total} items processed\n`
  );
}
