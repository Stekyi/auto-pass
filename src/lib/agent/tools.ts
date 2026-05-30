// ─── AutoPass Agent Tools ─────────────────────────────────────────────────────
// Each tool has:
//   - definition: JSON Schema for the LLM to understand when to call it
//   - execute(input, ctx): runs the actual DB query

import { db } from "@/lib/db";
import {
  vehicles, repairJobs, partsUsed, maintenanceSchedule,
  mechanics, customers,
} from "@/lib/db/schema";
import { eq, and, desc, gte, sum, count, sql } from "drizzle-orm";
import { subMonths } from "date-fns";

export interface ToolContext {
  customerTel: string;
  vehicleId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

// ─── Tool: get_my_vehicles ────────────────────────────────────────────────────

export const getMyVehiclesTool: ToolDefinition = {
  name: "get_my_vehicles",
  description: "List all vehicles registered to the customer. Returns plate, make, model, year, and last service date.",
  input_schema: { type: "object", properties: {} },
};

export async function getMyVehicles(ctx: ToolContext) {
  const customerRecords = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.tel, ctx.customerTel));

  if (customerRecords.length === 0) return { vehicles: [] };

  const vehicleList = await Promise.all(
    customerRecords.map((c) =>
      db.select().from(vehicles).where(eq(vehicles.customerId, c.id))
    )
  );

  return {
    vehicles: vehicleList.flat().map((v) => ({
      id: v.id,
      plate: v.plateNumber ?? v.vehicleNumber,
      make: v.make,
      model: v.model,
      year: v.year,
      mileage: v.currentMileageKm,
    })),
  };
}

// ─── Tool: get_repair_history ─────────────────────────────────────────────────

export const getRepairHistoryTool: ToolDefinition = {
  name: "get_repair_history",
  description: "Fetch the last N repair jobs for a vehicle. Returns date, workshop name, description, parts replaced, and cost.",
  input_schema: {
    type: "object",
    properties: {
      vehicle_id: { type: "string", description: "The vehicle UUID. If not provided, uses the current vehicle context." },
      limit: { type: "string", description: "Number of records to return (default 5, max 20)" },
    },
  },
};

export async function getRepairHistory(
  input: { vehicle_id?: string; limit?: string },
  ctx: ToolContext
) {
  const vid = input.vehicle_id ?? ctx.vehicleId;
  if (!vid) return { error: "No vehicle specified" };

  const limit = Math.min(parseInt(input.limit ?? "5", 10), 20);

  const jobs = await db
    .select({
      id: repairJobs.id,
      jobNumber: repairJobs.jobNumber,
      jobDate: repairJobs.jobDate,
      status: repairJobs.status,
      description: repairJobs.description,
      mileageAtJob: repairJobs.mileageAtJob,
      laborCostGhs: repairJobs.laborCostGhs,
      totalCostGhs: repairJobs.totalCostGhs,
      shopName: mechanics.name,
      shopTel: mechanics.contactTel,
    })
    .from(repairJobs)
    .leftJoin(mechanics, eq(repairJobs.mechanicId, mechanics.id))
    .where(eq(repairJobs.vehicleId, vid))
    .orderBy(desc(repairJobs.jobDate))
    .limit(limit);

  const jobsWithParts = await Promise.all(
    jobs.map(async (j) => {
      const parts = await db
        .select({ partName: partsUsed.partName, quantity: partsUsed.quantity, cost: partsUsed.unitCostGhs })
        .from(partsUsed)
        .where(eq(partsUsed.jobId, j.id));
      return { ...j, parts };
    })
  );

  return { repairs: jobsWithParts, count: jobs.length };
}

// ─── Tool: get_cost_summary ───────────────────────────────────────────────────

export const getCostSummaryTool: ToolDefinition = {
  name: "get_cost_summary",
  description: "Summarise total money spent on repairs for a vehicle over a time period. Returns total spend, labour vs parts breakdown, and monthly average.",
  input_schema: {
    type: "object",
    properties: {
      vehicle_id: { type: "string", description: "The vehicle UUID (defaults to current context)" },
      months: { type: "string", description: "How many months of history to analyse (default 12)" },
    },
  },
};

export async function getCostSummary(
  input: { vehicle_id?: string; months?: string },
  ctx: ToolContext
) {
  const vid = input.vehicle_id ?? ctx.vehicleId;
  if (!vid) return { error: "No vehicle specified" };

  const months = parseInt(input.months ?? "12", 10);
  const since = subMonths(new Date(), months).toISOString().split("T")[0];

  const [totals] = await db
    .select({
      totalSpend: sum(repairJobs.totalCostGhs),
      totalLabour: sum(repairJobs.laborCostGhs),
      totalParts: sum(repairJobs.partsCostGhs),
      jobCount: count(repairJobs.id),
    })
    .from(repairJobs)
    .where(and(eq(repairJobs.vehicleId, vid), gte(repairJobs.jobDate, since)));

  const totalGhs = parseFloat(totals?.totalSpend ?? "0");
  const avg = months > 0 ? totalGhs / months : 0;

  return {
    period_months: months,
    total_spend_ghs: totalGhs.toFixed(2),
    labour_ghs: parseFloat(totals?.totalLabour ?? "0").toFixed(2),
    parts_ghs: parseFloat(totals?.totalParts ?? "0").toFixed(2),
    job_count: totals?.jobCount ?? 0,
    monthly_average_ghs: avg.toFixed(2),
  };
}

