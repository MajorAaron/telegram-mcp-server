import { searchHistory } from "../db.js";

export async function executeSearchHistory(
  chatId: number,
  params: { query: string; limit?: number }
): Promise<string> {
  const messages = await searchHistory(chatId, params.query, params.limit ?? 20);
  if (messages.length === 0) {
    return "No matching messages found in conversation history.";
  }
  return messages
    .map((m) => {
      const date = new Date(m.created_at * 1000).toISOString();
      return `[${date}] ${m.role}: ${m.content}`;
    })
    .join("\n");
}
