import { NextRequest, NextResponse } from "next/server";
import { requireWapiUser } from "@/lib/wapi-auth";
import { sendTemplate, sendText } from "@/lib/desk360";
import { logWapiSend } from "@/lib/wapi-log";
import { toWhatsAppPhone } from "@/lib/wapi-phone";

export async function POST(req: NextRequest) {
  const gate = await requireWapiUser();
  if ("response" in gate) return gate.response;

  let body: {
    integrationId?: number;
    phone?: string;
    text?: string;
    templateId?: number;
    languageId?: number;
    templateName?: string;
    parameters?: Record<string, string>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "İstek okunamadı" }, { status: 400 });
  }

  const integrationId = Number(body.integrationId);
  const phone = toWhatsAppPhone(String(body.phone ?? ""));
  if (!integrationId) return NextResponse.json({ ok: false, error: "Hat seçilmedi" }, { status: 400 });
  if (!phone) return NextResponse.json({ ok: false, error: "Telefon numarası geçersiz" }, { status: 400 });

  const templateId = Number(body.templateId ?? 0);
  const text = String(body.text ?? "").trim();

  try {
    if (templateId > 0) {
      const languageId = Number(body.languageId ?? 0);
      if (!languageId) return NextResponse.json({ ok: false, error: "Şablon dili yok" }, { status: 400 });
      const sent = await sendTemplate({
        integrationId,
        templateId,
        languageId,
        phone,
        parameters: body.parameters ?? {},
      });
      await logWapiSend({
        authorEmail: gate.email,
        integrationId,
        phone,
        kind: "sablon",
        body: text,
        templateName: String(body.templateName ?? ""),
        ok: true,
        messageId: sent.messageId,
      });
      return NextResponse.json({ ok: true, messageId: sent.messageId, phone });
    }

    if (!text) return NextResponse.json({ ok: false, error: "Mesaj boş" }, { status: 400 });
    const sent = await sendText(integrationId, phone, text);
    await logWapiSend({
      authorEmail: gate.email,
      integrationId,
      phone,
      kind: "yazi",
      body: text,
      ok: true,
      messageId: sent.messageId,
    });
    return NextResponse.json({ ok: true, messageId: sent.messageId, phone });
  } catch (e) {
    const err = e instanceof Error ? e.message : "Gönderilemedi";
    await logWapiSend({
      authorEmail: gate.email,
      integrationId,
      phone,
      kind: templateId > 0 ? "sablon" : "yazi",
      body: text,
      templateName: String(body.templateName ?? ""),
      ok: false,
      errorText: err,
    });
    return NextResponse.json({ ok: false, error: err }, { status: 502 });
  }
}
