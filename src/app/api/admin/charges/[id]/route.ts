import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { vehicleRegistrations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["paid", "waived"]),
  reference: z.string().max(200).optional(),
  notes: z.string().optional(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session) return null;
  if ((session.user as { role?: string }).role !== "ADMIN") return null;
  return session;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(vehicleRegistrations)
    .set({
      status: parsed.data.status,
      paidAt: parsed.data.status === "paid" ? new Date() : null,
      reference: parsed.data.reference ?? null,
      notes: parsed.data.notes ?? null,
    })
    .where(eq(vehicleRegistrations.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ charge: updated });
}
