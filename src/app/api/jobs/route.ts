import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { repairJobs, vehicles, partsUsed, partLifeExpectancy, maintenanceSchedule, idCounters, mechanics } from "@/lib/db/schema";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { addMonths } from "date-fns";
import { z } from "zod";
import { checkActiveSubscription } from "@/lib/auth/subscription-guard";

const partSchema = z.object({
  partName: z.string().min(1).max(200),
  partNumber: z.string().max(100).optional(),
  quantity: z.number().int().min(1).default(1),
  unitCostGhs: z.number().min(0).optional(),
});

const createSchema = z.object({
  vehicleId: z.string().uuid(),
  customerId: z.string().uuid(),
  description: z.string().optional(),
  mileageAtJob: z.number().int().optional(),
  laborCostGhs: z.number().min(0).optional(),
  partsCostGhs: z.number().min(0).optional(),
  totalCostGhs: z.number().min(0).optional(),
  jobDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE"]).default("PENDING"),
  parts: z.array(partSchema).optional(),
});

async function nextJobNumber(mechanicId: string, code: string): Promise<string> {
  const [row] = await db
    .update(idCounters)
    .set({ lastValue: sql`${idCounters.lastValue} + 1` })
    .where(and(eq(idCounters.mechanicId, mechanicId), eq(idCounters.name, "job")))
    .returning({ lastValue: idCounters.lastValue });
  if (!row) {
    await db.insert(idCounters).values({ mechanicId, name: "job", lastValue: 1 });
    return `${code}-J-0001`;
  }
  return `${code}-J-${String(row.lastValue).padStart(4, "0")}`;
}

async function autoScheduleParts(
  mechanicId: string,
  vehicleId: string,
  jobId: string,
  jobDate: string,
  mileageAtJob: number | undefined,
  partNames: string[]
) {
  if (partNames.length === 0) return;
  const lifeRows = await db
    .select()
    .from(partLifeExpectancy)
    .where(and(
      eq(partLifeExpectancy.isActive, true),
      sql`lower(${partLifeExpectancy.partName}) = ANY(ARRAY[${sql.join(partNames.map((p) => sql`lower(${p})`), sql`, `)}])`
    ));

  if (lifeRows.length === 0) return;

  await db.insert(maintenanceSchedule).values(
    lifeRows.map((row) => ({
      mechanicId,
      vehicleId,
      sourceJobId: jobId,
      partName: row.partName,
      dueDateEstimate: row.lifeMonths ? addMonths(new Date(jobDate), row.lifeMonths).toISOString().split("T")[0] : null,
      dueKmEstimate: row.lifeKm && mileageAtJob ? mileageAtJob + row.lifeKm : null,
    }))
  );
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { mechanicId?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const vehicleId = searchParams.get("vehicleId");
  const status = searchParams.get("status");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(repairJobs.mechanicId, user.mechanicId)];
  if (vehicleId) conditions.push(eq(repairJobs.vehicleId, vehicleId));
  if (status) conditions.push(eq(repairJobs.status, status as "PENDING" | "IN_PROGRESS" | "DONE" | "CANCELLED"));
  if (dateFrom) conditions.push(gte(repairJobs.jobDate, dateFrom));
  if (dateTo) conditions.push(lte(repairJobs.jobDate, dateTo));

  const rows = await db
    .select()
    .from(repairJobs)
    .where(and(...conditions))
    .orderBy(repairJobs.jobDate)
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ jobs: rows, page });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { mechanicId?: string; id?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const hasActiveSub = await checkActiveSubscription(user.mechanicId);
  if (!hasActiveSub) {
    return NextResponse.json({ error: "Your subscription has expired. Please renew to log repairs." }, { status: 402 });
  }

  const [mechanic] = await db.select({ code: mechanics.code }).from(mechanics).where(eq(mechanics.id, user.mechanicId)).limit(1);
  if (!mechanic) return NextResponse.json({ error: "Mechanic not found" }, { status: 404 });

  const jobNumber = await nextJobNumber(user.mechanicId, mechanic.code);
  const { parts, ...jobData } = parsed.data;

  const [job] = await db.insert(repairJobs).values({
    vehicleId: jobData.vehicleId,
    customerId: jobData.customerId,
    description: jobData.description ?? null,
    mileageAtJob: jobData.mileageAtJob ?? null,
    // Drizzle numeric columns require string values
    laborCostGhs: jobData.laborCostGhs != null ? String(jobData.laborCostGhs) : null,
    partsCostGhs: jobData.partsCostGhs != null ? String(jobData.partsCostGhs) : null,
    totalCostGhs: jobData.totalCostGhs != null ? String(jobData.totalCostGhs) : null,
    jobDate: jobData.jobDate,
    status: jobData.status,
    mechanicId: user.mechanicId,
    jobNumber,
    recordedBy: user.id || null,
    completedAt: jobData.status === "DONE" ? new Date() : null,
  }).returning();

  if (parts && parts.length > 0) {
    await db.insert(partsUsed).values(
      parts.map((p) => ({
        jobId: job.id,
        partName: p.partName,
        partNumber: p.partNumber ?? null,
        quantity: p.quantity,
        unitCostGhs: p.unitCostGhs != null ? String(p.unitCostGhs) : null,
      }))
    );

    await autoScheduleParts(
      user.mechanicId,
      job.vehicleId,
      job.id,
      job.jobDate,
      job.mileageAtJob ?? undefined,
      parts.map((p) => p.partName)
    );
  }

  // Update vehicle mileage if provided
  if (job.mileageAtJob != null) {
    await db.update(vehicles)
      .set({ currentMileageKm: job.mileageAtJob, updatedAt: new Date() })
      .where(eq(vehicles.id, job.vehicleId));
  }

  return NextResponse.json({ job }, { status: 201 });
}
