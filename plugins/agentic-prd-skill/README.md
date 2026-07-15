# agentic-prd Claude Code plugin

Companion plugin for [`@agentic-prd/dev-plugin`](../../packages/dev-plugin).
Drive the comment-pin loop from Claude Code: one-shot setup, drain open threads,
inspect/resolve/reply, sync spec docs.

## Install (no clone needed)

```
/plugin marketplace add CreeJee/agentic-prd
/plugin install agentic-prd@agentic-prd
```

Then, in an app with the dev server running: `/agentic-prd:list-threads`.
To set up a fresh app end-to-end: `/agentic-prd:setup`.

Alternatives:

- Skill only (no slash commands), via [`npx skills`](https://github.com/vercel-labs/skills):

  ```bash
  npx skills add CreeJee/agentic-prd
  ```

- From a clone of this repo:

  ```bash
  pnpm skill:install        # symlinks this directory into ~/.claude/plugins
  # flags: --copy (copy instead of symlink), --force (replace existing), --dest <dir>
  ```

- Let any coding agent do the whole setup: hand it
  [`llms-install.md`](../../llms-install.md).

## Local development (this repo)

```
/plugin marketplace add /path/to/agentic-prd
/plugin install agentic-prd@agentic-prd
```

Validate before pushing: `claude plugin validate .` from the repo root.
