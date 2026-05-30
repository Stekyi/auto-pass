// ─── Mechanic-Facing Agent Tools ─────────────────────────────────────────────
// These tools are scoped to the authenticated mechanic's data.
// The agent uses them to answer questions like:
//   "What are my most common repairs?"
//   "Which customer brings their car most often?"
//   "How was my revenue last quarter vs this quarter?"
//   "Which vehicle has had the most issues?"

import { db } from "@/lib/db";
import {
  repairJobs, partsUsed, vehicles, customers, maintenanceSchedule,
} from "@/lib/db/schema";
import { eq, and, gte, sql, count, sum, desc, lte } from "drizzle-orm";
import { subDays, subMonths } from "date-fns";
import type { ToolDefinition } from "./state";

export interface MechanicContext {
  mechanicId: string;
  shopName?: string;
}

function since(days: number): string {
  return subDays(new Date(), days).toISOString().split("T")[0];
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const mechanicToolDefs: ToolDefinition[] = [
  {
    name: "get_workshop_stats",
    description: "Get overall performance stats for the workshop: total jobs, revenue, number of vehicles and customers served, and job status breakdown. Accepts a period parameter.",
    input_schema: {
      type: "object",
      properties: {
        period_days: { type: "string", description: "Number of past days to analyse. Use 30 for last month, 90 for quarter, 365 for year. Omit for all time." },
      },
    },
  },
  {
    name: "get_top_parts",
    description: "Find the most frequently used parts or services in the workshop. Useful for understanding what repairs are most common.",
    input_schema: {
      type: "object",
      properties: {
        period_days: { type: "string", description: "Number of past days (e.g. 90). Omit for all time." },
        limit: { type: "string", description: "How many results to return (default 8)" },
      },
    },
  },
  {
    name: "get_top_vehicles",
    description: "List vehicles that visit the workshop most often. Shows visit count, total spend per vehicle, and last service date.",
    input_schema: {
      type: "object",
      properties: {
        period_days: { type: "string", description: "Number of past days. Omit for all time." },
        limit: { type: "string", description: "How many vehicles to return (default 5)" },
      },
    },
  },
  {
    name: "get_top_customers",
    description: "Find the most loyal or high-value customers. Shows visit frequency and total amount spent.",
    input_schema: {
      type: "object",
      properties: {
        period_days: { type: "string", description: "Number of past days. Omit for all time." },
        limit: { type: "string", description: "How many customers to return (default 5)" },
      },
    },
  },
  {
    name: "get_revenue_trend",
    description: "Show monthly revenue and job count over the past N months. Good for spotting busy seasons or growth trends.",
    input_schema: {
      type: "object",
      properties: {
        months: { type: "string", description: "Number of months to show (default 6, max 24)" },
      },
    },
  },
  {
    name: "get_vehicle_problem_history",
    description: "Retrieve the full repair history for a specific vehicle — what problems it has had, what was fixed, and when. Use this when asked about a specific car.",
    input_schema: {
      type: "object",
      properties: {
        plate_or_id: { type: "string", description: "The vehicle's plate number or ID" },
        limit: { type: "string", description: "How many recent jobs to return (default 10)" },
      },
      required: ["plate_or_id"],
    },
  },
  {
    name: "get_pending_maintenance",
    description: "List all overdue and upcoming maintenance items the workshop needs to follow up on with customers.",
    input_schema: {
      type: "object",
      properties: {
        days_ahead: { type: "string", description: "How many days ahead to look for upcoming items (default 30)" },
      },
    },
  },
];

// ─── Tool implementations ─────────────────────────────────────────────────────

export async function getMechanicWorkshopStats(
  input: { period_days?: string },
  ctx: MechanicContext
) {
  const mid = ctx.mechanicId;
  const cutoff = input.period_days ? since(parseInt(input.period_days)) : null;
  const filter = cutoff
    ? and(eq(repairJobs.mechanicId, mid), gte(repairJobs.jobDate, cutoff))
    : eq(repairJobs.mechanicId, mid);

  const [totals] = await db
    .select({
      totalJobs:    count(repairJobs.id),
      totalRevenue: sum(repairJobs.totalCostGhs),
      avgValue:     sql<string>`round(avg(${repairJobs.totalCostGhs}::numeric), 2)`,
      doneJobs:     sql<number>`count(*) filter (where ${repairJobs.status} = 'DONE')`,
    })
    .from(repairJobs)
    .where(filter);

  const [uniq] = await db
    .select({
      vehicles:  sql<number>`count(distinct ${repairJobs.vehicleId})`,
      customers: sql<number>`count(distinct ${repairJobs.customerId})`,
    })
    .from(repairJobs)
    .where(filter);

  return {
    period_days: input.period_days ?? "all_time",
    total_jobs: totals?.totalJobs ?? 0,
    completed_jobs: totals?.doneJobs ?? 0,
    total_revenue_ghs: parseFloat(totals?.totalRevenue ?? "0").toFixed(2),
    avg_job_value_ghs: parseFloat(totals?.avgValue ?? "0").toFixed(2),
    unique_vehicles: uniq?.vehicles ?? 0,
    unique_customers: uniq?.customers ?? 0,
  };
}

export async function getMechanicTopParts(
  input: { period_days?: string; limit?: string },
  ctx: MechanicContext
) {
  const cutoff = input.period_days ? since(parseInt(input.period_days)) : null;
  const lim = parseInt(input.limit ?? "8", 10);

  const rows = await db
    .select({
      partName:  partsUsed.partName,
      timesUsed: count(partsUsed.id),
      totalQty:  sum(partsUsed.quantity),
    })
    .from(partsUsed)
    .innerJoin(repairJobs, eq(partsUsed.jobId, repairJobs.id))
    .where(
      cutoff
        ? and(eq(repairJobs.mechanicId, ctx.mechanicId), gte(repairJobs.jobDate, cutoff))
        : eq(repairJobs.mechanicId, ctx.mechanicId)
    )
    .groupBy(partsUsed.partName)
    .orderBy(desc(count(partsUsed.id)))
    .limit(lim);

  return {
    period_days: input.period_days ?? "all_time",
    top_parts: rows.map(r => ({
      name: r.partName,
      jobs_used_in: r.timesUsed,
      total_quantity: r.totalQty,
    })),
  };
}

export async function getMechanicTopVehicles(
  input: { period_days?: string; limit?: string },
  ctx: MechanicContext
) {
  const cutoff = input.period_days ? since(parseInt(input.period_days)) : null;
  const lim = parseInt(input.limit ?? "5", 10);
  const filter = cutoff
    ? and(eq(repairJobs.mechanicId, ctx.mechanicId), gte(repairJobs.jobDate, cutoff))
    : eq(repairJobs.mechanicId, ctx.mechanicId);

  const rows = await db
    .select({
      plate:      vehicles.plateNumber,
      vnum:       vehicles.vehicleNumber,
      make:       vehicles.make,
      model:      vehicles.model,
      year:       vehicles.year,
      visits:     count(repairJobs.id),
      totalSpend: sum(repairJobs.totalCostGhs),
      lastVisit:  sql<string>`max(${repairJobs.jobDate})`,
    })
    .from(repairJobs)
    .leftJoin(vehicles, eq(repairJobs.vehicleId, vehicles.id))
    .where(filter)
    .groupBy(vehicles.plateNumber, vehicles.vehicleNumber, vehicles.make, vehicles.model, vehicles.year)
    .orderBy(desc(count(repairJobs.id)))
    .limit(lim);

  return {
    vehicles: rows.map(r => ({
      plate: r.plate ?? r.vnum,
      make: r.make, model: r.model, year: r.year,
      visits: r.visits,
      total_spend_ghs: parseFloat(r.totalSpend ?? "0").toFixed(2),
      last_visit: r.lastVisit,
    })),
  };
}

export async function getMechanicTopCustomers(
  input: { period_days?: string; limit?: string },
  ctx: MechanicContext
) {
  const cutoff = input.period_days ? since(parseInt(input.period_days)) : null;
  const lim = parseInt(input.limit ?? "5", 10);
  const filter = cutoff
    ? and(eq(repairJobs.mechanicId, ctx.mechanicId), gte(repairJobs.jobDate, cutoff))
    : eq(repairJobs.mechanicId, ctx.mechanicId);

  const rows = await db
    .select({
      name:       customers.fullName,
      tel:        customers.tel,
      visits:     count(repairJobs.id),
      totalSpend: sum(repairJobs.totalCostGhs),
      lastVisit:  sql<string>`max(${repairJobs.jobDate})`,
    })
    .from(repairJobs)
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .where(filter)
    .groupBy(customers.fullName, customers.tel)
    .orderBy(desc(count(repairJobs.id)))
    .limit(lim);

  return {
    customers: rows.map(r => ({
      name: r.name, tel: r.tel,
      visits: r.visits,
      total_spend_ghs: parseFloat(r.totalSpend ?? "0").toFixed(2),
      last_visit: r.lastVisit,
    })),
  };
}

export async function getMechanicRevenueTrend(
  input: { months?: string },
  ctx: MechanicContext
) {
  const m = Math.min(parseInt(input.months ?? "6", 10), 24);
  const cutoff = subMonths(new Date(), m).toISOString().split("T")[0];

  const rows = await db
    .select({
      month:   sql<string>`to_char(${repairJobs.jobDate}::date, 'YYYY-MM')`,
      revenue: sum(repairJobs.totalCostGhs),
      jobs:    count(repairJobs.id),
    })
    .from(repairJobs)
    .where(and(eq(repairJobs.mechanicId, ctx.mechanicId), gte(repairJobs.jobDate, cutoff)))
    .groupBy(sql`to_char(${repairJobs.jobDate}::date, 'YYYY-MM')`)
    .orderBy(sql`to_char(${repairJobs.jobDate}::date, 'YYYY-MM')`);

  return {
    months,
    trend: rows.map(r => ({
      month: r.month,
      revenue_ghs: parseFloat(r.revenue ?? "0").toFixed(2),
      jobs: r.jobs,
    })),
  };
}

export async function getMechanicVehicleHistory(
  input: { plate_or_id: string; limit?: string },
  ctx: MechanicContext
) {
  const lim = parseInt(input.limit ?? "10", 10);
  const q = input.plate_or_id.trim();

  // Find vehicle by plate or ID
  const [veh] = await db
    .select({ id: vehicles.id, plate: vehicles.plateNumber, make: vehicles.make, model: vehicles.model })
    .from(vehicles)
    .where(
      sql`lower(${vehicles.plateNumber}) = lower(${q}) or ${vehicles.id}::text = ${q}`
    )
    .limit(1);

  if (!veh) return { error: `No vehicle found matching "${q}"` };

  const jobs = await db
    .select({
      jobNumber:   repairJobs.jobNumber,
      jobDate:     repairJobs.jobDate,
      status:      repairJobs.status,
      description: repairJobs.description,
      mileage:     repairJobs.mileageAtJob,
      totalCost:   repairJobs.totalCostGhs,
    })
    .from(repairJobs)
    .where(and(eq(repairJobs.vehicleId, veh.id), eq(repairJobs.mechanicId, ctx.mechanicId)))
    .orderBy(desc(repairJobs.jobDate))
    .limit(lim);

  const jobsWithParts = await Promise.all(
    jobs.map(async (j) => {
      const parts = await db
        .select({ part: partsUsed.partName, qty: partsUsed.quantity })
        .from(partsUsed)
        .innerJoin(repairJobs, eq(partsUsed.jobId, repairJobs.id))
        .where(sql`${repairJobs.jobNumber} = ${j.jobNumber}`);
      return { ...j, parts: parts.map(p => `${p.part} x${p.qty}`).join(", ") };
    })
  );

  return {
    vehicle: { plate: veh.plate, make: veh.make, model: veh.model },
    job_count: jobs.length,
    history: jobsWithParts,
  };
}

export async function getMechanicPendingMaintenance(
  input: { days_ahead?: string },
  ctx: MechanicContext
) {
  const ahead = parseInt(input.days_ahead ?? "30", 10);
  const today = new Date().toISOString().split("T")[0];
  const future = subDays(new Date(), -ahead).toISOString().split("T")[0];

  const rows = await db
    .select({
      partName:  maintenanceSchedule.partName,
      dueDate:   maintenanceSchedule.dueDateEstimate,
      dueKm:     maintenanceSchedule.dueKmEstimate,
      plate:     vehicles.plateNumber,
      vnum:      vehicles.vehicleNumber,
      customer:  customers.fullName,
      tel:       customers.tel,
    })
    .from(maintenanceSchedule)
    .leftJoin(vehicles,  eq(maintenanceSchedule.vehicleId,  vehicles.id))
    .leftJoin(customers, eq(vehicles.customerId, customers.id))
    .where(
      and(
        eq(maintenanceSchedule.mechanicId, ctx.mechanicId),
        eq(maintenanceSchedule.isCompleted, false),
        lte(maintenanceSchedule.dueDateEstimate, future)
      )
    )
    .orderBy(maintenanceSchedule.dueDateEstimate)
    .limit(20);

  const overdue = rows.filter(r => r.dueDate && r.dueDate < today);
  const upcoming = rows.filter(r => r.dueDate && r.dueDate >= today);

  return {
    overdue_count: overdue.length,
    upcoming_count: upcoming.length,
    overdue: overdue.map(r => ({
      vehicle: r.plate ?? r.vnum, customer: r.customer, tel: r.tel,
      service: r.partName, due: r.dueDate, due_km: r.dueKm,
    })),
    upcoming: upcoming.map(r => ({
      vehicle: r.plate ?? r.vnum, customer: r.customer, tel: r.tel,
      service: r.partName, due: r.dueDate, due_km: r.dueKm,
    })),
  };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function executeMechanicTool(
  name: string,
  input: Record<string, unknown>,
  ctx: MechanicContext
): Promise<unknown> {
  switch (name) {
    case "get_workshop_stats":      return getMechanicWorkshopStats(input as { period_days?: string }, ctx);
    case "get_top_parts":           return getMechanicTopParts(input as { period_days?: string; limit?: string }, ctx);
    case "get_top_vehicles":        return getMechanicTopVehicles(input as { period_days?: string; limit?: string }, ctx);
    case "get_top_customers":       return getMechanicTopCustomers(input as { period_days?: string; limit?: string }, ctx);
    case "get_revenue_trend":       return getMechanicRevenueTrend(input as { months?: string }, ctx);
    case "get_vehicle_problem_history": return getMechanicVehicleHistory(input as { plate_or_id: string; limit?: string }, ctx);
    case "get_pending_maintenance": return getMechanicPendingMaintenance(input as { days_ahead?: string }, ctx);
    default: return { error: `Unknown tool: ${name}` };
  }
}
