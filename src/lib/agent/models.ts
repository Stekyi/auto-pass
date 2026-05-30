// ─── Multi-provider LLM Abstraction ──────────────────────────────────────────
// Supports Anthropic (Claude) and OpenAI. Configured via admin settings.
// New providers can be added by implementing the `ModelResponse` contract.

import type { ChatMessage, ToolCall } from "./state";
import type { ToolDefinition } from "./tools";
export type { ToolDefinition };

export interface ModelConfig {
  provider: "anthropic" | "openai";
  apiKey: string;
  model: string;
}

export interface ModelResponse {
  content: string | null;
  toolCalls: ToolCall[];
  stopReason: "end_turn" | "tool_use" | "max_tokens";
}

// ─── Anthropic (Claude) ───────────────────────────────────────────────────────

async function callAnthropic(
  config: ModelConfig,
  systemPrompt: string,
  messages: ChatMessage[],
  tools: ToolDefinition[]
): Promise<ModelResponse> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: config.apiKey });

  // Convert our ChatMessage format to Anthropic's format
  const anthropicMessages = messages
    .filter((m) => m.role !== "tool")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.tool_calls
        ? m.tool_calls.map((tc) => ({
            type: "tool_use" as const,
            id: tc.id,
            name: tc.name,
            input: tc.input,
          }))
        : (m.content as string),
    }));

  // Interleave tool results as user messages (Anthropic's format)
  const toolResultMessages = messages
    .filter((m) => m.role === "tool" && m.tool_call_id)
    .map((m) => ({
      role: "user" as const,
      content: [
        {
          type: "tool_result" as const,
          tool_use_id: m.tool_call_id!,
          content: m.content,
        },
      ],
    }));

  // Merge in order — this simplified approach works for single-turn tool use
  const allMessages = [...anthropicMessages, ...toolResultMessages];

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 1024,
    system: systemPrompt,
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    })),
    messages: allMessages,
  });

  const toolCalls: ToolCall[] = response.content
    .filter((b) => b.type === "tool_use")
    .map((b) => {
      if (b.type !== "tool_use") throw new Error("unreachable");
      return { id: b.id, name: b.name, input: b.input as Record<string, unknown> };
    });

  const textBlock = response.content.find((b) => b.type === "text");
  const content = textBlock && textBlock.type === "text" ? textBlock.text : null;

  const stopReason =
    response.stop_reason === "tool_use"
      ? "tool_use"
      : response.stop_reason === "max_tokens"
        ? "max_tokens"
        : "end_turn";

  return { content, toolCalls, stopReason };
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function callOpenAI(
  config: ModelConfig,
  systemPrompt: string,
  messages: ChatMessage[],
  tools: ToolDefinition[]
): Promise<ModelResponse> {
  // Use require-style dynamic import to avoid TypeScript namespace issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const OpenAI = (await import("openai").catch(() => {
    throw new Error("openai package not installed. Run: npm i openai");
  })).default as any;

  const client = new OpenAI({ apiKey: config.apiKey });

  // Build messages array without relying on OpenAI namespace types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openaiMessages: any[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => {
      if (m.role === "tool") {
        return { role: "tool", tool_call_id: m.tool_call_id!, content: m.content };
      }
      if (m.tool_calls) {
        return {
          role: "assistant",
          tool_calls: m.tool_calls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.input) },
          })),
          content: null,
        };
      }
      return { role: m.role, content: m.content };
    }),
  ];

  const response = await client.chat.completions.create({
    model: config.model,
    messages: openaiMessages,
    tools: tools.length > 0
      ? tools.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.input_schema },
        }))
      : undefined,
    tool_choice: tools.length > 0 ? "auto" : undefined,
  });

  const choice = response.choices[0];
  const rawToolCalls: any[] = choice.message.tool_calls ?? [];
  const toolCalls: ToolCall[] = rawToolCalls.map((tc: any) => ({
    id: tc.id,
    name: tc.function?.name ?? tc.name,
    input: JSON.parse(tc.function?.arguments ?? "{}"),
  }));

  return {
    content: choice.message.content ?? null,
    toolCalls,
    stopReason:
      choice.finish_reason === "tool_calls"
        ? "tool_use"
        : choice.finish_reason === "length"
          ? "max_tokens"
          : "end_turn",
  };
}

// ─── Unified dispatcher ───────────────────────────────────────────────────────

export async function callModel(
  config: ModelConfig,
  systemPrompt: string,
  messages: ChatMessage[],
  tools: ToolDefinition[] = []
): Promise<ModelResponse> {
  if (config.provider === "anthropic") {
    return callAnthropic(config, systemPrompt, messages, tools);
  }
  if (config.provider === "openai") {
    return callOpenAI(config, systemPrompt, messages, tools);
  }
  throw new Error(`Unsupported provider: ${config.provider}`);
}

// ─── Default model config per provider ───────────────────────────────────────

export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
};
