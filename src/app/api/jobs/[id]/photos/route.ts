import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { jobPhotos, repairJobs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { deleteFile } from "@/lib/storage/r2";

const addSchema = z.object({
  fileKey: z.string().min(1),
  fileName: z.string().max(255).optional(),
  photoType: z.enum(["before", "after", "general", "receipt"]).default("general"),
  sortOrder: z.number().int().default(0),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { mechanicId?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: jobId } = await params;
  const [job] = await db.select({ id: repairJobs.id }).from(repairJobs)
    .where(and(eq(repairJobs.id, jobId), eq(repairJobs.mechanicId, user.mechanicId)))
    .limit(1);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [photo] = await db.insert(jobPhotos).values({ jobId, ...parsed.data }).returning();
  return NextResponse.json({ photo }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { mechanicId?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: jobId } = await params;
  const photoId = new URL(req.url).searchParams.get("photoId");
  if (!photoId) return NextResponse.json({ error: "photoId required" }, { status: 400 });

  const [job] = await db.select({ id: repairJobs.id }).from(repairJobs)
    .where(and(eq(repairJobs.id, jobId), eq(repairJobs.mechanicId, user.mechanicId)))
    .limit(1);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const [photo] = await db.select().from(jobPhotos).where(eq(jobPhotos.id, photoId)).limit(1);
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  await Promise.all([
    db.delete(jobPhotos).where(eq(jobPhotos.id, photoId)),
    deleteFile(photo.fileKey).catch(() => {}),
  ]);

  return NextResponse.json({ ok: true });
}
