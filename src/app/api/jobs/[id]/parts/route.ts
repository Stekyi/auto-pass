import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { partsUsed, repairJobs, partLifeExpectancy, maintenanceSchedule } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { addMonths } from "date-fns";
import { z } from "zod";

const partSchema = z.object({
  partName: z.string().min(1).max(200),
  partNumber: z.string().max(100).optional(),
  quantity: z.number().int().min(1).default(1),
  unitCostGhs: z.number().min(0).optional(),
  receiptKey: z.string().optional(),
});

const updatePartSchema = z.object({
  id: z.string().uuid(),
  quantity: z.number().int().min(1).optional(),
  unitCostGhs: z.number().min(0).optional(),
  receiptKey: z.string().optional(),
});

async function ensureJobAccess(jobId: string, mechanicId: string | null | undefined, isAdmin: boolean) {
  const where = isAdmin
    ? eq(repairJobs.id, jobId)
    : and(eq(repairJobs.id, jobId), eq(repairJobs.mechanicId, mechanicId!));
  const [job] = await db.select().from(repairJobs).where(where).limit(1);
  return job;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { mechanicId?: string | null; role?: string };
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: jobId } = await params;
  const job = await ensureJobAccess(jobId, user.mechanicId, isAdmin);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parts = await db.select().from(partsUsed).where(eq(partsUsed.jobId, jobId));
  return NextResponse.json({ parts });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { mechanicId?: string | null; role?: string };
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: jobId } = await params;
  const job = await ensureJobAccess(jobId, user.mechanicId, isAdmin);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = z.array(partSchema).or(partSchema).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const items = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  const inserted = await db.insert(partsUsed).values(
    items.map((p) => ({
      jobId,
      partName: p.partName,
      partNumber: p.partNumber ?? null,
      quantity: p.quantity,
      unitCostGhs: p.unitCostGhs != null ? String(p.unitCostGhs) : null,
      receiptKey: p.receiptKey ?? null,
    }))
  ).returning();

  // Auto-schedule maintenance for recognised parts
  const lifeRows = await db
    .select()
    .from(partLifeExpectancy)
    .where(
      and(
        eq(partLifeExpectancy.isActive, true),
        sql`lower(${partLifeExpectancy.partName}) = ANY(ARRAY[${sql.join(items.map((p) => sql`lower(${p.partName})`), sql`, `)}])`
      )
    );

  if (lifeRows.length > 0) {
    await db.insert(maintenanceSchedule).values(
      lifeRows.map((row) => ({
        mechanicId: job.mechanicId,
        vehicleId: job.vehicleId,
        sourceJobId: jobId,
        partName: row.partName,
        dueDateEstimate: row.lifeMonths
          ? addMonths(new Date(job.jobDate), row.lifeMonths).toISOString().split("T")[0]
          : null,
        dueKmEstimate: row.lifeKm && job.mileageAtJob ? job.mileageAtJob + row.lifeKm : null,
      }))
    );
  }

  return NextResponse.json({ parts: inserted }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { mechanicId?: string | null; role?: string };
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: jobId } = await params;
  const job = await ensureJobAccess(jobId, user.mechanicId, isAdmin);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updatePartSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { id, ...raw } = parsed.data;
  // Build explicit update object to satisfy Drizzle's numeric column types
  const updates: Record<string, unknown> = {};
  if (raw.quantity != null)    updates.quantity    = raw.quantity;
  if (raw.unitCostGhs != null) updates.unitCostGhs = String(raw.unitCostGhs);
  if (raw.receiptKey != null)  updates.receiptKey  = raw.receiptKey;
  const [updated] = await db.update(partsUsed).set(updates).where(and(eq(partsUsed.id, id), eq(partsUsed.jobId, jobId))).returning();
  return NextResponse.json({ part: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { mechanicId?: string | null; role?: string };
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: jobId } = await params;
  const job = await ensureJobAccess(jobId, user.mechanicId, isAdmin);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const partId = new URL(req.url).searchParams.get("partId");
  if (!partId) return NextResponse.json({ error: "partId required" }, { status: 400 });

  await db.delete(partsUsed).where(and(eq(partsUsed.id, partId), eq(partsUsed.jobId, jobId)));
  return NextResponse.json({ ok: true });
}
