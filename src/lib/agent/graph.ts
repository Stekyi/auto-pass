// ─── Minimal LangGraph-style Graph Runtime ────────────────────────────────────
//
// Architecture mirrors LangGraph's StateGraph:
//
//   START
//     ↓
//   [agent]  ←──────────────────────────────┐
//     ↓ conditional                          │
//   "tools"──→ [tools] (execute tool calls) ─┘
//     ↓ "__end__"
//   END
//
// Nodes: async functions that receive the full state and return partial updates.
// Edges: static (always go to X) or conditional (router function picks next node).
// The graph compiles to a single `invoke(initialState)` function.

export const END = "__end__" as const;
export const START = "__start__" as const;

type NodeFn<S extends object> = (state: S) => Promise<Partial<S>>;
type RouterFn<S extends object> = (state: S) => string;

interface CompiledGraph<S extends object> {
  invoke: (initialState: S) => Promise<S>;
}

export class StateGraph<S extends object> {
  private nodes = new Map<string, NodeFn<S>>();
  private staticEdges = new Map<string, string>();
  private conditionalEdges = new Map<string, RouterFn<S>>();
  private entry = "";
  private maxIterations = 20;

  addNode(name: string, fn: NodeFn<S>): this {
    this.nodes.set(name, fn);
    return this;
  }

  addEdge(from: string, to: string): this {
    this.staticEdges.set(from, to);
    return this;
  }

  addConditionalEdges(from: string, router: RouterFn<S>): this {
    this.conditionalEdges.set(from, router);
    return this;
  }

  setEntryPoint(name: string): this {
    this.entry = name;
    return this;
  }

  compile(): CompiledGraph<S> {
    const { nodes, staticEdges, conditionalEdges, entry, maxIterations } = this;

    return {
      async invoke(state: S): Promise<S> {
        let current = entry;
        let s = { ...state };
        let iterations = 0;

        while (current !== END && iterations < maxIterations) {
          iterations++;
          const nodeFn = nodes.get(current);
          if (!nodeFn) throw new Error(`Node "${current}" not found in graph`);

          const update = await nodeFn(s);
          s = { ...s, ...update };

          // Determine next node
          if (conditionalEdges.has(current)) {
            current = conditionalEdges.get(current)!(s);
          } else if (staticEdges.has(current)) {
            current = staticEdges.get(current)!;
          } else {
            current = END;
          }
        }

        return s;
      },
    };
  }
}
