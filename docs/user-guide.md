# User Guide

This guide covers setup, discovery workflows, and the Conflict Detection and Resolution Engine.

---

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Quick Start](#2-quick-start)
3. [Conflict Detection & Resolution](#3-conflict-detection--resolution)
4. [Activation Toggles](#4-activation-toggles)
5. [Backup & Restore Packaging](#5-backup--restore-packaging)
6. [Local Credential Vault](#6-local-credential-vault)
7. [Central Store & Symlink Management](#7-central-store--symlink-management)
8. [Troubleshooting & Logs](#8-troubleshooting--logs)

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

## 4. Activation Toggles

KoSkill enables you to disable or re-enable individual skills, workflows, and MCP servers without deleting files:
- Click the **Active / Inactive** toggle switch next to any skill, workflow, or MCP server.
- Toggling modifies the underlying filesystem state (such as appending `.disabled` to directory and file names or updating MCP registry states).
- Disabled items are immediately ignored by external CLI tools, IDE extensions, and AI coding agents.
- Toggling can also be executed via REST API:
  ```bash
  curl -X POST http://127.0.0.1:3900/api/skills/my-skill/toggle \
    -H "Content-Type: application/json" \
    -d '{"enabled": false}'
  ```

---

## 5. Backup & Restore Packaging

Migrate your curated skills, workflows, MCP servers, and transaction history between developer machines:
- Click **Backup** in the header or Settings tab to open the Backup & Restore dialog.
- **Export**: Click "Export Backup" to generate a compressed `.tar.gz` archive with embedded `backup-manifest.json`. Local credentials are automatically excluded by default for security.
- **Import**: Enter the archive file path and click "Import Archive".
- **Tar-Slip Protection**: The importer verifies all archive entries before extraction, blocking any malicious path traversal attempts (`..` or absolute paths).
- **Collision Safeguards**: Pre-existing files are protected unless the "Overwrite existing items" option is checked.

---

## 6. Local Credential Vault

Safely configure and store API credentials for your coding assistants and MCP tools without exposing plaintext in git repositories:
- Click **Vault** in the header or Settings tab to open the Credential Vault drawer.
- **Masked Previews**: Stored keys (e.g., `OPENAI_API_KEY`) display masked tokens (e.g., `sk-...48a9`) so secrets are never displayed in full or leaked in logs.
- **Strict POSIX Permissions**: The vault directory `~/.koskill/vault/` is secured with mode `0700`, and `secrets.json` is secured with mode `0600` (strictly readable and writable by the file owner only).
- **Add / Update Secret**: Enter the key name and secret value to save atomically with `.bak` rollback protection.

---

## 7. Central Store & Symlink Management

Centralize items into `~/.koskill/` to synchronize prompts across multiple AI agent tools:
- Click **Centralize** on any skill card to migrate it to `~/.koskill/skills/<name>` and create transparent symlinks back to source directories.
- Click **Revert** at any time to restore standalone directories without breaking dependencies.

---

## 8. Troubleshooting & Logs

- Structured runtime logs are written to `log/agent.log`.
- To inspect active HTTP daemon health:
  ```bash
  curl http://127.0.0.1:3900/api/health
  ```
- To verify current conflict reports via curl:
  ```bash
  curl http://127.0.0.1:3900/api/conflicts
  ```
- To view masked vault keys via curl:
  ```bash
  curl http://127.0.0.1:3900/api/vault
  ```
