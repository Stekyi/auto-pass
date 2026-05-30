import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { customers, alerts, idCounters } from "@/lib/db/schema";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  fullName: z.string().min(2).max(200),
  tel: z.string().min(7).max(30),
  email: z.string().email().optional().or(z.literal("")),
  location: z.string().optional(),
});

async function nextCustomerNumber(mechanicId: string, code: string): Promise<string> {
  const [row] = await db
    .update(idCounters)
    .set({ lastValue: sql`${idCounters.lastValue} + 1` })
    .where(and(eq(idCounters.mechanicId, mechanicId), eq(idCounters.name, "customer")))
    .returning({ lastValue: idCounters.lastValue });
  if (!row) {
    await db.insert(idCounters).values({ mechanicId, name: "customer", lastValue: 1 });
    return `${code}-C-0001`;
  }
  return `${code}-C-${String(row.lastValue).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { mechanicId?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions = [
    eq(customers.mechanicId, user.mechanicId),
    eq(customers.isActive, true),
  ];

  if (q) {
    conditions.push(or(ilike(customers.fullName, `%${q}%`), ilike(customers.tel, `%${q}%`))!);
  }

  const rows = await db
    .select()
    .from(customers)
    .where(and(...conditions))
    .orderBy(customers.fullName)
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ customers: rows, page });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { mechanicId?: string; id?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { db: dbInstance } = await import("@/lib/db");
  const { mechanics } = await import("@/lib/db/schema");
  const [mechanic] = await dbInstance.select({ code: mechanics.code }).from(mechanics).where(eq(mechanics.id, user.mechanicId)).limit(1);
  if (!mechanic) return NextResponse.json({ error: "Mechanic not found" }, { status: 404 });

  const customerNumber = await nextCustomerNumber(user.mechanicId, mechanic.code);

  const [newCustomer] = await db.insert(customers).values({
    mechanicId: user.mechanicId,
    customerNumber,
    fullName: parsed.data.fullName,
    tel: parsed.data.tel,
    email: parsed.data.email || null,
    location: parsed.data.location || null,
  }).returning();

  // Queue welcome alert if email provided
  if (newCustomer.email) {
    await db.insert(alerts).values({
      mechanicId: user.mechanicId,
      type: "welcome",
      status: "pending",
      recipientEmail: newCustomer.email,
      recipientName: newCustomer.fullName,
      recipientTel: newCustomer.tel,
      payload: { customerNumber },
    });
  }

  return NextResponse.json({ customer: newCustomer }, { status: 201 });
}
