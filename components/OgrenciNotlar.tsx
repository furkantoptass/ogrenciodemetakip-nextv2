"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { DetayNote } from "@/lib/ogrenci-detay";
import { fmtIsoDay } from "@/lib/hesaplamalar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function OgrenciNotlar({ studentId, initial }: { studentId: number; initial: DetayNote[] }) {
  const [notes, setNotes] = useState(initial);
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/ogrenciler/notlar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, body: text }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.error || "Kaydedilemedi");
        return;
      }
      setNotes((prev) => [data.note, ...prev]);
      setBody("");
      setMsg("Kaydedildi");
    } catch {
      setMsg("Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  async function del(id: number) {
    if (!confirm("Bu not silinsin mi?")) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/ogrenciler/notlar?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.error || "Silinemedi");
        return;
      }
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      setMsg("Silinemedi");
    } finally {
      setBusy(false);
    }
  }

  const fieldId = `odt-note-body-${studentId}`;

  return (
    <section className="flex flex-col gap-4" aria-label="Notlar">
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId}>Yeni not</Label>
        <textarea
          id={fieldId}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Not yaz…"
          className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" disabled={busy} onClick={() => void add()}>
            {busy ? "…" : "Kaydet"}
          </Button>
          {msg && <span className="text-xs text-muted-foreground" role="status">{msg}</span>}
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Not yok</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-muted-foreground">{fmtIsoDay(n.createdAt)} · {n.authorName || "—"}</div>
                <div className="mt-0.5 text-sm break-words whitespace-pre-wrap">{n.body}</div>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="destructive"
                aria-label="Notu sil"
                title="Sil"
                onClick={() => void del(n.id)}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
