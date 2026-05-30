import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { subscriptions, mechanics } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getPrices } from "@/lib/utils/settings";

async function requireAdmin() {
  const session = await auth();
  if (!session) return null;
  const user = session.user as { role?: string; id?: string };
  if (user.role !== "ADMIN") return null;
  return session;
}

const createSchema = z.object({
  mechanicId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountGhs: z.number().min(0).optional(), // if omitted, pulls from settings
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({
      subscription: subscriptions,
      mechanicName: mechanics.name,
      mechanicCode: mechanics.code,
    })
    .from(subscriptions)
    .leftJoin(mechanics, eq(subscriptions.mechanicId, mechanics.id))
    .orderBy(subscriptions.createdAt);

  return NextResponse.json({ subscriptions: rows });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const user = session.user as { id?: string };

  // Use provided amount or fall back to settings-configured subscription price
  const amount = parsed.data.amountGhs ?? (await getPrices()).subscription;

  const [sub] = await db.insert(subscriptions).values({
    ...parsed.data,
    amountGhs: String(amount),
    status: "ACTIVE",
    paidAt: new Date(),
    recordedBy: user.id || null,
  }).returning();

  return NextResponse.json({ subscription: sub }, { status: 201 });
}
