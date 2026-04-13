import type Anthropic from "@anthropic-ai/sdk";
import { executeSearchHistory } from "./search-history.js";
import { executeDeploySite } from "./deploy-site.js";

const ALL_TOOLS: Record<string, Anthropic.Tool> = {
  search_history: {
    name: "search_history",
    description:
      "Search older conversation messages beyond what's loaded in context. Use when the user references past conversations or you need more context.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Keyword or phrase to search for in conversation history",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 20)",
        },
      },
      required: ["query"],
    },
  },
  deploy_site: {
    name: "deploy_site",
    description:
      "Deploy an HTML page to Netlify as a live website. Use when the user asks you to build, create, or host a simple website or page.",
    input_schema: {
      type: "object" as const,
      properties: {
        site_name: {
          type: "string",
          description:
            "Unique site name for Netlify (becomes site-name.netlify.app). Use lowercase and hyphens only.",
        },
        html_content: {
          type: "string",
          description: "Full HTML content to deploy. Can be a complete HTML document or just body content.",
        },
        title: {
          type: "string",
          description: "Page title (optional, defaults to site_name)",
        },
      },
      required: ["site_name", "html_content"],
    },
  },
};

export function getToolDefinitions(enabledTools: string[]): Anthropic.Tool[] {
  return enabledTools
    .filter((name) => ALL_TOOLS[name])
    .map((name) => ALL_TOOLS[name]);
}

export function registerTool(name: string, definition: Anthropic.Tool): void {
  ALL_TOOLS[name] = definition;
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  chatId: number
): Promise<string> {
  switch (toolName) {
    case "search_history":
      return executeSearchHistory(chatId, input as { query: string; limit?: number });
    case "deploy_site":
      return executeDeploySite(
        input as { site_name: string; html_content: string; title?: string }
      );
    default:
      return `Unknown tool: ${toolName}`;
  }
}
