# agentic-prd Claude Code skill

Companion skill for [`@agentic-prd/dev-plugin`](../../packages/dev-plugin). Use natural language commands inside Claude Code to interact with a running widget dev server.

## Install

Copy or symlink this directory into `~/.claude/plugins/`:

```bash
ln -s "$(pwd)/plugins/agentic-prd-skill" "$HOME/.claude/plugins/agentic-prd-skill"
```

Restart Claude Code. Verify the skill loads by running `/agentic-prd:list-threads` from a workspace that has `pnpm play` running.
