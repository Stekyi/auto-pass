import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vehicles, repairJobs, mechanics, jobPhotos, partsUsed } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifyPortalToken } from "@/lib/auth/portal-session";
import { getDownloadUrl } from "@/lib/storage/r2";
import { cookies } from "next/headers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("portal_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const { id } = await params;
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const jobs = await db
    .select({
      job: repairJobs,
      shopName: mechanics.name,
      shopTel: mechanics.contactTel,
    })
    .from(repairJobs)
    .leftJoin(mechanics, eq(repairJobs.mechanicId, mechanics.id))
    .where(eq(repairJobs.vehicleId, id))
    .orderBy(desc(repairJobs.jobDate));

  const history = await Promise.all(
    jobs.map(async ({ job, shopName, shopTel }) => {
      const [photos, parts] = await Promise.all([
        db.select().from(jobPhotos).where(eq(jobPhotos.jobId, job.id)).orderBy(jobPhotos.sortOrder),
        db.select().from(partsUsed).where(eq(partsUsed.jobId, job.id)),
      ]);

      const photosWithUrls = await Promise.all(
        photos.map(async (p) => ({
          ...p,
          url: await getDownloadUrl(p.fileKey).catch(() => null),
        }))
      );

      return { ...job, shopName, shopTel, photos: photosWithUrls, parts };
    })
  );

  return NextResponse.json({ vehicle, history });
}
