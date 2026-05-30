import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { repairJobs, vehicles, maintenanceSchedule } from "@/lib/db/schema";
import { eq, and, gte, lte, count, sql } from "drizzle-orm";
import { addDays } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { mechanicId?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 8) + "01";
  const in30Days = addDays(new Date(), 30).toISOString().split("T")[0];

  const [jobsToday, jobsThisMonth, revenue, upcoming, activeVehicles] = await Promise.all([
    db.select({ count: count() }).from(repairJobs)
      .where(and(eq(repairJobs.mechanicId, user.mechanicId), eq(repairJobs.jobDate, today))),

    db.select({ count: count() }).from(repairJobs)
      .where(and(eq(repairJobs.mechanicId, user.mechanicId), gte(repairJobs.jobDate, monthStart))),

    db.select({ total: sql<string>`coalesce(sum(${repairJobs.totalCostGhs}), 0)` }).from(repairJobs)
      .where(and(
        eq(repairJobs.mechanicId, user.mechanicId),
        gte(repairJobs.jobDate, monthStart),
        eq(repairJobs.status, "DONE")
      )),

    db.select({ count: count() }).from(maintenanceSchedule)
      .where(and(
        eq(maintenanceSchedule.mechanicId, user.mechanicId),
        eq(maintenanceSchedule.isCompleted, false),
        lte(maintenanceSchedule.dueDateEstimate, in30Days)
      )),

    db.select({ count: count() }).from(vehicles)
      .where(eq(vehicles.isActive, true)),
  ]);

  return NextResponse.json({
    jobsToday: jobsToday[0]?.count ?? 0,
    jobsThisMonth: jobsThisMonth[0]?.count ?? 0,
    revenueThisMonth: parseFloat(revenue[0]?.total ?? "0"),
    upcoming30Days: upcoming[0]?.count ?? 0,
    activeVehicles: activeVehicles[0]?.count ?? 0,
  });
}
