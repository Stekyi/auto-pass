import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.PORTAL_JWT_SECRET ?? process.env.AUTH_SECRET ?? "fallback-secret-change-me"
);

const EXPIRY = "30d";

export async function signPortalToken(tel: string): Promise<string> {
  return new SignJWT({ tel })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret);
}

export async function verifyPortalToken(token: string): Promise<{ tel: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return { tel: payload.tel as string };
  } catch {
    return null;
  }
}
