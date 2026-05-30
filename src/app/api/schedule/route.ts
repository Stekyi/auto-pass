import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { maintenanceSchedule, vehicles, customers } from "@/lib/db/schema";
import { eq, and, lte, gte } from "drizzle-orm";
import { z } from "zod";
import { addDays } from "date-fns";

const createSchema = z.object({
  vehicleId: z.string().uuid(),
  partName: z.string().min(1).max(200),
  dueDateEstimate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueKmEstimate: z.number().int().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { mechanicId?: string | null; role?: string };
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "90", 10);
  const includeOverdue = searchParams.get("overdue") !== "false";

  const today = new Date().toISOString().split("T")[0];
  const futureDate = addDays(new Date(), days).toISOString().split("T")[0];

  const baseFilters = [
    eq(maintenanceSchedule.isCompleted, false),
    includeOverdue
      ? lte(maintenanceSchedule.dueDateEstimate, futureDate)
      : and(
          gte(maintenanceSchedule.dueDateEstimate, today),
          lte(maintenanceSchedule.dueDateEstimate, futureDate)
        ),
  ];

  if (!isAdmin && user.mechanicId) {
    baseFilters.unshift(eq(maintenanceSchedule.mechanicId, user.mechanicId));
  }

  const rows = await db
    .select({
      schedule: maintenanceSchedule,
      vehiclePlate: vehicles.plateNumber,
      vehicleMake: vehicles.make,
      vehicleModel: vehicles.model,
      vehicleNumber: vehicles.vehicleNumber,
      customerName: customers.fullName,
      customerTel: customers.tel,
    })
    .from(maintenanceSchedule)
    .leftJoin(vehicles, eq(maintenanceSchedule.vehicleId, vehicles.id))
    .leftJoin(customers, eq(vehicles.customerId, customers.id))
    .where(and(...baseFilters))
    .orderBy(maintenanceSchedule.dueDateEstimate);

  return NextResponse.json({ schedule: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { mechanicId?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [entry] = await db.insert(maintenanceSchedule).values({
    mechanicId: user.mechanicId,
    ...parsed.data,
  }).returning();

  return NextResponse.json({ entry }, { status: 201 });
}
