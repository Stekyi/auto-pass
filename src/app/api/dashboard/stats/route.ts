import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { repairJobs, vehicles, maintenanceSchedule } from "@/lib/db/schema";
import { eq, and, gte, lte, count, sql } from "drizzle-orm";
import { addDays } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { mechanicId?: string | null; role?: string };
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 8) + "01";
  const in30Days = addDays(new Date(), 30).toISOString().split("T")[0];

  const mechanicFilter = !isAdmin && user.mechanicId ? eq(repairJobs.mechanicId, user.mechanicId) : null;
  const scheduleFilter = !isAdmin && user.mechanicId ? eq(maintenanceSchedule.mechanicId, user.mechanicId) : null;

  const [jobsToday, jobsThisMonth, revenue, upcoming, activeVehicles] = await Promise.all([
    db.select({ count: count() }).from(repairJobs)
      .where(mechanicFilter ? and(mechanicFilter, eq(repairJobs.jobDate, today)) : eq(repairJobs.jobDate, today)),

    db.select({ count: count() }).from(repairJobs)
      .where(mechanicFilter ? and(mechanicFilter, gte(repairJobs.jobDate, monthStart)) : gte(repairJobs.jobDate, monthStart)),

    db.select({ total: sql<string>`coalesce(sum(${repairJobs.totalCostGhs}), 0)` }).from(repairJobs)
      .where(
        mechanicFilter
          ? and(mechanicFilter, gte(repairJobs.jobDate, monthStart), eq(repairJobs.status, "DONE"))
          : and(gte(repairJobs.jobDate, monthStart), eq(repairJobs.status, "DONE"))
      ),

    db.select({ count: count() }).from(maintenanceSchedule)
      .where(
        scheduleFilter
          ? and(scheduleFilter, eq(maintenanceSchedule.isCompleted, false), lte(maintenanceSchedule.dueDateEstimate, in30Days))
          : and(eq(maintenanceSchedule.isCompleted, false), lte(maintenanceSchedule.dueDateEstimate, in30Days))
      ),

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
