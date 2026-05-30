import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";

interface NHTSAResult {
  Variable: string;
  Value: string | null;
}

const vinCache = new Map<string, { data: VinData; expiresAt: number }>();

interface VinData {
  make: string | null;
  model: string | null;
  year: string | null;
  engineSize: string | null;
  fuelType: string | null;
  error: string | null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ vin: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vin } = await params;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
    return NextResponse.json({ error: "Invalid VIN format" }, { status: 400 });
  }

  const upperVin = vin.toUpperCase();
  const cached = vinCache.get(upperVin);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const res = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${upperVin}?format=json`,
    { next: { revalidate: 86400 } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "VIN lookup failed" }, { status: 502 });
  }

  const json = await res.json() as { Results: NHTSAResult[] };
  const find = (label: string) =>
    json.Results.find((r) => r.Variable === label)?.Value || null;

  const errorCode = find("Error Code");
  const data: VinData = {
    make: find("Make"),
    model: find("Model"),
    year: find("Model Year"),
    engineSize: find("Displacement (L)") ? `${find("Displacement (L)")}L` : find("Engine Model"),
    fuelType: find("Fuel Type - Primary"),
    error: errorCode && errorCode !== "0" ? find("Error Text") : null,
  };

  vinCache.set(upperVin, { data, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
  return NextResponse.json(data);
}
