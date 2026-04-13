import { Bot, Context } from "grammy";
import { handleAutoReply } from "./auto-reply.js";

export interface TelegramMessage {
  messageId: number;
  chatId: number;
  chatType: string;
  chatTitle?: string;
  fromId?: number;
  fromUsername?: string;
  fromFirstName?: string;
  text?: string;
  date: number;
}

const messageBuffer: TelegramMessage[] = [];
const MAX_BUFFER_SIZE = 100;

let bot: Bot | null = null;

export function getBot(): Bot {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");
    }
    bot = new Bot(token);

    bot.on("message", (ctx: Context) => {
      const msg = ctx.message;
      if (!msg) return;

      const entry: TelegramMessage = {
        messageId: msg.message_id,
        chatId: msg.chat.id,
        chatType: msg.chat.type,
        chatTitle: "title" in msg.chat ? msg.chat.title : undefined,
        fromId: msg.from?.id,
        fromUsername: msg.from?.username,
        fromFirstName: msg.from?.first_name,
        text: "text" in msg ? msg.text : undefined,
        date: msg.date,
      };

      messageBuffer.push(entry);
      if (messageBuffer.length > MAX_BUFFER_SIZE) {
        messageBuffer.shift();
      }

      // Auto-reply using Claude API (only for text messages)
      if (entry.text) {
        handleAutoReply(entry.chatId, entry.text).catch((err) => {
          console.error("Auto-reply failed:", err);
        });
      }
    });
  }
  return bot;
}

export function getBufferedMessages(limit: number = 50): TelegramMessage[] {
  return messageBuffer.slice(-limit);
}

export function clearBuffer(): void {
  messageBuffer.length = 0;
}

export async function startBot(): Promise<void> {
  const b = getBot();
  console.log("Starting Telegram bot...");
  b.start({
    onStart: (botInfo) => {
      console.log(`Telegram bot @${botInfo.username} is running`);
    },
  });
}
