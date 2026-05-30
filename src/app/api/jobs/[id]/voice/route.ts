import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { repairJobs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getUploadUrl, deleteFile, jobFileKey } from "@/lib/storage/r2";

const schema = z.object({ mimeType: z.string().default("audio/webm") });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { mechanicId?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: jobId } = await params;
  const [job] = await db.select().from(repairJobs)
    .where(and(eq(repairJobs.id, jobId), eq(repairJobs.mechanicId, user.mechanicId)))
    .limit(1);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { mimeType } = schema.parse(body);
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp3") ? "mp3" : "webm";
  const key = jobFileKey(jobId, "voice", `voice_${Date.now()}.${ext}`);
  const uploadUrl = await getUploadUrl(key, mimeType);

  await db.update(repairJobs).set({ voiceNoteKey: key, updatedAt: new Date() }).where(eq(repairJobs.id, jobId));

  return NextResponse.json({ uploadUrl, voiceNoteKey: key });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { mechanicId?: string };
  if (!user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: jobId } = await params;
  const [job] = await db.select({ voiceNoteKey: repairJobs.voiceNoteKey }).from(repairJobs)
    .where(and(eq(repairJobs.id, jobId), eq(repairJobs.mechanicId, user.mechanicId)))
    .limit(1);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (job.voiceNoteKey) {
    await deleteFile(job.voiceNoteKey).catch(() => {});
    await db.update(repairJobs).set({ voiceNoteKey: null, updatedAt: new Date() }).where(eq(repairJobs.id, jobId));
  }

  return NextResponse.json({ ok: true });
}
