import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { partLifeExpectancy } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  partName: z.string().min(1).max(200),
  lifeMonths: z.number().int().min(1).optional(),
  lifeKm: z.number().int().min(1).optional(),
  notes: z.string().optional(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session) return null;
  const user = session.user as { role?: string };
  if (user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parts = await db.select().from(partLifeExpectancy).orderBy(partLifeExpectancy.partName);
  return NextResponse.json({ parts });
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const [part] = await db.insert(partLifeExpectancy).values(parsed.data).returning();
  return NextResponse.json({ part }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const [updated] = await db.update(partLifeExpectancy).set(updates).where(eq(partLifeExpectancy.id, id)).returning();
  return NextResponse.json({ part: updated });
}

export async function DELETE(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.update(partLifeExpectancy).set({ isActive: false }).where(eq(partLifeExpectancy.id, id));
  return NextResponse.json({ ok: true });
}
