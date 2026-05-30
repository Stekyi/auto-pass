import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schema";
import { eq, or, ilike, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ vehicles: [] });

  const rows = await db
    .select({
      id: vehicles.id,
      vehicleNumber: vehicles.vehicleNumber,
      plateNumber: vehicles.plateNumber,
      make: vehicles.make,
      model: vehicles.model,
      year: vehicles.year,
      vin: vehicles.vin,
      customerId: vehicles.customerId,
    })
    .from(vehicles)
    .where(
      and(
        eq(vehicles.isActive, true),
        or(
          ilike(vehicles.plateNumber, `%${q}%`),
          ilike(vehicles.vin, `%${q}%`),
          ilike(vehicles.make, `%${q}%`),
          ilike(vehicles.vehicleNumber, `%${q}%`)
        )
      )
    )
    .limit(10);

  return NextResponse.json({ vehicles: rows });
}
