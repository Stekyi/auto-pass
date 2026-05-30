import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customerOtps } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { signPortalToken } from "@/lib/auth/portal-session";

const schema = z.object({
  tel: z.string().min(7).max(30),
  otp: z.string().length(6),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { tel, otp } = parsed.data;
  const now = new Date();

  const [record] = await db
    .select()
    .from(customerOtps)
    .where(
      and(
        eq(customerOtps.tel, tel),
        eq(customerOtps.otp, otp),
        isNull(customerOtps.usedAt)
      )
    )
    .orderBy(customerOtps.createdAt)
    .limit(1);

  if (!record || record.expiresAt < now) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  await db.update(customerOtps).set({ usedAt: now }).where(eq(customerOtps.id, record.id));

  const token = await signPortalToken(tel);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("portal_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
