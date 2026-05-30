import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { asc } from "drizzle-orm";
import { getSetting, SETTING_KEYS } from "@/lib/utils/settings";
import { sendWelcomeEmail } from "./email";

export async function processAlerts(): Promise<void> {
  let emailEnabled: string | null;
  try {
    emailEnabled = await getSetting(SETTING_KEYS.EMAIL_ENABLED);
  } catch (err) {
    console.error("[processAlerts] getSetting failed:", err);
    throw err;
  }
  if (emailEnabled === "false") return;

  let pending: (typeof alerts.$inferSelect)[];
  try {
    pending = await db
      .select()
      .from(alerts)
      .where(eq(alerts.status, "pending"))
      .orderBy(asc(alerts.createdAt))
      .limit(20);
  } catch (err) {
    console.error("[processAlerts] DB query failed:", err);
    throw err;
  }

  if (pending.length === 0) return;

  await Promise.allSettled(pending.map(processOne));
}

async function processOne(alert: typeof alerts.$inferSelect): Promise<void> {
  if (alert.type === "welcome") await processWelcome(alert);
}

async function processWelcome(alert: typeof alerts.$inferSelect): Promise<void> {
  if (!alert.recipientEmail) {
    await db.update(alerts).set({ status: "skipped", processedAt: new Date() }).where(eq(alerts.id, alert.id));
    return;
  }
  const p = alert.payload as { name?: string; mechanic_name?: string };
  try {
    await sendWelcomeEmail({
      name: p.name ?? alert.recipientName ?? "",
      email: alert.recipientEmail,
      customerNumber: "",
    });
    await db.update(alerts).set({ status: "sent", processedAt: new Date() }).where(eq(alerts.id, alert.id));
  } catch (err) {
    await db.update(alerts).set({
      status: "failed",
      processedAt: new Date(),
      errorMessage: err instanceof Error ? err.message : String(err),
    }).where(eq(alerts.id, alert.id));
  }
}
