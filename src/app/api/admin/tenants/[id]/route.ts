import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { mechanics, staffUsers, customers, subscriptions } from "@/lib/db/schema";
import { eq, sql, inArray } from "drizzle-orm";

function isAdmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "ADMIN";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session as { user?: { role?: string } } | null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [mechanic] = await db.select().from(mechanics).where(eq(mechanics.id, id)).limit(1);
  if (!mechanic) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const users = await db
    .select({ id: staffUsers.id, name: staffUsers.name, email: staffUsers.email, role: staffUsers.role, isActive: staffUsers.isActive, createdAt: staffUsers.createdAt })
    .from(staffUsers)
    .where(eq(staffUsers.mechanicId, id))
    .orderBy(staffUsers.createdAt);

  const [subRow] = await db
    .select({ status: subscriptions.status, endDate: subscriptions.endDate, amountGhs: subscriptions.amountGhs })
    .from(subscriptions)
    .where(eq(subscriptions.mechanicId, id))
    .orderBy(sql`${subscriptions.createdAt} DESC`)
    .limit(1);

  const [custCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customers)
    .where(eq(customers.mechanicId, id));

  return NextResponse.json({
    mechanic,
    users,
    subscription: subRow ?? null,
    stats: { customers: Number(custCount.count) },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session as { user?: { role?: string } } | null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: mechanicId } = await params;

  const [mechanic] = await db.select({ id: mechanics.id }).from(mechanics).where(eq(mechanics.id, mechanicId)).limit(1);
  if (!mechanic) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete in correct FK order before cascade
  const customerRows = await db.select({ id: customers.id }).from(customers).where(eq(customers.mechanicId, mechanicId));
  const customerIds = customerRows.map((c) => c.id);

  if (customerIds.length > 0) {
    await db.delete(customers).where(inArray(customers.id, customerIds));
  }

  // Mechanic row cascades: staffUsers, subscriptions, alerts, idCounters
  await db.delete(mechanics).where(eq(mechanics.id, mechanicId));

  return NextResponse.json({ ok: true });
}
