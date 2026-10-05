import { NextRequest, NextResponse } from "next/server";
import { requireWapiUser } from "@/lib/wapi-auth";
import { defaultIntegrationId, listTemplates, sendTemplate } from "@/lib/desk360";
import { listOtomatikAdaylar } from "@/lib/odeme-mesaj";
import { ODEME_MESAJLARI, desk360Parametreler, findDesk360Sablon, fmtGun, onizlemeDoldur } from "@/lib/odeme-mesaj-tanim";
import { getWapiAuto, setWapiAutoEnabled, touchWapiAutoRun, wapiAlreadySent, logWapiSend } from "@/lib/wapi-log";

export async function GET() {
  const gate = await requireWapiUser();
  if ("response" in gate) return gate.response;
  const auto = await getWapiAuto();
  return NextResponse.json({ ok: true, ...auto });
}

export async function POST(req: NextRequest) {
  const gate = await requireWapiUser();
  if ("response" in gate) return gate.response;

  let body: { enabled?: boolean; run?: boolean; integrationId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "İstek okunamadı" }, { status: 400 });
  }

  if (typeof body.enabled === "boolean" && !body.run) {
    await setWapiAutoEnabled(body.enabled);
    return NextResponse.json({ ok: true, enabled: body.enabled });
  }

  if (!body.run) {
    return NextResponse.json({ ok: false, error: "Ne yapılacağı belirsiz" }, { status: 400 });
  }

  const auto = await getWapiAuto();
  if (!auto.enabled) {
    return NextResponse.json({ ok: false, error: "Otomatik kapalı" }, { status: 400 });
  }

  const integrationId = Number(body.integrationId) || defaultIntegrationId();
  try {
    const templates = await listTemplates(integrationId);
    const adaylar = await listOtomatikAdaylar();
    let gitti = 0;
    let atlandi = 0;
    const hatalar: string[] = [];
    for (const a of adaylar) {
      const tanim = ODEME_MESAJLARI.find((m) => m.id === a.mesajId);
      if (!tanim) continue;
      const tpl = findDesk360Sablon(templates, tanim);
      if (!tpl?.sendable || !tpl.languageId) {
        hatalar.push(`${a.name}: şablon yok (${tanim.templateName})`);
        continue;
      }
      const names = [tpl.name, tanim.templateName, ...(tanim.aliases ?? [])];
      const needles = [a.vadeYmd, fmtGun(a.vadeYmd)].filter(Boolean);
      let tekrar = false;
      for (const n of names) {
        for (const needle of needles) {
          if (await wapiAlreadySent(n, a.phone, needle)) {
            tekrar = true;
            break;
          }
        }
        if (tekrar) break;
      }
      if (tekrar) {
        atlandi += 1;
        continue;
      }
      const preview = onizlemeDoldur(tanim.body, a.values);
      try {
        const sent = await sendTemplate({
          integrationId,
          templateId: tpl.id,
          languageId: tpl.languageId,
          phone: a.phone,
          parameters: desk360Parametreler(tpl.variables, a.values),
        });
        await logWapiSend({
          authorEmail: gate.email,
          integrationId,
          phone: a.phone,
          kind: "sablon",
          body: preview,
          templateName: tpl.name,
          ok: true,
          messageId: sent.messageId,
        });
        gitti += 1;
      } catch (e) {
        const err = e instanceof Error ? e.message : "Hata";
        hatalar.push(`${a.name}: ${err}`);
        await logWapiSend({
          authorEmail: gate.email,
          integrationId,
          phone: a.phone,
          kind: "sablon",
          body: preview,
          templateName: tpl.name,
          ok: false,
          errorText: err,
        });
      }
    }
    await touchWapiAutoRun();
    return NextResponse.json({ ok: true, gitti, atlandi, hatalar, aday: adaylar.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Çalışmadı" }, { status: 502 });
  }
}
