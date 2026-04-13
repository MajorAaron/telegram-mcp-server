# Autonomous Telegram Bot with Tool Use

## Summary

Upgrade the Telegram MCP server so the bot autonomously responds to messages using the Claude API. Conversations are persisted in Turso. Claude has tools for searching conversation history and deploying sites to Netlify.

## Architecture

Message flow:
1. User sends message to bot on Telegram
2. Bot loads last 50 messages for that chat from Turso
3. Bot calls Claude API with conversation history + new message + available tools
4. Claude may call tools (search history, deploy site) — bot executes them in a loop
5. Bot sends Claude's final text response back via Telegram
6. Both user message and assistant response are saved to Turso

The existing MCP server (tools for Claude Code) remains unchanged. Auto-reply is additive.

## Data Model (Turso)

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  chat_id INTEGER NOT NULL,
  role TEXT NOT NULL,        -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_chat_id_time ON conversations(chat_id, created_at);
```

## Tools (Claude API tool_use)

### search_history
- **Purpose:** Search older conversation messages beyond the last 50
- **Params:** `query` (string, keyword search), `limit` (number, default 20)
- **Returns:** Matching messages with timestamps

### deploy_site
- **Purpose:** Deploy HTML content to Netlify
- **Params:** `site_name` (string), `html_content` (string), `title` (string, optional)
- **Returns:** Deployed site URL

## File Structure

```
src/
  index.ts          — Express server + MCP (unchanged)
  mcp-server.ts     — MCP tools for Claude Code (unchanged)
  telegram.ts       — Bot setup + auto-reply handler (modified)
  claude.ts          — NEW: Anthropic SDK wrapper, tool use loop
  db.ts              — NEW: Turso client, conversation CRUD
  tools/
    index.ts         — Tool registry and definitions
    search-history.ts — Search conversation DB
    deploy-site.ts    — Netlify deployment
```

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| TELEGRAM_BOT_TOKEN | Telegram bot token | required |
| ANTHROPIC_API_KEY | Claude API key | required |
| CLAUDE_MODEL | Model to use | claude-sonnet-4-6-20250514 |
| TURSO_DATABASE_URL | Turso HTTP URL | required |
| TURSO_AUTH_TOKEN | Turso auth token | required |
| NETLIFY_AUTH_TOKEN | Netlify API token | required |
| HISTORY_LIMIT | Messages loaded into context | 50 |

## System Prompt

General-purpose assistant named Ryu. Conversational, helpful, concise. Knows it's talking via Telegram. Can search its own conversation history and deploy simple websites.

## Constraints

- Last 50 messages loaded automatically; older messages via search_history tool
- Tool use loop limited to 10 iterations to prevent runaway calls
- Messages saved to Turso after each exchange
- MCP server tools remain functional alongside auto-reply

## Future

Architecture supports scoped agents by swapping system prompt and tool set per bot instance.
