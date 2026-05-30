// ─── Mechanic-Facing Analytics Agent ─────────────────────────────────────────
//
// Same LangGraph ReAct architecture as the customer agent, but:
//   - Tools query the mechanic's own workshop data (tenant-scoped)
//   - System prompt speaks to a mechanic, not a customer
//   - Focuses on business intelligence: revenue, trends, top vehicles, issues
//
//   START → [guardrail] → [agent] ⇄ [tools] → END

import { StateGraph, END } from "./graph";
import type { AgentState, ChatMessage } from "./state";
import { callModel, type ModelConfig } from "./models";
import { mechanicToolDefs, executeMechanicTool, type MechanicContext } from "./mechanic-tools";

const MAX_ITERATIONS = 6;

const MECHANIC_GUARDRAIL_PROMPT = `You are a topic guard for AutoPass workshop analytics.

ALLOW if the message is about:
- Vehicles, repairs, services, parts, maintenance
- Revenue, earnings, costs, income, money
- Customers, their visit frequency, loyalty
- Workshop performance, trends, reports
- Specific cars or jobs done in the workshop
- Short replies like yes, no, thanks, okay

BLOCK everything else.

Reply with exactly: ALLOW or BLOCK`;

const OFF_TOPIC = "I can only help with questions about your workshop — repairs, vehicles, customers, revenue, and maintenance. Please ask about your work data.";

function mechanicSystemPrompt(shopName?: string): string {
  return `You are the AutoPass Workshop Intelligence assistant for ${shopName ?? "this workshop"}.
You help mechanics and shop owners understand their business data through clear, practical insights.

Today: ${new Date().toLocaleDateString("en-GH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

## Your role
Answer questions about the workshop's repair history, revenue trends, top vehicles, loyal customers, common issues, and pending maintenance.

## Tone
- Talk to a mechanic, not a data scientist. Say "your best month" not "peak revenue period."
- Use bullet points for lists. Keep answers concise.
- Always mention the time period you're analysing (e.g. "over the last 30 days").
- Format currency as ₵ (e.g. ₵1,250.00).

## What you can analyse
- Workshop performance stats (jobs done, revenue, average job value)
- Most common repairs and parts used
- Vehicles with the most visits or issues
- Most loyal / highest-spending customers
- Monthly revenue trends
- Full history for a specific vehicle
- Overdue and upcoming maintenance reminders

## Limits
- You only see jobs logged in AutoPass for this workshop
- Do not discuss topics unrelated to the workshop`;
}

function makeGuardrail(config: ModelConfig) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const lastMsg = [...state.messages].reverse().find(m => m.role === "user")?.content ?? "";
    if (lastMsg.trim().split(/\s+/).length <= 3) return {};

    const result = await callModel(
      { ...config, model: config.provider === "anthropic" ? "claude-haiku-4-5-20251001" : "gpt-4o-mini" },
      MECHANIC_GUARDRAIL_PROMPT,
      [{ role: "user", content: lastMsg }],
      []
    );

    if ((result.content ?? "").trim().toUpperCase().startsWith("BLOCK")) {
      return { response: OFF_TOPIC };
    }
    return {};
  };
}

function makeAgent(config: ModelConfig, shopName?: string) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const result = await callModel(
      config,
      mechanicSystemPrompt(shopName),
      state.messages,
      mechanicToolDefs
    );

    const updates: Partial<AgentState> = { iterationCount: state.iterationCount + 1 };

    if (result.stopReason === "tool_use" && result.toolCalls.length > 0) {
      updates.messages = [...state.messages, {
        role: "assistant", content: result.content ?? "", tool_calls: result.toolCalls,
      }];
      updates.pendingToolCalls = result.toolCalls;
    } else {
      updates.response = result.content ?? "I couldn't generate an answer. Try rephrasing.";
      updates.pendingToolCalls = [];
    }
    return updates;
  };
}

function makeTools(ctx: MechanicContext) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const results = await Promise.all(
      state.pendingToolCalls.map(async (tc) => {
        try {
          const output = await executeMechanicTool(tc.name, tc.input, ctx);
          return { tool_call_id: tc.id, tool_name: tc.name, content: JSON.stringify(output), isError: false };
        } catch (err) {
          return { tool_call_id: tc.id, tool_name: tc.name, content: JSON.stringify({ error: String(err) }), isError: true };
        }
      })
    );

    const toolMessages: ChatMessage[] = results.map(r => ({
      role: "tool", content: r.content, tool_call_id: r.tool_call_id,
    }));

    return {
      messages: [...state.messages, ...toolMessages],
      toolResults: [...state.toolResults, ...results],
      pendingToolCalls: [],
    };
  };
}

export function buildMechanicAgent(
  config: ModelConfig,
  ctx: MechanicContext
) {
  const graph = new StateGraph<AgentState>();

  graph
    .addNode("guardrail", makeGuardrail(config))
    .addNode("agent",     makeAgent(config, ctx.shopName))
    .addNode("tools",     makeTools(ctx))
    .setEntryPoint("guardrail")
    .addConditionalEdges("guardrail", s => s.response ? END : "agent")
    .addConditionalEdges("agent", s => {
      if (s.response) return END;
      if (s.iterationCount >= MAX_ITERATIONS) return END;
      if (s.pendingToolCalls.length > 0) return "tools";
      return END;
    })
    .addEdge("tools", "agent");

  return graph.compile();
}
