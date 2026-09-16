# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
## [Unreleased]

### Added
- Core Discovery Scanner in `src/core/scanner/` to inspect Gemini CLI and Claude Code skills and MCP servers.
- Resilient JSON/YAML parsing with `Promise.allSettled` to isolate corrupt files and missing configuration paths.
- REST API routes on `127.0.0.1:3900` (`GET /api/skills`, `GET /api/skills/:id`, `GET /api/mcp`).
- GitHub Primer React components: `DiscoveryTable` with instant client-side search and ecosystem badges.
- Dedicated `SkillDetailView` with breadcrumb navigation (`← Back to Discovery`), metadata sidebar, and rendered `SKILL.md` markdown viewer.
- Full automated test suite across unit, component, resilience, and API integration layers with 100% test pass rate.
