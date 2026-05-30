import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { vehicles, mechanics, idCounters, vehicleRegistrations } from "@/lib/db/schema";
import { eq, or, ilike, sql, and } from "drizzle-orm";
import { z } from "zod";
import { getPrices } from "@/lib/utils/settings";

const createSchema = z.object({
  customerId: z.string().uuid().optional(),
  plateNumber: z.string().min(1).max(30).optional(),
  vin: z.string().length(17).optional(),
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  engineSize: z.string().max(30).optional(),
  fuelType: z.string().max(30).optional(),
  color: z.string().max(50).optional(),
  currentMileageKm: z.number().int().optional(),
  notes: z.string().optional(),
});

async function nextVehicleNumber(mechanicId: string, code: string): Promise<string> {
  const [row] = await db
    .update(idCounters)
    .set({ lastValue: sql`${idCounters.lastValue} + 1` })
    .where(and(eq(idCounters.mechanicId, mechanicId), eq(idCounters.name, "vehicle")))
    .returning({ lastValue: idCounters.lastValue });
  if (!row) {
    await db.insert(idCounters).values({ mechanicId, name: "vehicle", lastValue: 1 });
    return `${code}-V-0001`;
  }
  return `${code}-V-${String(row.lastValue).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(vehicles)
    .where(
      q
        ? and(
            eq(vehicles.isActive, true),
            or(
              ilike(vehicles.plateNumber, `%${q}%`),
              ilike(vehicles.vin, `%${q}%`),
              ilike(vehicles.make, `%${q}%`),
              ilike(vehicles.model, `%${q}%`)
            )
          )
        : eq(vehicles.isActive, true)
    )
    .orderBy(vehicles.createdAt)
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ vehicles: rows, page });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { mechanicId?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [mechanic] = await db.select({ code: mechanics.code }).from(mechanics)
    .where(eq(mechanics.id, user.mechanicId)).limit(1);
  if (!mechanic) return NextResponse.json({ error: "Mechanic not found" }, { status: 404 });

  const vehicleNumber = await nextVehicleNumber(user.mechanicId, mechanic.code);

  const [vehicle] = await db.insert(vehicles).values({
    mechanicId: user.mechanicId,
    vehicleNumber,
    ...parsed.data,
  }).returning();

  // Auto-create per-vehicle registration charge (price from settings)
  const { vehicleRegistration } = await getPrices();
  await db.insert(vehicleRegistrations).values({
    vehicleId: vehicle.id,
    mechanicId: user.mechanicId,
    customerId: parsed.data.customerId ?? null,
    amountGhs: String(vehicleRegistration),
    status: "pending",
  });

  return NextResponse.json({ vehicle, registrationFeeGhs: vehicleRegistration }, { status: 201 });
}
