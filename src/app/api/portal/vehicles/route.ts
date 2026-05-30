import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers, vehicles, repairJobs } from "@/lib/db/schema";
import { eq, max, count, and } from "drizzle-orm";
import { verifyPortalToken } from "@/lib/auth/portal-session";
import { cookies } from "next/headers";

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("portal_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  // Find all customer records for this phone number (across all tenants)
  const customerRecords = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.tel, payload.tel), eq(customers.isActive, true)));

  if (customerRecords.length === 0) {
    return NextResponse.json({ vehicles: [] });
  }

  const customerIds = customerRecords.map((c) => c.id);

  // Find all vehicles linked to any of these customer records
  const vehicleList = await Promise.all(
    customerIds.map(async (customerId) => {
      const vs = await db.select().from(vehicles).where(eq(vehicles.customerId, customerId));
      return vs;
    })
  );

  const allVehicles = vehicleList.flat();

  // Attach last service date and job count per vehicle
  const enriched = await Promise.all(
    allVehicles.map(async (v) => {
      const [stats] = await db
        .select({
          lastJobDate: max(repairJobs.jobDate),
          jobCount: count(repairJobs.id),
        })
        .from(repairJobs)
        .where(eq(repairJobs.vehicleId, v.id));
      return { ...v, lastJobDate: stats?.lastJobDate, jobCount: stats?.jobCount ?? 0 };
    })
  );

  return NextResponse.json({ vehicles: enriched, tel: payload.tel });
}
