import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";

export async function checkActiveSubscription(mechanicId: string): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0];
  const [row] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.mechanicId, mechanicId),
        eq(subscriptions.status, "ACTIVE"),
        gte(subscriptions.endDate, today)
      )
    )
    .limit(1);
  return !!row;
}

export async function getDaysUntilExpiry(mechanicId: string): Promise<number | null> {
  const today = new Date();
  const [row] = await db
    .select({ endDate: subscriptions.endDate })
    .from(subscriptions)
    .where(and(eq(subscriptions.mechanicId, mechanicId), eq(subscriptions.status, "ACTIVE")))
    .limit(1);
  if (!row) return null;
  const end = new Date(row.endDate);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
