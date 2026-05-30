// ─── AutoPass Agent State ─────────────────────────────────────────────────────
// Mirrors LangGraph's typed state concept. Every node receives the full state
// and returns a partial update which is merged into the next state.

export interface ChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  tool_call_id: string;
  tool_name: string;
  content: unknown;
  isError?: boolean;
}

export interface AgentState {
  // Conversation thread (passed from client — stateless server)
  messages: ChatMessage[];

  // Authenticated context
  customerTel: string;
  vehicleId?: string;

  // Optional: customer provides their GPS for "nearby mechanics" queries
  customerLocation?: { lat: number; lng: number };

  // Accumulated tool results for this turn
  toolResults: ToolResult[];

  // Controls graph flow
  pendingToolCalls: ToolCall[];
  iterationCount: number;

  // Final answer
  response?: string;
}

export function initialState(
  messages: ChatMessage[],
  customerTel: string,
  vehicleId?: string,
  customerLocation?: { lat: number; lng: number }
): AgentState {
  return {
    messages,
    customerTel,
    vehicleId,
    customerLocation,
    toolResults: [],
    pendingToolCalls: [],
    iterationCount: 0,
  };
}
