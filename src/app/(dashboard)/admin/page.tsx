import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import AdminPanelClient from "./AdminPanelClient";

export default async function AdminPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <AdminPanelClient />;
}
