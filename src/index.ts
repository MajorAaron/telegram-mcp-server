import express, { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./mcp-server.js";
import { startBot } from "./telegram.js";

const app = express();
app.use(express.json());

const server = createMcpServer();

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "telegram-mcp-server",
    version: "1.0.0",
    status: "running",
    mcp_endpoint: "/mcp",
  });
});

app.post("/mcp", async (req: Request, res: Response) => {
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req: Request, res: Response) => {
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    })
  );
});

app.delete("/mcp", async (req: Request, res: Response) => {
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    })
  );
});

const PORT = process.env.PORT || 3000;

async function main() {
  await server.connect(transport);
  console.log("MCP server connected to transport");

  await startBot();

  app.listen(PORT, () => {
    console.log(`Telegram MCP server listening on port ${PORT}`);
    console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
