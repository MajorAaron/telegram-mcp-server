import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./mcp-server.js";
import { startBot } from "./telegram.js";

const app = express();
app.use(express.json());

// Store transports by session ID for stateful connections
const transports = new Map<string, StreamableHTTPServerTransport>();

app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "telegram-mcp-server",
    version: "1.0.0",
    status: "running",
    mcp_endpoint: "/mcp",
  });
});

app.post("/mcp", async (req: Request, res: Response) => {
  console.log("POST /mcp", JSON.stringify(req.body?.method || req.body));
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  // Reuse existing transport for this session
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
    return;
  }

  // New session: create transport and server
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) transports.delete(sid);
  };

  const server = createMcpServer();
  await server.connect(transport);

  // Store transport after connection (sessionId is now set)
  if (transport.sessionId) {
    transports.set(transport.sessionId, transport);
  }

  try {
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling GET /mcp:", error);
      if (!res.headersSent) {
        res.status(500).end();
      }
    }
    return;
  }
  res.status(400).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "No valid session. Send initialize first via POST." },
    id: null,
  });
});

app.delete("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling DELETE /mcp:", error);
      if (!res.headersSent) {
        res.status(500).end();
      }
    }
    transports.delete(sessionId);
    return;
  }
  res.status(400).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "No valid session." },
    id: null,
  });
});

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    await startBot();
    console.log("Telegram bot started");
  } catch (error) {
    console.warn("Telegram bot failed to start:", error);
    console.warn("MCP server will run without bot polling. Tools will error when called.");
  }

  app.listen(PORT, () => {
    console.log(`Telegram MCP server listening on port ${PORT}`);
    console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
