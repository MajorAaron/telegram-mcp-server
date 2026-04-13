import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getBot, getBufferedMessages, clearBuffer } from "./telegram.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "telegram-mcp",
    version: "1.0.0",
  });

  server.tool(
    "send_message",
    "Send a text message to a Telegram chat or channel",
    {
      chat_id: z.union([z.string(), z.number()]).describe("Chat ID or @channel_username"),
      text: z.string().describe("Message text to send"),
      parse_mode: z.enum(["HTML", "Markdown", "MarkdownV2"]).optional().describe("Text formatting mode"),
      reply_to_message_id: z.number().optional().describe("Message ID to reply to"),
    },
    async ({ chat_id, text, parse_mode, reply_to_message_id }) => {
      const bot = getBot();
      const result = await bot.api.sendMessage(chat_id, text, {
        parse_mode,
        reply_parameters: reply_to_message_id
          ? { message_id: reply_to_message_id }
          : undefined,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message_id: result.message_id,
              chat_id: result.chat.id,
              date: result.date,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_updates",
    "Get recent messages received by the bot. Returns buffered messages from chats the bot is in.",
    {
      limit: z.number().min(1).max(100).default(20).describe("Max number of messages to return"),
    },
    async ({ limit }) => {
      const messages = getBufferedMessages(limit);
      return {
        content: [
          {
            type: "text",
            text: messages.length > 0
              ? JSON.stringify(messages, null, 2)
              : "No messages in buffer. Make sure the bot has been added to a chat and has received messages.",
          },
        ],
      };
    }
  );

  server.tool(
    "get_chat_info",
    "Get information about a Telegram chat, channel, or group",
    {
      chat_id: z.union([z.string(), z.number()]).describe("Chat ID or @channel_username"),
    },
    async ({ chat_id }) => {
      const bot = getBot();
      const chat = await bot.api.getChat(chat_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(chat, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "forward_message",
    "Forward a message from one chat to another",
    {
      from_chat_id: z.union([z.string(), z.number()]).describe("Source chat ID"),
      to_chat_id: z.union([z.string(), z.number()]).describe("Destination chat ID"),
      message_id: z.number().describe("ID of the message to forward"),
    },
    async ({ from_chat_id, to_chat_id, message_id }) => {
      const bot = getBot();
      const result = await bot.api.forwardMessage(to_chat_id, from_chat_id, message_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message_id: result.message_id,
              forwarded_to: result.chat.id,
              date: result.date,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "pin_message",
    "Pin a message in a chat",
    {
      chat_id: z.union([z.string(), z.number()]).describe("Chat ID"),
      message_id: z.number().describe("Message ID to pin"),
      disable_notification: z.boolean().default(false).describe("Pin silently"),
    },
    async ({ chat_id, message_id, disable_notification }) => {
      const bot = getBot();
      await bot.api.pinChatMessage(chat_id, message_id, {
        disable_notification,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, pinned_message_id: message_id }),
          },
        ],
      };
    }
  );

  server.tool(
    "send_photo",
    "Send a photo to a Telegram chat",
    {
      chat_id: z.union([z.string(), z.number()]).describe("Chat ID or @channel_username"),
      photo_url: z.string().url().describe("URL of the photo to send"),
      caption: z.string().optional().describe("Photo caption"),
    },
    async ({ chat_id, photo_url, caption }) => {
      const bot = getBot();
      const result = await bot.api.sendPhoto(chat_id, photo_url, { caption });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message_id: result.message_id,
              chat_id: result.chat.id,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_me",
    "Get information about the bot itself",
    {},
    async () => {
      const bot = getBot();
      const me = await bot.api.getMe();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(me, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "clear_message_buffer",
    "Clear the buffered messages",
    {},
    async () => {
      clearBuffer();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: "Message buffer cleared" }),
          },
        ],
      };
    }
  );

  return server;
}
