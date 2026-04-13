import { createClient, type Client } from "@libsql/client";
import { randomUUID } from "node:crypto";

let client: Client | null = null;

export function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) {
      throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required");
    }
    client = createClient({ url, authToken });
  }
  return client;
}

export async function initDb(): Promise<void> {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      chat_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_chat_id_time ON conversations(chat_id, created_at)
  `);
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  created_at: number;
}

export async function loadHistory(chatId: number, limit: number = 50): Promise<ConversationMessage[]> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT role, content, created_at FROM conversations
          WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?`,
    args: [chatId, limit],
  });
  return result.rows
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content as string,
      created_at: row.created_at as number,
    }))
    .reverse();
}

export async function saveMessage(
  chatId: number,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO conversations (id, chat_id, role, content, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [randomUUID(), chatId, role, content, Math.floor(Date.now() / 1000)],
  });
}

export async function searchHistory(
  chatId: number,
  query: string,
  limit: number = 20
): Promise<ConversationMessage[]> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT role, content, created_at FROM conversations
          WHERE chat_id = ? AND content LIKE ?
          ORDER BY created_at DESC LIMIT ?`,
    args: [chatId, `%${query}%`, limit],
  });
  return result.rows
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content as string,
      created_at: row.created_at as number,
    }))
    .reverse();
}
