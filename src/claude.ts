import Anthropic from "@anthropic-ai/sdk";
import { toolDefinitions, executeTool } from "./tools/index.js";
import type { ConversationMessage } from "./db.js";

const MAX_TOOL_ITERATIONS = 10;

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

const SYSTEM_PROMPT = `You are Ryu, a helpful general-purpose assistant communicating via Telegram. You are conversational, concise, and friendly.

You have tools available:
- search_history: Search older conversation messages when you need context from past chats
- deploy_site: Deploy HTML pages to Netlify as live websites

Keep responses concise since this is a chat interface. Use Telegram-friendly formatting when helpful.`;

export async function getReply(
  chatId: number,
  history: ConversationMessage[],
  userMessage: string
): Promise<string> {
  const client = getClient();
  const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

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
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
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
