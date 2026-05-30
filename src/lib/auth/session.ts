import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { staffUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const [user] = await db
          .select()
          .from(staffUsers)
          .where(eq(staffUsers.email, credentials.email as string))
          .limit(1);

        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        // Fetch tenant code for ID generation
        let tenantCode: string | null = null;
        if (user.mechanicId) {
          const { mechanics } = await import("@/lib/db/schema");
          const { eq } = await import("drizzle-orm");
          const [t] = await db.select({ code: mechanics.code }).from(mechanics).where(eq(mechanics.id, user.mechanicId)).limit(1);
          tenantCode = t?.code ?? null;
        }
        return { id: user.id, name: user.name, email: user.email, role: user.role, mechanicId: user.mechanicId ?? null, tenantCode };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.mechanicId = (user as { mechanicId?: string | null }).mechanicId ?? null;
        token.tenantCode = (user as { tenantCode?: string | null }).tenantCode ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      (session.user as { role?: string }).role = token.role as string;
      (session.user as { mechanicId?: string | null }).mechanicId = token.mechanicId as string | null;
      (session.user as { tenantCode?: string | null }).tenantCode = token.tenantCode as string | null;
      return session;
    },
  },
});
