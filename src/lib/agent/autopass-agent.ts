// ─── AutoPass Agent ───────────────────────────────────────────────────────────
//
// LangGraph-style ReAct agent with input guardrail:
//
//   START
//     ↓
//   [guardrail] — cheap classification: is this question on-topic?
//     ↓ conditional: "off_topic" | "agent"
//   "off_topic" → END  (polite refusal, no tool calls, zero cost)
//     ↓
//   [agent] — calls LLM with tools; if tool_use → pending tool calls in state
//     ↓ conditional: "tools" | "__end__"
//   [tools] — executes all pending tool calls in parallel
//     ↓ back to [agent] (loop until final answer or max_iterations)
//   END

import { StateGraph, END } from "./graph";
import type { AgentState, ChatMessage } from "./state";
import { callModel, type ModelConfig } from "./models";
import { ALL_TOOLS, executeTool, type ToolContext } from "./tools";
import { buildSystemPrompt, GUARDRAIL_PROMPT, OFF_TOPIC_REPLY } from "./prompts";

const MAX_ITERATIONS = 6;

// ─── Node: guardrail ──────────────────────────────────────────────────────────
// Runs a fast, low-token classification call before the full agent loop.
// Uses the same configured model but with max_tokens=10 — costs <1% of a
// normal agent call. Returns immediately with a refusal if off-topic.

function makeGuardrailNode(config: ModelConfig) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const lastUserMsg = [...state.messages]
      .reverse()
      .find((m) => m.role === "user")?.content ?? "";

    // Very short messages (greetings, "ok", "thanks") — always allow
    if (lastUserMsg.trim().split(/\s+/).length <= 3) return {};

    const result = await callModel(
      { ...config, model: guardrailModel(config) },
      GUARDRAIL_PROMPT,
      [{ role: "user", content: lastUserMsg }],
      [] // no tools — this is pure classification
    );

    const verdict = (result.content ?? "").trim().toUpperCase();

    if (verdict.startsWith("BLOCK")) {
      return { response: OFF_TOPIC_REPLY };
    }

    return {}; // ALLOW — proceed to agent node
  };
}

// Use the cheapest/fastest variant of the configured provider for guardrails.
function guardrailModel(config: ModelConfig): string {
  if (config.provider === "anthropic") return "claude-haiku-4-5-20251001";
  if (config.provider === "openai") return "gpt-4o-mini";
  return config.model;
}

// ─── Node: agent ─────────────────────────────────────────────────────────────

function makeAgentNode(config: ModelConfig, vehicleContext?: string) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const systemPrompt = buildSystemPrompt(vehicleContext);

    const result = await callModel(
      config,
      systemPrompt,
      state.messages,
      ALL_TOOLS
    );

    const updates: Partial<AgentState> = {
      iterationCount: state.iterationCount + 1,
    };

    if (result.stopReason === "tool_use" && result.toolCalls.length > 0) {
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.content ?? "",
        tool_calls: result.toolCalls,
      };
      updates.messages = [...state.messages, assistantMsg];
      updates.pendingToolCalls = result.toolCalls;
    } else {
      updates.response = result.content ?? "I'm not sure how to answer that.";
      updates.pendingToolCalls = [];
    }

    return updates;
  };
}

// ─── Node: tools ─────────────────────────────────────────────────────────────

function makeToolsNode(ctx: ToolContext) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const results = await Promise.all(
      state.pendingToolCalls.map(async (tc) => {
        try {
          const output = await executeTool(tc.name, tc.input, ctx);
          return {
            tool_call_id: tc.id,
            tool_name: tc.name,
            content: JSON.stringify(output),
            isError: false,
          };
        } catch (err) {
          return {
            tool_call_id: tc.id,
            tool_name: tc.name,
            content: JSON.stringify({ error: String(err) }),
            isError: true,
          };
        }
      })
    );

    const toolMessages: ChatMessage[] = results.map((r) => ({
      role: "tool",
      content: r.content,
      tool_call_id: r.tool_call_id,
    }));

    return {
      messages: [...state.messages, ...toolMessages],
      toolResults: [...state.toolResults, ...results],
      pendingToolCalls: [],
    };
  };
}

// ─── Routers ──────────────────────────────────────────────────────────────────

function guardrailRouter(state: AgentState): string {
  return state.response ? END : "agent";
}

function agentRouter(state: AgentState): string {
  if (state.response) return END;
  if (state.iterationCount >= MAX_ITERATIONS) return END;
  if (state.pendingToolCalls.length > 0) return "tools";
  return END;
}

// ─── Build and compile the graph ──────────────────────────────────────────────

export function buildAutoPassAgent(
  config: ModelConfig,
  ctx: ToolContext,
  vehicleContext?: string
) {
  const graph = new StateGraph<AgentState>();

  graph
    .addNode("guardrail", makeGuardrailNode(config))
    .addNode("agent",     makeAgentNode(config, vehicleContext))
    .addNode("tools",     makeToolsNode(ctx))
    .setEntryPoint("guardrail")
    .addConditionalEdges("guardrail", guardrailRouter)
    .addConditionalEdges("agent",     agentRouter)
    .addEdge("tools", "agent");

  return graph.compile();
}
