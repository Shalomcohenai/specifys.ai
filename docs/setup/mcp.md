# Specifys.ai MCP Server Setup

Use the Specifys MCP server from **Cursor** or **Claude Desktop** to read and update your app specifications and access the Vibe Coding tools list.

## Prerequisites

- **Backend** running (local or production). For **per-user** usage (recommended), no MCP-related env vars are required on the backend.
- **Node.js 18+** for running the MCP server.

## 1. Get an API key (per user – recommended)

Each user has their own key. The backend does **not** need `MCP_API_KEY` or `MCP_API_USER_ID` in this mode.

- **From the website:** Log in → **Profile** → **Personal Info** → section **MCP API Key**. Click **Create API key** (or **Regenerate**). Copy the key once; it is not shown again.
- **From the API (logged-in user):**
  - `GET /api/users/me/mcp-api-key` – check if you already have a key (`hasKey: true/false`).
  - `POST /api/users/me/mcp-api-key` – create a new key. Response includes `apiKey`; store it securely. Send `{ "regenerate": true }` to replace an existing key.
- Use that key as `SPECIFYS_API_KEY` in your MCP client (Cursor / Claude Desktop). The backend identifies you by this key and returns only your specs.

**Optional (single-user / dev only):** In the backend `.env`, set `MCP_API_KEY` and `MCP_API_USER_ID` to one fixed user, then use that key in the MCP server.

## 2. Build and run the MCP server

```bash
cd mcp-server
npm install
npm run build
```

Set environment variables (or pass them when starting the process):

- `SPECIFYS_API_KEY` or `MCP_API_KEY` – your API key.
- `SPECIFYS_API_BASE_URL` or `MCP_API_BASE_URL` – optional; default is `http://localhost:10000`.

Run the server (stdio):

```bash
SPECIFYS_API_KEY=your_key node dist/index.js
```

Or with a custom base URL:

```bash
SPECIFYS_API_KEY=your_key SPECIFYS_API_BASE_URL=https://your-backend.com node dist/index.js
```

## 3. Connect Cursor

In Cursor settings, add an MCP server. Example config (path and env depend on your setup):

**Option A – env in shell**

```json
{
  "mcpServers": {
    "specifys": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/specifys-ai/mcp-server/dist/index.js"],
      "env": {
        "SPECIFYS_API_KEY": "YOUR_API_KEY",
        "SPECIFYS_API_BASE_URL": "http://localhost:10000"
      }
    }
  }
}
```

**Option B – env file**

Run the server with env vars loaded (e.g. from a `.env` file in `mcp-server/`) and reference the same `command` and `args` as above.

Replace `/ABSOLUTE/PATH/TO/specifys-ai` with your project path. On Windows use `C:\\path\\to\\specifys-ai\\mcp-server\\dist\\index.js`.

## 4. Connect Claude Desktop

Edit the Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add:

```json
{
  "mcpServers": {
    "specifys": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/specifys-ai/mcp-server/dist/index.js"],
      "env": {
        "SPECIFYS_API_KEY": "YOUR_API_KEY",
        "SPECIFYS_API_BASE_URL": "https://your-backend.com"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

## 5. What you get

**Tools**

- `list_my_specs` – List your specs (metadata).
- `get_spec`, `get_spec_overview`, `get_spec_technical`, `get_spec_design` – Read a spec or a section.
- `get_spec_prompts` – Prompt templates reference.
- `update_spec_overview`, `update_spec_technical`, `update_spec_design`, `update_spec_market` – Update a section of a spec.

**Resources**

- `spec://{specId}` – Full spec content (read).
- `specifys://tools` – Vibe Coding tools list (read).

## Troubleshooting

- **"API key required"** – Set `SPECIFYS_API_KEY` (or `MCP_API_KEY`) in the env used to start the MCP server.
- **401 / Invalid API key** – Key must match backend `MCP_API_KEY` (env) or `users/{uid}.mcpApiKey` (Firestore).
- **Connection refused** – Start the backend and/or set `SPECIFYS_API_BASE_URL` to the correct URL (e.g. `http://localhost:10000` for local).
