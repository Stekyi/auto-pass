import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { maintenanceSchedule, vehicles, customers, mechanics } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { sendSms } from "@/lib/notifications/sms";
import { sendEmail } from "@/lib/notifications/email";
import { format } from "date-fns";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { mechanicId?: string | null; role?: string };
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.mechanicId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const [row] = await db
    .select({
      entry: maintenanceSchedule,
      vehiclePlate: vehicles.plateNumber,
      vehicleMake: vehicles.make,
      vehicleModel: vehicles.model,
      customerName: customers.fullName,
      customerTel: customers.tel,
      customerEmail: customers.email,
      shopName: mechanics.name,
    })
    .from(maintenanceSchedule)
    .leftJoin(vehicles, eq(maintenanceSchedule.vehicleId, vehicles.id))
    .leftJoin(customers, eq(vehicles.customerId, customers.id))
    .leftJoin(mechanics, eq(maintenanceSchedule.mechanicId, mechanics.id))
    .where(isAdmin ? eq(maintenanceSchedule.id, id) : and(eq(maintenanceSchedule.id, id), eq(maintenanceSchedule.mechanicId, user.mechanicId!)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { entry, vehiclePlate, vehicleMake, vehicleModel, customerName, customerTel, customerEmail, shopName } = row;
  const vehicle = [vehicleMake, vehicleModel, vehiclePlate].filter(Boolean).join(" ") || "Your vehicle";
  const dueDate = entry.dueDateEstimate ? format(new Date(entry.dueDateEstimate), "dd MMM yyyy") : null;
  const shop = shopName ?? "Your mechanic";

  const message = dueDate
    ? `Hi ${customerName ?? "Customer"}, your ${entry.partName} service for ${vehicle} is due by ${dueDate}. Please schedule with ${shop} at your earliest convenience.`
    : `Hi ${customerName ?? "Customer"}, your ${entry.partName} service for ${vehicle} is coming up. Please schedule with ${shop} soon.`;

  const errors: string[] = [];

  if (customerTel) {
    await sendSms(customerTel, message).catch((e: Error) => errors.push(`SMS: ${e.message}`));
  }

  if (customerEmail) {
    await sendEmail({
      to: customerEmail,
      subject: `Service Due: ${entry.partName} for ${vehicle}`,
      html: `<p>${message}</p>`,
      text: message,
    }).catch((e: Error) => errors.push(`Email: ${e.message}`));
  }

  await db.update(maintenanceSchedule).set({ alertSent: true }).where(eq(maintenanceSchedule.id, id));

  return NextResponse.json({ ok: true, errors: errors.length ? errors : undefined });
}
