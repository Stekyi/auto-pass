import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { z } from "zod";
import { getSetting, SETTING_KEYS } from "@/lib/utils/settings";
import { buildMechanicAgent } from "@/lib/agent/mechanic-agent";
import { initialState } from "@/lib/agent/state";
import { DEFAULT_MODELS, type ModelConfig } from "@/lib/agent/models";
import type { ChatMessage } from "@/lib/agent/state";
import { db } from "@/lib/db";
import { mechanics } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const schema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { mechanicId?: string | null; role?: string };
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [aiEnabled, aiProvider, aiApiKey, aiModel] = await Promise.all([
    getSetting(SETTING_KEYS.AI_ENABLED),
    getSetting(SETTING_KEYS.AI_PROVIDER),
    getSetting(SETTING_KEYS.AI_API_KEY),
    getSetting(SETTING_KEYS.AI_MODEL),
  ]);

  if (aiEnabled === "false" || !aiProvider || !aiApiKey) {
    return NextResponse.json({
      reply: "The AI assistant is not configured yet. Ask your administrator to set it up in Admin → AI Assistant.",
    });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [mechanic] = user.mechanicId
    ? await db
        .select({ name: mechanics.name })
        .from(mechanics)
        .where(eq(mechanics.id, user.mechanicId))
        .limit(1)
    : [null];

  const config: ModelConfig = {
    provider: (aiProvider ?? "anthropic") as "anthropic" | "openai",
    apiKey: aiApiKey!,
    model: aiModel ?? DEFAULT_MODELS[aiProvider ?? "anthropic"],
  };

  const agent = buildMechanicAgent(config, {
    mechanicId: user.mechanicId ?? null,
    shopName: mechanic?.name ?? "All workshops",
    isAdmin,
  });

  const state = initialState(parsed.data.messages as ChatMessage[], "", undefined, undefined);

  try {
    const finalState = await agent.invoke(state);
    return NextResponse.json({
      reply: finalState.response ?? "I couldn't generate an answer.",
      toolsUsed: [...new Set(finalState.toolResults.map(r => r.tool_name))],
    });
  } catch (err) {
    console.error("Mechanic agent error:", err);
    return NextResponse.json({ reply: "Something went wrong. Please try again." });
  }
}
