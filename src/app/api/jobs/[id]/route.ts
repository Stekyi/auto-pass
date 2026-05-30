import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { repairJobs, jobPhotos, partsUsed } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDownloadUrl } from "@/lib/storage/r2";

const updateSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
  description: z.string().optional(),
  mileageAtJob: z.number().int().optional(),
  laborCostGhs: z.number().min(0).optional(),
  partsCostGhs: z.number().min(0).optional(),
  totalCostGhs: z.number().min(0).optional(),
  jobDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

async function getJob(id: string, mechanicId: string) {
  const [row] = await db.select().from(repairJobs)
    .where(and(eq(repairJobs.id, id), eq(repairJobs.mechanicId, mechanicId)))
    .limit(1);
  return row;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { mechanicId?: string | null; role?: string };
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const job = isAdmin
    ? await db.select().from(repairJobs).where(eq(repairJobs.id, id)).limit(1).then((r) => r[0])
    : await getJob(id, user.mechanicId!);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [photos, parts] = await Promise.all([
    db.select().from(jobPhotos).where(eq(jobPhotos.jobId, id)).orderBy(jobPhotos.sortOrder),
    db.select().from(partsUsed).where(eq(partsUsed.jobId, id)),
  ]);

  const photosWithUrls = await Promise.all(
    photos.map(async (p) => ({
      ...p,
      url: await getDownloadUrl(p.fileKey).catch(() => null),
    }))
  );

  return NextResponse.json({ job, photos: photosWithUrls, parts });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { mechanicId?: string | null; role?: string };
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const job = isAdmin
    ? await db.select().from(repairJobs).where(eq(repairJobs.id, id)).limit(1).then((r) => r[0])
    : await getJob(id, user.mechanicId!);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.status === "DONE" && !job.completedAt) {
    updates.completedAt = new Date();
  }

  const [updated] = await db.update(repairJobs).set(updates).where(eq(repairJobs.id, id)).returning();
  return NextResponse.json({ job: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { mechanicId?: string | null; role?: string };
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const job = isAdmin
    ? await db.select().from(repairJobs).where(eq(repairJobs.id, id)).limit(1).then((r) => r[0])
    : await getJob(id, user.mechanicId!);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.update(repairJobs).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(repairJobs.id, id));
  return NextResponse.json({ ok: true });
}
