# Mindlore MCP Server — Host Configuration

## Claude Code (.claude/settings.json)

```json
{
  "mcpServers": {
    "mindlore": {
      "command": "npx",
      "args": ["mindlore", "mcp"],
      "env": { "MINDLORE_HOME": "/path/to/.mindlore" }
    }
  }
}
```

## Cursor (.cursor/mcp.json)

```json
{
  "mcpServers": {
    "mindlore": {
      "command": "npx",
      "args": ["mindlore", "mcp"],
      "env": { "MINDLORE_HOME": "/path/to/.mindlore" }
    }
  }
}
```

## Claude Desktop (claude_desktop_config.json)

```json
{
  "mcpServers": {
    "mindlore": {
      "command": "npx",
      "args": ["mindlore", "mcp"],
      "env": { "MINDLORE_HOME": "/path/to/.mindlore" }
    }
  }
}
```

## MINDLORE_HOME

- Set edilmezse: `cwd/.mindlore/` → `~/.mindlore/` fallback
- Proje başına farklı KB kullanmak için her host config'inde farklı MINDLORE_HOME set edin
