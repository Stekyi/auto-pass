import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyPortalToken } from "@/lib/auth/portal-session";

export default async function PortalRootPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("portal_token")?.value;
  if (token && await verifyPortalToken(token)) {
    redirect("/portal/vehicles");
  }
  redirect("/portal/login");
}
