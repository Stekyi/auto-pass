import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { maintenanceSchedule, alerts, vehicles, customers } from "@/lib/db/schema";
import { eq, and, lte, eq as eqAlias } from "drizzle-orm";
import { addDays } from "date-fns";
import { getNotifyDays } from "@/lib/utils/settings";
import { sendSms } from "@/lib/notifications/sms";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const notifyDays = await getNotifyDays();
  const maxDays = Math.max(...notifyDays);
  const cutoff = addDays(new Date(), maxDays).toISOString().split("T")[0];

  const dueItems = await db
    .select({
      entry: maintenanceSchedule,
      vehiclePlate: vehicles.plateNumber,
      vehicleMake: vehicles.make,
      vehicleModel: vehicles.model,
      customerName: customers.fullName,
      customerTel: customers.tel,
      customerEmail: customers.email,
    })
    .from(maintenanceSchedule)
    .leftJoin(vehicles, eq(maintenanceSchedule.vehicleId, vehicles.id))
    .leftJoin(customers, eq(vehicles.customerId, customers.id))
    .where(
      and(
        eq(maintenanceSchedule.isCompleted, false),
        eq(maintenanceSchedule.alertSent, false),
        lte(maintenanceSchedule.dueDateEstimate, cutoff)
      )
    );

  const today = new Date();
  let sent = 0;

  for (const row of dueItems) {
    const { entry, vehiclePlate, vehicleMake, vehicleModel, customerName, customerTel, customerEmail } = row;
    if (!entry.dueDateEstimate) continue;

    const dueDate = new Date(entry.dueDateEstimate);
    const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (!notifyDays.some((d) => Math.abs(daysRemaining - d) <= 1)) continue;

    const vehicle = [vehicleMake, vehicleModel, vehiclePlate].filter(Boolean).join(" ") || "Your vehicle";
    const message = `Service due in ${daysRemaining} days: ${entry.partName} for ${vehicle}. Please schedule maintenance soon.`;

    await db.insert(alerts).values({
      mechanicId: entry.mechanicId,
      type: "service_due",
      status: "pending",
      recipientEmail: customerEmail ?? undefined,
      recipientName: customerName ?? undefined,
      recipientTel: customerTel ?? undefined,
      payload: { scheduleId: entry.id, partName: entry.partName, daysRemaining, vehicle },
    });

    if (customerTel) {
      await sendSms(customerTel, message).catch(() => {});
    }

    await db.update(maintenanceSchedule).set({ alertSent: true }).where(eqAlias(maintenanceSchedule.id, entry.id));
    sent++;
  }

  return NextResponse.json({ ok: true, sent, total: dueItems.length });
}
