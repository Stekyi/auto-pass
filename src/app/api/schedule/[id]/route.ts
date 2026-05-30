import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { maintenanceSchedule } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  isCompleted: z.boolean().optional(),
  completedJobId: z.string().uuid().optional(),
  notes: z.string().optional(),
  dueDateEstimate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueKmEstimate: z.number().int().optional(),
});

async function getEntry(id: string, mechanicId: string | null | undefined, isAdmin: boolean) {
  const where = isAdmin
    ? eq(maintenanceSchedule.id, id)
    : and(eq(maintenanceSchedule.id, id), eq(maintenanceSchedule.mechanicId, mechanicId!));
  const [row] = await db.select().from(maintenanceSchedule).where(where).limit(1);
  return row;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { mechanicId?: string | null; role?: string };
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const entry = await getEntry(id, user.mechanicId, isAdmin);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db.update(maintenanceSchedule).set(parsed.data).where(eq(maintenanceSchedule.id, id)).returning();
  return NextResponse.json({ entry: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { mechanicId?: string | null; role?: string };
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const entry = await getEntry(id, user.mechanicId, isAdmin);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(maintenanceSchedule).where(eq(maintenanceSchedule.id, id));
  return NextResponse.json({ ok: true });
}
