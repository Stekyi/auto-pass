import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { mechanics } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  location: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { mechanicId?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [mechanic] = await db
    .select({ lat: mechanics.lat, lng: mechanics.lng, location: mechanics.location, name: mechanics.name })
    .from(mechanics)
    .where(eq(mechanics.id, user.mechanicId))
    .limit(1);

  return NextResponse.json({ mechanic });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { mechanicId?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(mechanics)
    .set({
      lat: String(parsed.data.lat),
      lng: String(parsed.data.lng),
      ...(parsed.data.location ? { location: parsed.data.location } : {}),
    })
    .where(eq(mechanics.id, user.mechanicId))
    .returning({ lat: mechanics.lat, lng: mechanics.lng, location: mechanics.location });

  return NextResponse.json({ ok: true, mechanic: updated });
}
