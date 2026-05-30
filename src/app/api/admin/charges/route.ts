import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { vehicleRegistrations, vehicles, mechanics, customers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

async function requireAdmin() {
  const session = await auth();
  if (!session) return null;
  if ((session.user as { role?: string }).role !== "ADMIN") return null;
  return session;
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = new URL(req.url).searchParams.get("status"); // pending | paid | waived | all

  const rows = await db
    .select({
      charge: vehicleRegistrations,
      vehiclePlate: vehicles.plateNumber,
      vehicleNumber: vehicles.vehicleNumber,
      vehicleMake: vehicles.make,
      vehicleModel: vehicles.model,
      shopName: mechanics.name,
      shopCode: mechanics.code,
      customerName: customers.fullName,
      customerTel: customers.tel,
    })
    .from(vehicleRegistrations)
    .leftJoin(vehicles,  eq(vehicleRegistrations.vehicleId,  vehicles.id))
    .leftJoin(mechanics, eq(vehicleRegistrations.mechanicId, mechanics.id))
    .leftJoin(customers, eq(vehicleRegistrations.customerId, customers.id))
    .where(
      status && status !== "all"
        ? eq(vehicleRegistrations.status, status)
        : undefined
    )
    .orderBy(desc(vehicleRegistrations.createdAt));

  return NextResponse.json({ charges: rows });
}
