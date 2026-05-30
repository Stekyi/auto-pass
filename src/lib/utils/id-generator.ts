import { db } from "@/lib/db";
import { idCounters } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

type CounterName = "customer" | "vehicle" | "job";

async function nextId(mechanicId: string, name: CounterName): Promise<number> {
  const [row] = await db
    .insert(idCounters)
    .values({ mechanicId, name, lastValue: 1 })
    .onConflictDoUpdate({
      target: [idCounters.mechanicId, idCounters.name],
      set: { lastValue: sql`${idCounters.lastValue} + 1` },
    })
    .returning({ lastValue: idCounters.lastValue });
  return row.lastValue;
}

const year = () => new Date().getFullYear();

export async function nextCustomerNumber(mechanicId: string, mechanicCode: string): Promise<string> {
  const n = await nextId(mechanicId, "customer");
  return `${mechanicCode}-${year()}-${String(n).padStart(5, "0")}`;
}

export async function nextVehicleNumber(mechanicId: string, mechanicCode: string): Promise<string> {
  const n = await nextId(mechanicId, "vehicle");
  return `${mechanicCode}-V-${String(n).padStart(5, "0")}`;
}

export async function nextJobNumber(mechanicId: string, mechanicCode: string): Promise<string> {
  const n = await nextId(mechanicId, "job");
  return `${mechanicCode}-J-${String(n).padStart(5, "0")}`;
}
