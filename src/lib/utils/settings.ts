import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const cache = new Map<string, { value: string; expiresAt: number }>();
const TTL_MS = 60_000; // 1 minute cache

export async function getSetting(key: string): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);

  if (!row) return null;
  cache.set(key, { value: row.value, expiresAt: now + TTL_MS });
  return row.value;
}

export async function getSettings(
  keys: string[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  await Promise.all(
    keys.map(async (k) => {
      const v = await getSetting(k);
      if (v !== null) result[k] = v;
    })
  );
  return result;
}

export function invalidateSetting(key: string) {
  cache.delete(key);
}

// Typed accessors
export const SETTING_KEYS = {
  // ── Pricing ────────────────────────────────────────────────────────────────
  // All prices in Ghana Cedis (GHC). Defaults applied in getPrices().
  PRICE_VEHICLE_REGISTRATION: "price_vehicle_registration", // per vehicle added
  PRICE_SUBSCRIPTION_GHS: "price_subscription_ghs",         // annual mechanic subscription
  // ── Notifications ──────────────────────────────────────────────────────────
  SMS_PROVIDER: "sms_provider",
  SMS_API_KEY: "sms_api_key",
  SMS_SENDER_ID: "sms_sender_id",
  SMS_ENABLED: "sms_enabled",
  EMAIL_FROM_NAME: "email_from_name",
  EMAIL_FROM_ADDRESS: "email_from_address",
  EMAIL_APP_PASSWORD: "email_app_password",
  EMAIL_SMTP_HOST: "email_smtp_host",
  EMAIL_SMTP_PORT: "email_smtp_port",
  EMAIL_SMTP_USERNAME: "email_smtp_username",
  EMAIL_ENABLED: "email_enabled",
  NOTIFY_DAYS_BEFORE: "notify_days_before",
  // ── App ────────────────────────────────────────────────────────────────────
  APP_NAME: "app_name",
  PORTAL_OTP_EXPIRY_MINS: "portal_otp_expiry_mins",
  // ── AI Assistant ───────────────────────────────────────────────────────────
  AI_ENABLED: "ai_enabled",
  AI_PROVIDER: "ai_provider",
  AI_API_KEY: "ai_api_key",
  AI_MODEL: "ai_model",
} as const;

export async function getPrices(): Promise<{ vehicleRegistration: number; subscription: number }> {
  const s = await getSettings([
    SETTING_KEYS.PRICE_VEHICLE_REGISTRATION,
    SETTING_KEYS.PRICE_SUBSCRIPTION_GHS,
  ]);
  return {
    vehicleRegistration: parseFloat(s[SETTING_KEYS.PRICE_VEHICLE_REGISTRATION] ?? "50"),
    subscription: parseFloat(s[SETTING_KEYS.PRICE_SUBSCRIPTION_GHS] ?? "100"),
  };
}

export async function getNotifyDays(): Promise<number[]> {
  const v = await getSetting(SETTING_KEYS.NOTIFY_DAYS_BEFORE);
  return (v ?? "5,1")
    .split(",")
    .map((d) => parseInt(d.trim(), 10))
    .filter((n) => !isNaN(n));
}
