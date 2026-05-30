import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { staffUsers, mechanics } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

function isAdmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "ADMIN";
}

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session as { user?: { role?: string } } | null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: mechanicId } = await params;

  const [mechanic] = await db.select({ id: mechanics.id }).from(mechanics).where(eq(mechanics.id, mechanicId)).limit(1);
  if (!mechanic) return NextResponse.json({ error: "Mechanic not found" }, { status: 404 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, email, password } = parsed.data;

  const existing = await db.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.email, email)).limit(1);
  if (existing.length > 0) return NextResponse.json({ error: "Email already registered." }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(staffUsers).values({
    mechanicId,
    name,
    email,
    passwordHash,
    role: "CLERK",
  }).returning({
    id: staffUsers.id, name: staffUsers.name, email: staffUsers.email,
    role: staffUsers.role, isActive: staffUsers.isActive, createdAt: staffUsers.createdAt,
  });

  return NextResponse.json(user, { status: 201 });
}
