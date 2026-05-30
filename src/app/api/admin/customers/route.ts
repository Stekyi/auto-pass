import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { customers, mechanics } from "@/lib/db/schema";
import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

function isAdmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "ADMIN";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session as { user?: { role?: string } } | null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status") ?? "active";

  const conditions: any[] = [];
  if (status === "active") conditions.push(eq(customers.isActive, true));
  if (status === "inactive") conditions.push(eq(customers.isActive, false));
  if (q) {
    conditions.push(or(
      ilike(customers.fullName, `%${q}%`),
      ilike(customers.tel, `%${q}%`),
      ilike(mechanics.name, `%${q}%`)
    )!);
  }

  const rows = await db
    .select({
      id: customers.id,
      fullName: customers.fullName,
      tel: customers.tel,
      email: customers.email,
      isActive: customers.isActive,
      mechanicName: mechanics.name,
    })
    .from(customers)
    .leftJoin(mechanics, eq(customers.mechanicId, mechanics.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(customers.fullName);

  return NextResponse.json({ customers: rows });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session as { user?: { role?: string } } | null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await db.update(customers)
    .set({ isActive: parsed.data.isActive, updatedAt: new Date() })
    .where(eq(customers.id, parsed.data.id));

  return NextResponse.json({ ok: true });
}
