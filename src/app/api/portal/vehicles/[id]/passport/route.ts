import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vehicles, repairJobs, mechanics, partsUsed } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifyPortalToken } from "@/lib/auth/portal-session";
import { cookies } from "next/headers";
import { format } from "date-fns";

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
    .select({ job: repairJobs, shopName: mechanics.name })
    .from(repairJobs)
    .leftJoin(mechanics, eq(repairJobs.mechanicId, mechanics.id))
    .where(eq(repairJobs.vehicleId, id))
    .orderBy(desc(repairJobs.jobDate));

  const jobsWithParts = await Promise.all(
    jobs.map(async ({ job, shopName }) => ({
      ...job,
      shopName,
      parts: await db.select().from(partsUsed).where(eq(partsUsed.jobId, job.id)),
    }))
  );

  // Build HTML for PDF — returned as HTML for browser printing
  // Use a printable HTML page instead of jsPDF to avoid Vercel memory limits
  const vehicleName = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ") || "Vehicle";
  const plateDisplay = vehicle.plateNumber ?? vehicle.vehicleNumber;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Vehicle Passport — ${plateDisplay}</title>
<style>
  body { font-family: Arial, sans-serif; color: #111; max-width: 700px; margin: 40px auto; padding: 0 20px; }
  .header { background: #1d4ed8; color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
  .header h1 { margin: 0; font-size: 28px; }
  .header p { margin: 4px 0 0; opacity: 0.8; }
  .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 8px; }
  .specs { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 24px; }
  .spec { background: #f1f5f9; padding: 12px; border-radius: 8px; }
  .spec label { font-size: 11px; color: #64748b; display: block; }
  .spec value { font-weight: bold; font-size: 14px; }
  .job { border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
  .job-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .job-date { font-weight: bold; font-size: 16px; }
  .job-shop { color: #1d4ed8; font-size: 13px; }
  .job-desc { color: #374151; font-size: 14px; margin: 8px 0; }
  .parts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .part { background: #eff6ff; color: #1e40af; padding: 3px 10px; border-radius: 20px; font-size: 12px; }
  .cost { color: #15803d; font-weight: bold; font-size: 16px; }
  .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<div class="header">
  <h1>${plateDisplay}</h1>
  <p>${vehicleName}</p>
  <div class="badge">AutoPass Vehicle Passport</div>
</div>

<div class="specs">
  ${vehicle.vin ? `<div class="spec"><label>VIN</label><value style="font-size:11px;font-family:monospace">${vehicle.vin}</value></div>` : ""}
  ${vehicle.engineSize ? `<div class="spec"><label>Engine</label><value>${vehicle.engineSize}</value></div>` : ""}
  ${vehicle.fuelType ? `<div class="spec"><label>Fuel</label><value>${vehicle.fuelType}</value></div>` : ""}
  ${vehicle.color ? `<div class="spec"><label>Color</label><value>${vehicle.color}</value></div>` : ""}
  ${vehicle.currentMileageKm ? `<div class="spec"><label>Last Mileage</label><value>${vehicle.currentMileageKm.toLocaleString()} km</value></div>` : ""}
  <div class="spec"><label>Total Records</label><value>${jobs.length}</value></div>
</div>

<h2 style="margin-bottom:12px">Service History</h2>
${jobsWithParts.map((job) => `
<div class="job">
  <div class="job-header">
    <div>
      <div class="job-date">${format(new Date(job.jobDate), "d MMMM yyyy")}</div>
      ${job.shopName ? `<div class="job-shop">${job.shopName}</div>` : ""}
      ${job.mileageAtJob ? `<div style="font-size:12px;color:#64748b">${job.mileageAtJob.toLocaleString()} km</div>` : ""}
    </div>
    ${job.totalCostGhs ? `<div class="cost">₵${job.totalCostGhs}</div>` : ""}
  </div>
  ${job.description ? `<div class="job-desc">${job.description}</div>` : ""}
  ${job.parts.length > 0 ? `<div class="parts">${job.parts.map((p) => `<span class="part">${p.partName} × ${p.quantity}</span>`).join("")}</div>` : ""}
</div>`).join("")}

<div class="footer">
  Generated by AutoPass on ${format(new Date(), "d MMMM yyyy")} · This document is a verified digital service record.
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `inline; filename="passport-${plateDisplay}.html"`,
    },
  });
}
