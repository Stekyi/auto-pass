import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { verifyPortalToken } from "@/lib/auth/portal-session";
import { getSetting, SETTING_KEYS } from "@/lib/utils/settings";
import { buildAutoPassAgent } from "@/lib/agent/autopass-agent";
import { initialState } from "@/lib/agent/state";
import { DEFAULT_MODELS, type ModelConfig } from "@/lib/agent/models";
import type { ChatMessage } from "@/lib/agent/state";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const schema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ).min(1),
  vehicleId: z.string().uuid().optional(),
  customerLocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

export async function POST(req: NextRequest) {
  // Auth — portal JWT
  const cookieStore = await cookies();
  const token = cookieStore.get("portal_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  // Check AI is enabled
  const [aiEnabled, aiProvider, aiApiKey, aiModel] = await Promise.all([
    getSetting(SETTING_KEYS.AI_ENABLED),
    getSetting(SETTING_KEYS.AI_PROVIDER),
    getSetting(SETTING_KEYS.AI_API_KEY),
    getSetting(SETTING_KEYS.AI_MODEL),
  ]);

  if (aiEnabled === "false" || !aiProvider || !aiApiKey) {
    return NextResponse.json(
      { reply: "The AI assistant is not yet configured. Please contact the administrator." },
      { status: 200 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { messages, vehicleId, customerLocation } = parsed.data;

  // Build vehicle context string (injected into system prompt)
  let vehicleContext: string | undefined;
  if (vehicleId) {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
    if (vehicle) {
      vehicleContext = `Vehicle: ${vehicle.plateNumber ?? vehicle.vehicleNumber} — ${[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ")} (ID: ${vehicle.id})`;
    }
  }

  // Build model config
  const modelConfig: ModelConfig = {
    provider: (aiProvider ?? "anthropic") as "anthropic" | "openai",
    apiKey: aiApiKey!,
    model: aiModel ?? DEFAULT_MODELS[aiProvider ?? "anthropic"] ?? "claude-haiku-4-5-20251001",
  };

  // Build agent and run
  const agent = buildAutoPassAgent(
    modelConfig,
    { customerTel: payload.tel, vehicleId },
    vehicleContext
  );

  const state = initialState(
    messages as ChatMessage[],
    payload.tel,
    vehicleId,
    customerLocation
  );

  try {
    const finalState = await agent.invoke(state);
    return NextResponse.json({
      reply: finalState.response ?? "I wasn't able to generate a response. Please try again.",
      toolsUsed: [...new Set(finalState.toolResults.map((r) => r.tool_name))],
    });
  } catch (err) {
    console.error("Agent error:", err);
    return NextResponse.json(
      { reply: "Something went wrong with the AI assistant. Please try again." },
      { status: 200 }
    );
  }
}
