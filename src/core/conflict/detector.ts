import crypto from 'crypto';
import { SkillManifest, McpServerManifest } from '../types.js';
import { ConflictReport, ConflictItem } from './types.js';
import { generateDiff } from './diff.js';

/**
 * Calculates a standard SHA-256 hex digest for a text payload.
 */
export function calculateSha256(content = ''): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Maps a SkillManifest to a lightweight ConflictItem representation.
 */
function toConflictItem(skill: SkillManifest): ConflictItem {
  const content = skill.rawContent || '';
  return {
    id: skill.id,
    name: skill.name,
    ecosystem: skill.targetEcosystem,
    sourcePath: skill.sourcePath,
    contentHash: calculateSha256(content),
    content,
    description: skill.description,
  };
}

/**
 * Detects Tier 1 exact collisions: duplicate skill names across ecosystems
 * or identical content hashes.
 */
export function detectExactSkillConflicts(skills: SkillManifest[]): ConflictReport[] {
  const reports: ConflictReport[] = [];
  const processedPairs = new Set<string>();

  // 1. Group by exact normalized name
  const byName = new Map<string, SkillManifest[]>();
  for (const skill of skills) {
    const norm = skill.name.trim().toLowerCase();
    const list = byName.get(norm) || [];
    list.push(skill);
    byName.set(norm, list);
  }

  for (const [normName, group] of byName.entries()) {
    if (group.length > 1) {
      // Group has exact name collision
      const items = group.map(toConflictItem);
      const first = items[0];
      const second = items[1];

      const diffSummary = generateDiff(
        first.content || '',
        second.content || '',
        { oldHeader: `${first.ecosystem}/${first.name}`, newHeader: `${second.ecosystem}/${second.name}` }
      );

      const isExactMatch = first.contentHash === second.contentHash;
      const reportId = `exact-name-${normName}-${first.id}-${second.id}`;

      reports.push({
        id: reportId,
        conflictType: 'DUPLICATE_NAME',
        severity: 'ERROR',
        title: `Duplicate Skill Name: ${first.name}`,
        description: `Found ${group.length} skills sharing identical name "${first.name}" across ecosystems.`,
        similarityScore: isExactMatch ? 1.0 : null,
        matchedSnippet: normName,
        items,
        diffSummary,
      });

      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          processedPairs.add(`${items[i].id}::${items[j].id}`);
          processedPairs.add(`${items[j].id}::${items[i].id}`);
        }
      }
    }
  }

  // 2. Group by content hash for skills with different names but identical content
  const byHash = new Map<string, SkillManifest[]>();
  for (const skill of skills) {
    const hash = calculateSha256(skill.rawContent || '');
    if (!hash) continue;
    const list = byHash.get(hash) || [];
    list.push(skill);
    byHash.set(hash, list);
  }

  for (const [hash, group] of byHash.entries()) {
    if (group.length > 1) {
      const items = group.map(toConflictItem);
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const key = `${items[i].id}::${items[j].id}`;
          if (!processedPairs.has(key)) {
            processedPairs.add(key);
            processedPairs.add(`${items[j].id}::${items[i].id}`);

            reports.push({
              id: `exact-hash-${hash.slice(0, 12)}-${items[i].id}-${items[j].id}`,
              conflictType: 'DUPLICATE_NAME',
              severity: 'WARNING',
              title: `Identical Content Hash Collision: ${items[i].name} & ${items[j].name}`,
              description: `Skills "${items[i].name}" and "${items[j].name}" share identical SHA-256 CAS content hash ${hash.slice(0, 12)}...`,
              similarityScore: 1.0,
              matchedSnippet: `Hash: ${hash.slice(0, 16)}`,
              items: [items[i], items[j]],
            });
          }
        }
      }
    }
  }

  return reports;
}

/**
 * Detects MCP tool collisions where multiple MCP servers declare identical tool names.
 */
export function detectMcpToolCollisions(servers: McpServerManifest[]): ConflictReport[] {
  const toolToServer = new Map<string, McpServerManifest[]>();

  for (const server of servers) {
    if (!server.tools || server.tools.length === 0) continue;
    for (const tool of server.tools) {
      const toolName = tool.name.trim();
      const list = toolToServer.get(toolName) || [];
      list.push(server);
      toolToServer.set(toolName, list);
    }
  }

  const reports: ConflictReport[] = [];

  for (const [toolName, serverList] of toolToServer.entries()) {
    if (serverList.length > 1) {
      const items: ConflictItem[] = serverList.map((server) => ({
        id: server.id,
        name: server.name,
        ecosystem: 'mcp',
        sourcePath: server.sourceConfigPath || 'mcp-config',
        contentHash: calculateSha256(`${server.id}:${toolName}`),
        toolNames: server.tools?.map((t) => t.name) || [],
        description: server.description || server.serverInfo?.description,
      }));

      reports.push({
        id: `mcp-tool-collision-${toolName}`,
        conflictType: 'MCP_TOOL_COLLISION',
        severity: 'ERROR',
        title: `Colliding MCP Tool Name: ${toolName}`,
        description: `Multiple MCP servers declare tool "${toolName}": ${serverList.map((s) => s.name).join(', ')}.`,
        similarityScore: null,
        matchedSnippet: toolName,
        items,
      });
    }
  }

  return reports;
}

/**
 * Aggregates Tier 1 exact skill collisions and MCP tool collisions.
 */
export function detectTier1Conflicts(
  skills: SkillManifest[],
  mcpServers: McpServerManifest[] = []
): ConflictReport[] {
  const skillConflicts = detectExactSkillConflicts(skills);
  const mcpConflicts = detectMcpToolCollisions(mcpServers);
  return [...skillConflicts, ...mcpConflicts];
}
