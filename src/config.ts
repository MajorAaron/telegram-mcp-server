export interface BotConfig {
  name: string;
  model: string;
  systemPrompt: string;
  enabledTools: string[];
  historyLimit: number;
}

const DEFAULT_SYSTEM_PROMPT = `You are {name}, a helpful general-purpose assistant communicating via Telegram. You are conversational, concise, and friendly.

Keep responses concise since this is a chat interface. Use Telegram-friendly formatting when helpful.`;

export function loadConfig(): BotConfig {
  const name = process.env.BOT_NAME || "Ryu";
  const enabledTools = (process.env.TOOLS_ENABLED || "search_history,deploy_site")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const rawPrompt = process.env.BOT_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;
  const systemPrompt = rawPrompt.replace(/\{name\}/g, name);

  return {
    name,
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
    systemPrompt,
    enabledTools,
    historyLimit: parseInt(process.env.HISTORY_LIMIT || "50", 10),
  };
}
