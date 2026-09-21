# KoSkill Auto-Router & Meta-MCP Server Design

## Summary
The **KoSkill Auto-Router & Meta-MCP Server** serves as a single unified Model Context Protocol (MCP) endpoint for local AI coding assistants (Antigravity/Gemini, Claude Code, Cursor, Codex). Powered by the embedded Hybrid Search Engine ([009-hybrid-search-engine-sqlite-vec-bm25.md](../_tickets/done/009-hybrid-search-engine-sqlite-vec-bm25.md)), it dynamically indexes, searches, and provisions hundreds of skills, workflows, and downstream MCP tools strictly on demand. By exposing exactly three consolidated meta-tools (`discover_capabilities`, `invoke_tool`, `load_skill`), the router eliminates prompt context exhaustion (sparing 20k to 50k+ tokens per prompt) while delivering live transaction telemetry and token savings tracking in the KoSkill UI. Visual architecture and UI prototypes are documented in [008-auto-router-design-visual.html](./008-auto-router-design-visual.html).

## Terms
- **Auto-Router**: KoSkill's unified Meta-MCP server providing on-demand discovery and execution for skills, workflows, and MCP tools.
  *Avoid:* Proxy Daemon, MCP Gateway.
- **Downstream MCP**: Underlying individual MCP servers (e.g. `chrome-devtools`, `github`) managed as child processes by KoSkill.
  *Avoid:* Backend Server, Sub-server.
- **Capability**: A searchable actionable entity (Skill, Workflow, or MCP Tool) indexed in the hybrid catalog.
  *Avoid:* Plugin, Action.

## Why
Developers configuring dozens of MCP servers and markdown skills currently register them statically into agent configuration files (`mcp_config.json`, `claude_desktop_config.json`). Preloading hundreds of tool definitions and skill prompts exhausts agent context windows (20k to 50k+ tokens per prompt), degrades tool-selection precision, and triggers model rate limits. Agents also lack a unified way to discover skills and tools relevant to a user query in a single step. KoSkill solves this with an intelligent on-demand router that provisions tools and workflows dynamically while keeping agent prompt overhead virtually zero.

## Locked Decisions

### Q1: Auto-Router Install/Uninstall Configuration Management & Symlink Takeover
- **Decision:** Interactive Web UI toggle in KoSkill settings with a dry-run preview before touching filesystem symlinks and markdown prompt files, using the established `.disabled` suffix rename pattern.
- **Rejected Option A (CLI-only commands):** Rejected because developers prefer visual dry-run safety, one-click toggles, and immediate visual feedback within the running KoSkill dashboard.
- **Rejected Option C (Symlink removal only without prompt rules):** Rejected because without agent instructions in `GEMINI.md`/`CLAUDE.md`, coding assistants would not know to invoke `discover_capabilities` autonomously.

### Q2: Downstream MCP Server Process Lifecycle & Pooling
- **Decision:** Lazy on-demand spawn with LRU/idle timeout (5 minutes of inactivity) and a maximum active process cap (5 concurrent servers).
- **Rejected Option B (Indefinite keep-alive):** Rejected because holding dozens of idle MCP servers open exhausts system file descriptors, locks external sockets, and consumes excess memory.
- **Rejected Option C (Ephemeral per-call execution):** Rejected because spawning Node/Python child processes per `invoke_tool` call introduces an unacceptable 300ms to 800ms latency penalty.

### Q7: Meta-MCP Stdio Process Telemetry & IPC to Web UI Server
- **Decision:** File-based SQLite/JSONL WAL ring buffer located at `~/.koskill/cache/router_tx.log` that the Web server tails and broadcasts via Server-Sent Events (`GET /api/router/stream`).
- **Rejected Option B (HTTP loopback POSTs):** Rejected because loopback network requests introduce port collisions, firewall prompts, and dropped telemetry when the Web UI is closed.
- **Rejected Option C (Unix Domain Sockets):** Rejected because named sockets add cross-platform complexity and require delicate orphan cleanup upon unexpected shutdowns.

## Routine Choices
- **Q3: Capability Discovery Format:** `discover_capabilities` returns condensed argument summary strings (`< 150 tokens` per capability) with property names, types, and required flags, powered by the Ticket 009 Hybrid Search Engine (`sqlite-vec` dense cosine similarity + SQLite FTS5 BM25 with RRF ranking). Search is fortified with stop-word pruning, technical compound term normalization (`code base` <-> `codebase`), candidate pool scaling (`fetchLimit = max(limit * 5, 120)`), query category intent weighting, and MCP server context enrichment (`instructions.md` and server description merged into tool representations).
- **Q4: Target AI Agents:** Automatic detection targets Antigravity (`~/.gemini/config/GEMINI.md`), Claude Code (`~/.claude/CLAUDE.md` and workspace `CLAUDE.md`), and Cursor (`.cursorrules`), injecting fenced `<!-- KOSKILL_ROUTER_START -->` instruction blocks.
- **Q5: Proxy Failure Isolation:** Strict 15-second per-call `AbortController` timeout with structured JSON-RPC error mapping, automatically restarting the child process if stdout framing corrupts or the child exits unexpectedly.
- **Q6: Skill Workflow Payload:** `load_skill(name)` returns the primary `SKILL.md` frontmatter and instructions directly, appending a lightweight index of available companion files in `references/` or `scripts/`.
- **Q8: Token Savings Calculation:** The "Estimated Tokens Saved" metric is calculated dynamically as the total token budget of all indexed capabilities in `~/.koskill` minus the tokens returned in the active turn.
- **Q9: Toggle Restart Guidance:** The Web UI displays a toast modal with agent-specific restart guidance (e.g. reload IDE session or run `/compact`) upon toggling the Auto-Router.

## Verified Facts
- `src/core/toggle/toggle-manager.ts` already implements non-destructive `.disabled` renaming, atomic state checking, and journal recording.
- `src/core/search/hybrid.ts` (`HybridSearchEngine`) is fully operational with vector and BM25 RRF scoring in Ticket 009.
- KoSkill client components use GitHub Primer tokens and standard UnderlineNav tabs, allowing seamless addition of the "Logs" tab.

## Risks
1. **Child Subprocess Zombie / Orphanage:** Child MCP processes could persist if the parent router is abruptly killed (`SIGKILL`).
   *Mitigation:* Track child PIDs in `~/.koskill/cache/pids.json` and sweep orphan PIDs during router boot and graceful shutdown.
2. **Downstream Stdout Pollution:** Buggy MCP servers emitting non-JSON debug logs to stdout break JSON-RPC framing.
   *Mitigation:* Implement strict line-based JSON-RPC parser that forwards non-JSON lines to debug logs without poisoning the RPC channel.
3. **Hybrid Search Cold-Start:** Initial discovery before vector embeddings finish computing could miss relevant candidates.
   *Mitigation:* Hybrid engine automatically falls back to SQLite FTS5 BM25 keyword matching until the local ONNX embedding pipeline is warm.

## Deferred
*None.* All technical and architectural questions were resolved during the interview.

## Open Threads
*None.* Discussion confirmed that appending `.disabled` to skill symlinks and injecting reversible fenced comments in prompt rule files provides a robust, non-destructive workflow.
