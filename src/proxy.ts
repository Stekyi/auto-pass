import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { verifyPortalToken } from "@/lib/auth/portal-session";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Customer portal routes — check portal JWT cookie
  if (pathname.startsWith("/portal") && !pathname.startsWith("/portal/login")) {
    const token = req.cookies.get("portal_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/portal/login", req.url));
    }
    const payload = await verifyPortalToken(token);
    if (!payload) {
      return NextResponse.redirect(new URL("/portal/login", req.url));
    }
    return NextResponse.next();
  }

  // Staff dashboard routes — check NextAuth session
  const staffPaths = ["/dashboard", "/customers", "/vehicles", "/repairs", "/schedule", "/reports", "/admin"];
  if (staffPaths.some((p) => pathname.startsWith(p))) {
    const session = await auth();
    if (!session) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Super-admin (no mechanicId) has no workshop data — send to admin panel
    const user = session.user as { mechanicId?: string | null; role?: string };
    const isSuperAdmin = !user.mechanicId && user.role === "ADMIN";
    if (isSuperAdmin && !pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customers/:path*",
    "/vehicles/:path*",
    "/repairs/:path*",
    "/schedule/:path*",
    "/reports/:path*",
    "/admin/:path*",
    "/portal/:path*",
  ],
};
