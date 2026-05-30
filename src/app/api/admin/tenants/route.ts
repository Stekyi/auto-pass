import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { mechanics, staffUsers } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

function isAdmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "ADMIN";
}

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(8),
  ownerName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactTel: z.string().optional(),
  clerkName: z.string().min(1),
  clerkEmail: z.string().email(),
  clerkPassword: z.string().min(8),
});

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session as { user?: { role?: string } } | null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select({
      id: mechanics.id,
      name: mechanics.name,
      code: mechanics.code,
      ownerName: mechanics.ownerName,
      contactEmail: mechanics.contactEmail,
      contactTel: mechanics.contactTel,
      isActive: mechanics.isActive,
      createdAt: mechanics.createdAt,
      userCount: sql<number>`(SELECT count(*) FROM staff_users WHERE mechanic_id = ${mechanics.id})`,
    })
    .from(mechanics)
    .orderBy(mechanics.name);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session as { user?: { role?: string } } | null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;
  const codeUpper = d.code.toUpperCase();

  const existing = await db.select({ id: mechanics.id }).from(mechanics).where(eq(mechanics.code, codeUpper)).limit(1);
  if (existing.length > 0) return NextResponse.json({ error: "Mechanic code already in use." }, { status: 409 });

  const emailExists = await db.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.email, d.clerkEmail)).limit(1);
  if (emailExists.length > 0) return NextResponse.json({ error: "Clerk email already registered." }, { status: 409 });

  const [mechanic] = await db.insert(mechanics).values({
    name: d.name,
    code: codeUpper,
    ownerName: d.ownerName || null,
    contactEmail: d.contactEmail || null,
    contactTel: d.contactTel || null,
  }).returning();

  const hash = await bcrypt.hash(d.clerkPassword, 12);
  await db.insert(staffUsers).values({
    mechanicId: mechanic.id,
    name: d.clerkName,
    email: d.clerkEmail,
    passwordHash: hash,
    role: "CLERK",
  });

  return NextResponse.json(mechanic, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session as { user?: { role?: string } } | null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, isActive } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.update(mechanics).set({ isActive }).where(eq(mechanics.id, id));
  return NextResponse.json({ ok: true });
}
