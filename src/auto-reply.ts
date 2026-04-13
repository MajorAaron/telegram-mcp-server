import { loadHistory, saveMessage } from "./db.js";
import { getReply } from "./claude.js";
import { getBot } from "./telegram.js";

const HISTORY_LIMIT = parseInt(process.env.HISTORY_LIMIT || "50", 10);

export async function handleAutoReply(
  chatId: number,
  userMessage: string
): Promise<void> {
  const bot = getBot();

  // Send typing indicator
  await bot.api.sendChatAction(chatId, "typing").catch(() => {});

  // Save user message
  await saveMessage(chatId, "user", userMessage);

  // Load conversation history (excluding the message we just saved — it's passed separately)
  const history = await loadHistory(chatId, HISTORY_LIMIT);
  // Remove the last entry since it's the message we just saved
  const priorHistory = history.slice(0, -1);

  try {
    const reply = await getReply(chatId, priorHistory, userMessage);

    // Save assistant response
    await saveMessage(chatId, "assistant", reply);

    // Send reply via Telegram — split if too long (Telegram limit is 4096 chars)
    if (reply.length <= 4096) {
      await bot.api.sendMessage(chatId, reply);
    } else {
      const chunks = splitMessage(reply, 4096);
      for (const chunk of chunks) {
        await bot.api.sendMessage(chatId, chunk);
      }
    }
  } catch (error) {
    console.error("Auto-reply error:", error);
    await bot.api
      .sendMessage(chatId, "Sorry, I ran into an error processing your message. Please try again.")
      .catch(() => {});
  }
}

function splitMessage(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Try to split at a newline
    let splitIdx = remaining.lastIndexOf("\n", maxLen);
    if (splitIdx <= 0) splitIdx = maxLen;
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }
  return chunks;
}
