import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { vehicles, repairJobs, mechanics, customers, jobPhotos, partsUsed } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getDownloadUrl } from "@/lib/storage/r2";

const updateSchema = z.object({
  plateNumber: z.string().max(30).optional(),
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z.number().int().optional(),
  engineSize: z.string().max(30).optional(),
  fuelType: z.string().max(30).optional(),
  color: z.string().max(50).optional(),
  currentMileageKm: z.number().int().optional(),
  notes: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Full cross-tenant repair history
  const jobs = await db
    .select({
      job: repairJobs,
      shopName: mechanics.name,
      customerName: customers.fullName,
    })
    .from(repairJobs)
    .leftJoin(mechanics, eq(repairJobs.mechanicId, mechanics.id))
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .where(eq(repairJobs.vehicleId, id))
    .orderBy(desc(repairJobs.jobDate));

  // Attach photos + parts for each job (with signed URLs)
  const jobsWithDetails = await Promise.all(
    jobs.map(async ({ job, shopName, customerName }) => {
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

      return { ...job, shopName, customerName, photos: photosWithUrls, parts };
    })
  );

  return NextResponse.json({ vehicle, history: jobsWithDetails });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db.update(vehicles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(vehicles.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ vehicle: updated });
}
