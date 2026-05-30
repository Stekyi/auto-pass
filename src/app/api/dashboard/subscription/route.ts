import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { getDaysUntilExpiry } from "@/lib/auth/subscription-guard";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { mechanicId?: string };
  if (!user.mechanicId) return NextResponse.json({ daysLeft: null });

  const daysLeft = await getDaysUntilExpiry(user.mechanicId);
  return NextResponse.json({ daysLeft });
}