// ─── Tool: get_maintenance_schedule ──────────────────────────────────────────

export const getMaintenanceScheduleTool: ToolDefinition = {
  name: "get_maintenance_schedule",
  description: "Get upcoming and overdue maintenance items for a vehicle. Includes what service is due, estimated date, and mileage trigger.",
  input_schema: {
    type: "object",
    properties: {
      vehicle_id: { type: "string", description: "The vehicle UUID (defaults to current context)" },
    },
  },
};

export async function getMaintenanceSchedule(
  input: { vehicle_id?: string },
  ctx: ToolContext
) {
  const vid = input.vehicle_id ?? ctx.vehicleId;
  if (!vid) return { error: "No vehicle specified" };

  const today = new Date().toISOString().split("T")[0];

  const items = await db
    .select()
    .from(maintenanceSchedule)
    .where(and(eq(maintenanceSchedule.vehicleId, vid), eq(maintenanceSchedule.isCompleted, false)))
    .orderBy(maintenanceSchedule.dueDateEstimate);

  return {
    items: items.map((i) => ({
      service: i.partName,
      due_date: i.dueDateEstimate,
      due_km: i.dueKmEstimate,
      overdue: i.dueDateEstimate ? i.dueDateEstimate < today : false,
      notes: i.notes,
    })),
    overdue_count: items.filter((i) => i.dueDateEstimate && i.dueDateEstimate < today).length,
  };
}

// ─── Tool: find_nearby_mechanics ─────────────────────────────────────────────

export const findNearbyMechanicsTool: ToolDefinition = {
  name: "find_nearby_mechanics",
  description: "Find AutoPass-registered mechanics near a GPS location using the Haversine formula. Returns shop name, distance, phone, and address.",
  input_schema: {
    type: "object",
    properties: {
      lat: { type: "string", description: "Latitude of the search location" },
      lng: { type: "string", description: "Longitude of the search location" },
      radius_km: { type: "string", description: "Search radius in kilometres (default 20)" },
    },
    required: ["lat", "lng"],
  },
};

export async function findNearbyMechanics(input: {
  lat: string;
  lng: string;
  radius_km?: string;
}) {
  const lat = parseFloat(input.lat);
  const lng = parseFloat(input.lng);
  const radius = parseFloat(input.radius_km ?? "20");

  if (isNaN(lat) || isNaN(lng)) return { error: "Invalid coordinates" };

  // Haversine formula in SQL — returns distance in km
  const rows = await db.execute(sql`
    SELECT
      id, name, owner_name, contact_tel, location, lat, lng,
      (6371 * acos(
        LEAST(1, GREATEST(-1,
          cos(radians(${lat})) * cos(radians(lat::float)) * cos(radians(lng::float) - radians(${lng}))
          + sin(radians(${lat})) * sin(radians(lat::float))
        ))
      )) AS distance_km
    FROM mechanics
    WHERE is_active = true
      AND lat IS NOT NULL
      AND lng IS NOT NULL
    ORDER BY distance_km
    LIMIT 10
  `);

  const nearby = (rows.rows as Array<{
    id: string; name: string; owner_name: string | null;
    contact_tel: string | null; location: string | null;
    lat: string; lng: string; distance_km: number;
  }>).filter((r) => r.distance_km <= radius);

  return {
    search_location: { lat, lng },
    radius_km: radius,
    mechanics: nearby.map((r) => ({
      name: r.name,
      owner: r.owner_name,
      phone: r.contact_tel,
      address: r.location,
      distance_km: Math.round(r.distance_km * 10) / 10,
    })),
    count: nearby.length,
  };
}

// ─── All tools registry ───────────────────────────────────────────────────────

export const ALL_TOOLS: ToolDefinition[] = [
  getMyVehiclesTool,
  getRepairHistoryTool,
  getCostSummaryTool,
  getMaintenanceScheduleTool,
  findNearbyMechanicsTool,
];

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  switch (name) {
    case "get_my_vehicles":
      return getMyVehicles(ctx);
    case "get_repair_history":
      return getRepairHistory(input as Parameters<typeof getRepairHistory>[0], ctx);
    case "get_cost_summary":
      return getCostSummary(input as Parameters<typeof getCostSummary>[0], ctx);
    case "get_maintenance_schedule":
      return getMaintenanceSchedule(input as Parameters<typeof getMaintenanceSchedule>[0], ctx);
    case "find_nearby_mechanics":
      return findNearbyMechanics(input as Parameters<typeof findNearbyMechanics>[0]);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
