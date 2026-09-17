# User Guide

This guide covers setup, discovery workflows, and the Conflict Detection and Resolution Engine.

---

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Quick Start](#2-quick-start)
3. [Conflict Detection & Resolution](#3-conflict-detection--resolution)
4. [Central Store & Symlink Management](#4-central-store--symlink-management)
5. [Troubleshooting & Logs](#5-troubleshooting--logs)

---

## 1. System Requirements

- macOS, Linux, or Windows (WSL2 recommended)
- Node.js >= 18.0.0
- npm >= 9.0.0

---

## 2. Quick Start

1. Start the server and client concurrently:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:5173` in your browser.
3. Click "Refresh Discovery" in the top bar to scan all registered assistant directories.

---

## 3. Conflict Detection & Resolution

KoSkill automatically runs tiered conflict analysis across all discovered skills, workflows, and MCP servers:

### Conflict Tiers

1. **Tier 1 (Exact Collisions & MCP Tool Overlaps)**:
   - Duplicate Skill Names across ecosystems (e.g. Gemini and Claude both declaring a skill named `git-helper`).
   - Content Hash Identical Matches where files share identical SHA-256 CAS hashes despite differing folder names.
   - MCP Tool Name Collisions where two active MCP servers declare identical tool names.
2. **Tier 2 (Semantic Duplicates)**:
   - Skills with different names whose prompt directives exhibit 85% or higher cosine similarity via local ONNX embeddings (`all-MiniLM-L6-v2`).
3. **Tier 3 (Instruction Divergence)**:
   - Workflows or skills that share the exact same trigger command (such as `/deploy`) but contain conflicting prompt instructions.

### Resolving Conflicts

When conflicts are detected, an alert counter badge appears on the "Conflicts" tab:
1. Navigate to the **Conflicts** tab in the top navigation bar.
2. Review the list of active conflicts, severity ratings (`ERROR` or `WARNING`), and calculated semantic match percentages.
3. Click **Review & Resolve** to open the side-by-side Diff Viewer.
4. Choose an action:
   - **Option 1 (PICK)**: Select "Keep <Item Name>". KoSkill preserves the winner, automatically backs up previous versions into `~/.koskill/backups/`, and archives superseded files into `~/.koskill/archive/`.
   - **Option 2 (ALIAS)**: Type a new unique name and click "Apply Alias" to rename conflicting items without deleting source files.
   - **Option 3 (MERGE)**: Click "Merge Definitions" to combine configurations into a single unified skill.

### Race Condition Protection

KoSkill enforces optimistic Compare-And-Swap (CAS) SHA-256 verification before writing any changes. If a skill file was modified on disk after conflict detection was run, the resolution is rejected with `E_STALE_HASH`, preserving your work from unintended overwrites.

---

## 4. Central Store & Symlink Management

Centralize items into `~/.koskill/` to synchronize prompts across multiple AI agent tools:
- Click **Centralize** on any skill card to migrate it to `~/.koskill/skills/<name>` and create transparent symlinks back to source directories.
- Click **Revert** at any time to restore standalone directories without breaking dependencies.

---

## 5. Troubleshooting & Logs

- Structured runtime logs are written to `log/agent.log`.
- To inspect active HTTP daemon health:
  ```bash
  curl http://127.0.0.1:3900/api/health
  ```
- To verify current conflict reports via curl:
  ```bash
  curl http://127.0.0.1:3900/api/conflicts
  ```
