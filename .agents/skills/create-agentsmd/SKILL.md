---
name: create-agentsmd
description: 'Prompt for generating an AGENTS.md file for a repository'
---

# Create a high-quality AGENTS.md

You are a code agent. Create `AGENTS.md` at the repository root following the open format at https://agents.md/. This file is read by any coding agent that works on this project — it must be accurate, actionable, and free of placeholder text.

AGENTS.md is compatible with 20+ agent tools. For monorepos, additional AGENTS.md files can be placed in subdirectories; the nearest file takes precedence.

## Workflow

### 1. Analyze the project

- Read `package.json` (or `Cargo.toml`, `pyproject.toml`, `go.mod`, etc.) for the package manager, scripts, and dependencies.
- Check CI config files (`.github/workflows/`, `Makefile`, etc.) for the canonical build/test commands.
- Scan the directory structure to understand the architecture (monorepo, SPA, server, library, etc.) and key source paths.
- Note the language, framework, test runner, and any linter/formatter in use.

### 2. Write AGENTS.md

Produce a single Markdown file covering at minimum:

- **Project overview** — what it does, the tech stack, and any unusual architectural constraints (e.g., browser-only, no backend).
- **Setup** — exact commands to install dependencies and start the development server.
- **Build** — exact command and what it produces.
- **Testing** — how to run all tests, how to run a single test by name or file, the test file naming convention, and the test environment.
- **Code style** — language/framework conventions in use, file organisation rules, and anything explicitly *not* used (e.g., "no CSS framework", "no global state library").
- **Architecture** — component/module layout, key data-flow paths, storage layer, entry points.
- **PR guidelines** — what to run before opening a PR (build + test at minimum).

### 3. Quality rules

- **No placeholder text.** Every command must be the real, runnable command for this project.
- **Verify commands.** Confirm that each listed command exists in the project's scripts or toolchain before writing it.
- **No vendor names.** Do not mention any specific agent tool, IDE, or AI assistant by name — keep instructions generic.
- **No secrets.** Do not include API keys, tokens, or credentials.
- **Be concise.** Omit sections that don't apply. Agents read this every run; keep it focused.
