import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { getUploadUrl, jobFileKey, extFromMime, type JobFileType } from "@/lib/storage/r2";
import { z } from "zod";

const schema = z.object({
  jobId: z.string().uuid(),
  fileType: z.enum(["before", "after", "general", "receipt", "voice"]),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { jobId, fileType, fileName, mimeType } = parsed.data;
  const ext = extFromMime(mimeType);
  const safeBase = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = jobFileKey(jobId, fileType as JobFileType, `${Date.now()}_${safeBase}.${ext}`);
  const uploadUrl = await getUploadUrl(key, mimeType);

  return NextResponse.json({ uploadUrl, fileKey: key });
}
