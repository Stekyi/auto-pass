import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customerOtps } from "@/lib/db/schema";
import { sendSms } from "@/lib/notifications/sms";
import { z } from "zod";
import { addMinutes } from "date-fns";
import { getSetting, SETTING_KEYS } from "@/lib/utils/settings";

const schema = z.object({ tel: z.string().min(7).max(30) });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Valid phone number required" }, { status: 400 });

  const { tel } = parsed.data;
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiryMins = parseInt((await getSetting(SETTING_KEYS.PORTAL_OTP_EXPIRY_MINS)) ?? "5", 10);
  const expiresAt = addMinutes(new Date(), expiryMins);

  await db.insert(customerOtps).values({ tel, otp, expiresAt });

  const appName = (await getSetting(SETTING_KEYS.APP_NAME)) ?? "AutoPass";
  const message = `Your ${appName} login code is: ${otp}. Valid for ${expiryMins} minutes.`;

  await sendSms(tel, message).catch(() => {});

  return NextResponse.json({ ok: true, expiresInMins: expiryMins });
}
