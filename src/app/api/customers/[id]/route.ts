import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { customers, vehicles, repairJobs } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  fullName: z.string().min(2).max(200).optional(),
  tel: z.string().min(7).max(30).optional(),
  email: z.string().email().optional().or(z.literal("")).optional(),
  location: z.string().optional(),
});

async function getCustomer(id: string, mechanicId: string) {
  const [row] = await db.select().from(customers)
    .where(and(eq(customers.id, id), eq(customers.mechanicId, mechanicId)))
    .limit(1);
  return row;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { mechanicId?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const customer = await getCustomer(id, user.mechanicId);
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [customerVehicles, [jobCount]] = await Promise.all([
    db.select().from(vehicles).where(and(eq(vehicles.customerId, id), eq(vehicles.isActive, true))),
    db.select({ count: count() }).from(repairJobs).where(eq(repairJobs.customerId, id)),
  ]);

  return NextResponse.json({ customer, vehicles: customerVehicles, jobCount: jobCount?.count ?? 0 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { mechanicId?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const customer = await getCustomer(id, user.mechanicId);
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db.update(customers)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(customers.id, id))
    .returning();

  return NextResponse.json({ customer: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { mechanicId?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const customer = await getCustomer(id, user.mechanicId);
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.update(customers).set({ isActive: false, updatedAt: new Date() }).where(eq(customers.id, id));
  return NextResponse.json({ ok: true });
}
