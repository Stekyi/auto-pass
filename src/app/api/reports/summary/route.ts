import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  repairJobs, partsUsed, vehicles, customers,
  maintenanceSchedule,
} from "@/lib/db/schema";
import { eq, and, gte, sql, count, sum, desc } from "drizzle-orm";
import { subDays, subMonths, format, startOfMonth } from "date-fns";

function periodStart(period: string): string | null {
  if (period === "30d")   return subDays(new Date(), 30).toISOString().split("T")[0];
  if (period === "90d")   return subDays(new Date(), 90).toISOString().split("T")[0];
  if (period === "12m")   return subMonths(new Date(), 12).toISOString().split("T")[0];
  return null; // all_time
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { mechanicId?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const mid = user.mechanicId;
  const period = new URL(req.url).searchParams.get("period") ?? "30d";
  const since = periodStart(period);

  const jobFilter = since
    ? and(eq(repairJobs.mechanicId, mid), gte(repairJobs.jobDate, since))
    : eq(repairJobs.mechanicId, mid);

  // ── Core job metrics ──────────────────────────────────────────────────────
  const [totals] = await db
    .select({
      totalJobs:       count(repairJobs.id),
      totalRevenue:    sum(repairJobs.totalCostGhs),
      avgJobValue:     sql<string>`avg(${repairJobs.totalCostGhs}::numeric)`,
      doneCount:       sql<number>`count(*) filter (where ${repairJobs.status} = 'DONE')`,
      pendingCount:    sql<number>`count(*) filter (where ${repairJobs.status} = 'PENDING')`,
      inProgressCount: sql<number>`count(*) filter (where ${repairJobs.status} = 'IN_PROGRESS')`,
      cancelledCount:  sql<number>`count(*) filter (where ${repairJobs.status} = 'CANCELLED')`,
    })
    .from(repairJobs)
    .where(jobFilter);

  // ── Unique vehicles + customers ───────────────────────────────────────────
  const [uniqueCounts] = await db
    .select({
      uniqueVehicles:  sql<number>`count(distinct ${repairJobs.vehicleId})`,
      uniqueCustomers: sql<number>`count(distinct ${repairJobs.customerId})`,
    })
    .from(repairJobs)
    .where(jobFilter);

  // ── Top 5 parts used ──────────────────────────────────────────────────────
  const topParts = await db
    .select({
      partName: partsUsed.partName,
      timesUsed: count(partsUsed.id),
      totalQty:  sum(partsUsed.quantity),
    })
    .from(partsUsed)
    .innerJoin(repairJobs, eq(partsUsed.jobId, repairJobs.id))
    .where(jobFilter)
    .groupBy(partsUsed.partName)
    .orderBy(desc(count(partsUsed.id)))
    .limit(8);

  // ── Top 5 vehicles by visits ──────────────────────────────────────────────
  const topVehicles = await db
    .select({
      vehicleId:   repairJobs.vehicleId,
      plateNumber: vehicles.plateNumber,
      vehicleNumber: vehicles.vehicleNumber,
      make:        vehicles.make,
      model:       vehicles.model,
      visits:      count(repairJobs.id),
      totalSpend:  sum(repairJobs.totalCostGhs),
    })
    .from(repairJobs)
    .leftJoin(vehicles, eq(repairJobs.vehicleId, vehicles.id))
    .where(jobFilter)
    .groupBy(repairJobs.vehicleId, vehicles.plateNumber, vehicles.vehicleNumber, vehicles.make, vehicles.model)
    .orderBy(desc(count(repairJobs.id)))
    .limit(5);

  // ── Top 5 customers by visit frequency ───────────────────────────────────
  const topCustomers = await db
    .select({
      customerId:   repairJobs.customerId,
      customerName: customers.fullName,
      customerTel:  customers.tel,
      visits:       count(repairJobs.id),
      totalSpend:   sum(repairJobs.totalCostGhs),
    })
    .from(repairJobs)
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .where(jobFilter)
    .groupBy(repairJobs.customerId, customers.fullName, customers.tel)
    .orderBy(desc(count(repairJobs.id)))
    .limit(5);

  // ── Monthly revenue trend (last 6 months always) ─────────────────────────
  const revenueByMonth = await db
    .select({
      month:   sql<string>`to_char(${repairJobs.jobDate}::date, 'YYYY-MM')`,
      revenue: sum(repairJobs.totalCostGhs),
      jobs:    count(repairJobs.id),
    })
    .from(repairJobs)
    .where(and(
      eq(repairJobs.mechanicId, mid),
      gte(repairJobs.jobDate, subMonths(new Date(), 6).toISOString().split("T")[0])
    ))
    .groupBy(sql`to_char(${repairJobs.jobDate}::date, 'YYYY-MM')`)
    .orderBy(sql`to_char(${repairJobs.jobDate}::date, 'YYYY-MM')`);

  // ── Upcoming / overdue maintenance ────────────────────────────────────────
  const [overdueCount] = await db
    .select({ count: count() })
    .from(maintenanceSchedule)
    .where(and(
      eq(maintenanceSchedule.mechanicId, mid),
      eq(maintenanceSchedule.isCompleted, false),
      sql`${maintenanceSchedule.dueDateEstimate} < current_date`
    ));

  const [upcomingCount] = await db
    .select({ count: count() })
    .from(maintenanceSchedule)
    .where(and(
      eq(maintenanceSchedule.mechanicId, mid),
      eq(maintenanceSchedule.isCompleted, false),
      sql`${maintenanceSchedule.dueDateEstimate} between current_date and current_date + interval '30 days'`
    ));

  return NextResponse.json({
    period,
    since,
    totals: {
      jobs:       totals?.totalJobs ?? 0,
      revenue:    parseFloat(totals?.totalRevenue ?? "0"),
      avgValue:   parseFloat(totals?.avgJobValue ?? "0"),
      uniqueVehicles:  uniqueCounts?.uniqueVehicles ?? 0,
      uniqueCustomers: uniqueCounts?.uniqueCustomers ?? 0,
      byStatus: {
        done:       totals?.doneCount ?? 0,
        pending:    totals?.pendingCount ?? 0,
        inProgress: totals?.inProgressCount ?? 0,
        cancelled:  totals?.cancelledCount ?? 0,
      },
    },
    topParts:     topParts.map(p => ({ name: p.partName, count: p.timesUsed, qty: p.totalQty })),
    topVehicles:  topVehicles.map(v => ({
      plate: v.plateNumber ?? v.vehicleNumber,
      make: v.make, model: v.model,
      visits: v.visits, spend: parseFloat(v.totalSpend ?? "0"),
    })),
    topCustomers: topCustomers.map(c => ({
      name: c.customerName, tel: c.customerTel,
      visits: c.visits, spend: parseFloat(c.totalSpend ?? "0"),
    })),
    revenueByMonth: revenueByMonth.map(r => ({
      month: r.month, revenue: parseFloat(r.revenue ?? "0"), jobs: r.jobs,
    })),
    maintenance: {
      overdue:  overdueCount?.count ?? 0,
      upcoming: upcomingCount?.count ?? 0,
    },
  });
}
