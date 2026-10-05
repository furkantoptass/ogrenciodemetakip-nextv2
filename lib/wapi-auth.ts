import { NextResponse } from "next/server";
import { requireApiModule } from "@/lib/odt-yetki";

export async function requireWapiUser(): Promise<{ email: string } | { response: NextResponse }> {
  const gate = await requireApiModule("wapi");
  if ("response" in gate) return gate;
  return { email: gate.email };
}
