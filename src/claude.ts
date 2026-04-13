import Anthropic from "@anthropic-ai/sdk";
import { getToolDefinitions, executeTool } from "./tools/index.js";
import { loadConfig } from "./config.js";
import type { ConversationMessage } from "./db.js";

const MAX_TOOL_ITERATIONS = 10;

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

export async function getReply(
  chatId: number,
  history: ConversationMessage[],
  userMessage: string
): Promise<string> {
  const client = getClient();
  const config = loadConfig();
  const tools = getToolDefinitions(config.enabledTools);

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const response = await client.messages.create({
      model: config.model,
      max_tokens: 4096,
      system: config.systemPrompt,
      tools: tools.length > 0 ? tools : undefined,
      messages,
    });

    // Check if Claude wants to use tools
    if (response.stop_reason === "tool_use") {
      // Add assistant response to messages
      messages.push({ role: "assistant", content: response.content });

      // Execute each tool call
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`Tool call: ${block.name}`, JSON.stringify(block.input));
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            chatId
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Extract text from final response
    const textBlocks = response.content.filter((b) => b.type === "text");
    return textBlocks.map((b) => b.text).join("\n") || "I couldn't generate a response.";
  }

  return "I hit the tool use limit. Let me know if you'd like me to continue.";
}
