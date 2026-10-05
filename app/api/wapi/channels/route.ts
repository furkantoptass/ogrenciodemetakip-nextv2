import { NextResponse } from "next/server";
import { requireWapiUser } from "@/lib/wapi-auth";
import { defaultIntegrationId, listChannels } from "@/lib/desk360";

export async function GET() {
  const gate = await requireWapiUser();
  if ("response" in gate) return gate.response;
  try {
    const channels = await listChannels();
    return NextResponse.json({ ok: true, channels, defaultId: defaultIntegrationId() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Hatlar alınamadı" }, { status: 502 });
  }
}
