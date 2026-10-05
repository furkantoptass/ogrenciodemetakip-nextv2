"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Loader2, Save, Search, SearchX, ShieldCheck, UserCheck, UserPlus, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import KaynakSaatSerit from "@/components/KaynakSaatSerit";
import { PageHeader, PageShell } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Mod = { id: string; label: string };
type User = {
  id: number;
  email: string;
  name: string;
  active: boolean;
  isSuper: boolean;
  modules: string[];
};
// Kaydedilmemiş satır düzenlemesi; Kaydet'e basılana kadar yalnızca ekranda durur.
type Taslak = { modules: string[]; isSuper: boolean };

const TH_CLS = "h-9 bg-muted px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase";

function toggleArr(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function ayniListe(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

function Stat({ title, value, hint, icon: Icon }: { title: string; value: number; hint: string; icon: typeof Users }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardAction>
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString("tr-TR")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default function SuperPanel() {
  const [meId, setMeId] = useState(0);
  const [mods, setMods] = useState<Mod[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [taslak, setTaslak] = useState<Record<number, Taslak>>({});
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newMods, setNewMods] = useState<string[]>([]);
  const [newSuper, setNewSuper] = useState(false);
  const [addMsg, setAddMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const res = await fetch("/api/super");
      const data = await res.json();
      if (!data.ok) {
        setErr(data.error || "Liste alınamadı");
        return;
      }
      setMeId(Number(data.meId) || 0);
      setMods(data.modules ?? []);
      setUsers(data.users ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Liste alınamadı");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return users;
    return users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(t));
  }, [users, q]);

  const aktif = users.filter((u) => u.active).length;
  const superSayi = users.filter((u) => u.isSuper).length;

  function gorunen(u: User): User {
    const t = taslak[u.id];
    return t ? { ...u, ...t } : u;
  }

  function degisti(u: User): boolean {
    const t = taslak[u.id];
    return !!t && (t.isSuper !== u.isSuper || !ayniListe(t.modules, u.modules));
  }

  function duzenle(u: User, patch: Partial<Taslak>) {
    setTaslak((prev) => {
      const simdi = prev[u.id] ?? { modules: u.modules, isSuper: u.isSuper };
      return { ...prev, [u.id]: { ...simdi, ...patch } };
    });
  }

  function taslakSil(id: number) {
    setTaslak((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function addUser(e: FormEvent) {
    e.preventDefault();
    setAddMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/super", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          email: newEmail,
          name: newName,
          modules: newMods,
          isSuper: newSuper,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Eklenemedi");
      setNewEmail("");
      setNewName("");
      setNewMods([]);
      setNewSuper(false);
      setShowAdd(false);
      toast.success("Hesap eklendi. Kişi Google ile girince bu kayıt kullanılır.");
      await load();
    } catch (e) {
      setAddMsg(e instanceof Error ? e.message : "Eklenemedi");
    } finally {
      setBusy(false);
    }
  }

  async function saveUser(u: User, patch: Partial<User>) {
    const next = { ...gorunen(u), ...patch };
    const mine = u.id === meId;
    setBusy(true);
    setBusyId(u.id);
    try {
      const res = await fetch("/api/super", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          userId: u.id,
          modules: next.modules,
          isSuper: mine ? true : next.isSuper,
          active: mine ? true : next.active,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Kaydedilemedi");
      taslakSil(u.id);
      toast.success(`${u.name || u.email} için yetkiler kaydedildi.`);
      await load();
    } catch (e) {
      toast.error(`${e instanceof Error ? e.message : "Kaydedilemedi"} — değişiklik uygulanmadı, tekrar deneyin.`);
    } finally {
      setBusy(false);
      setBusyId(0);
    }
  }

  const sutun = mods.length + 4;

  return (
    <PageShell>
      <PageHeader
        title="Yetkiler"
        description="Kimin hangi sayfaları açabileceğini belirleyin. Giriş Google hesabıyla yapılır, şifre yoktur."
      >
        <Button
          onClick={() => {
            setAddMsg("");
            setShowAdd(true);
          }}
        >
          <UserPlus aria-hidden="true" />
          Hesap ekle
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat title="Toplam hesap" value={users.length} hint="Sistemde kayıtlı kişi" icon={Users} />
        <Stat title="Aktif" value={aktif} hint="Giriş yapabilir" icon={UserCheck} />
        <Stat title="Kapalı" value={users.length - aktif} hint="Girişi durdurulmuş" icon={UserX} />
        <Stat title="Super" value={superSayi} hint="Yetkileri yönetebilir" icon={ShieldCheck} />
      </div>

      {err ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Hesap listesi alınamadı</AlertTitle>
          <AlertDescription>{err} — sayfayı yenileyip tekrar deneyin.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Hesaplar</h2>
          </CardTitle>
          <CardDescription>
            Kutuları işaretleyip satırdaki Kaydet ile uygulayın. Kendi Super ve aktiflik durumunuzu değiştiremezsiniz.
          </CardDescription>
          <CardAction>
            <Badge variant="secondary" className="tabular-nums">
              {users.length} kişi
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ad veya e-posta ara…"
              aria-label="Ad veya e-posta ile hesap ara"
              className="pl-8"
            />
          </div>

          <div
            className="max-h-[calc(100dvh-14rem)] min-w-0 overflow-auto rounded-lg border [contain:inline-size] [&_[data-slot=table-container]]:overflow-visible"
            role="region"
            aria-label="Hesaplar ve sayfa yetkileri"
            tabIndex={0}
          >
            <Table className="min-w-[980px]">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className={cn(TH_CLS, "min-w-56")}>
                    Kişi
                  </TableHead>
                  <TableHead scope="col" className={TH_CLS}>
                    Durum
                  </TableHead>
                  {mods.map((m) => (
                    <TableHead key={m.id} scope="col" className={cn(TH_CLS, "text-center")}>
                      {m.label}
                    </TableHead>
                  ))}
                  <TableHead scope="col" className={cn(TH_CLS, "border-l text-center")}>
                    Super
                  </TableHead>
                  <TableHead scope="col" className={cn(TH_CLS, "text-right")}>
                    <span className="sr-only">İşlem</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loaded
                  ? Array.from({ length: 4 }, (_, i) => (
                      <TableRow key={`bos-${i}`} className="hover:bg-transparent">
                        <TableCell colSpan={sutun} className="px-3">
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
                {loaded && shown.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={sutun} className="whitespace-normal">
                      <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
                        <p className="font-medium">{users.length ? "Aramaya uyan kişi yok" : "Henüz hesap yok"}</p>
                        <p className="text-sm text-muted-foreground">
                          {users.length
                            ? "Ad veya e-postayı farklı yazıp tekrar deneyin."
                            : "Sağ üstteki Hesap ekle ile ilk hesabı oluşturun."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
                {shown.map((u) => {
                  const mine = u.id === meId;
                  const g = gorunen(u);
                  const kirli = degisti(u);
                  const ad = u.name || u.email;
                  return (
                    <TableRow key={u.id} className={cn(kirli && "bg-amber-500/10 hover:bg-amber-500/15")}>
                      <TableCell className="px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{ad}</span>
                          {mine ? <Badge variant="outline">Sen</Badge> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                        {!g.isSuper && g.modules.length === 0 ? (
                          <div className="text-xs text-muted-foreground">Açık sayfa yok</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="px-3">
                        <div className="flex items-center gap-1.5">
                          {u.active ? (
                            <Badge variant="outline" className="border-emerald-500/50 text-emerald-700 dark:text-emerald-400">
                              Aktif
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Kapalı</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="xs"
                            disabled={mine || busy}
                            onClick={() => void saveUser(u, { active: !u.active })}
                            aria-label={u.active ? `${ad} hesabını kapat` : `${ad} hesabını aç`}
                            title={mine ? "Kendi hesabınızı kapatamazsınız" : undefined}
                          >
                            {u.active ? "Kapat" : "Aç"}
                          </Button>
                        </div>
                      </TableCell>
                      {mods.map((m) => (
                        <TableCell key={m.id} className="px-3 text-center">
                          <Checkbox
                            className="mx-auto"
                            checked={g.modules.includes(m.id)}
                            onCheckedChange={() => duzenle(u, { modules: toggleArr(g.modules, m.id) })}
                            aria-label={`${ad}: ${m.label}`}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="border-l px-3 text-center">
                        <Checkbox
                          className="mx-auto"
                          checked={g.isSuper}
                          disabled={mine}
                          onCheckedChange={() => duzenle(u, { isSuper: !g.isSuper })}
                          aria-label={`${ad}: Super`}
                          title={mine ? "Kendi Super yetkinizi kaldıramazsınız" : undefined}
                        />
                      </TableCell>
                      <TableCell className="px-3 text-right">
                        <Button
                          size="sm"
                          variant={kirli ? "default" : "outline"}
                          disabled={busy}
                          onClick={() => void saveUser(u, {})}
                          aria-label={`${ad} için yetkileri kaydet`}
                        >
                          {busyId === u.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                          {busyId === u.id ? "Kaydediliyor…" : "Kaydet"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">Sarı satırlar kaydedilmemiş değişiklik içerir.</p>
        </CardContent>
      </Card>

      <KaynakSaatSerit />

      <Dialog open={showAdd} onOpenChange={(open) => setShowAdd(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Hesap ekle</DialogTitle>
            <DialogDescription>E-posta yaz. Kişi Google ile girince bu kayıt kullanılır. Şifre yok.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void addUser(e)} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="super-yeni-eposta">E-posta</Label>
                <Input
                  id="super-yeni-eposta"
                  type="email"
                  required
                  autoComplete="off"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="ad.soyad@northfly.aero"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="super-yeni-ad">Ad (isteğe bağlı)</Label>
                <Input
                  id="super-yeni-ad"
                  type="text"
                  autoComplete="off"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
            </div>

            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">Sayfalar</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {mods.map((m) => (
                  <Label key={m.id} className="cursor-pointer rounded-lg border px-2.5 py-2 font-normal">
                    <Checkbox checked={newMods.includes(m.id)} onCheckedChange={() => setNewMods(toggleArr(newMods, m.id))} />
                    {m.label}
                  </Label>
                ))}
              </div>
            </fieldset>

            <Label className="cursor-pointer items-start rounded-lg border px-2.5 py-2 font-normal">
              <Checkbox checked={newSuper} onCheckedChange={() => setNewSuper((v) => !v)} />
              <span className="grid gap-1">
                <span className="font-medium">Super</span>
                <span className="text-xs leading-snug text-muted-foreground">Yetkiler ekranını açabilir, hesap ekleyip düzenleyebilir.</span>
              </span>
            </Label>

            {addMsg ? (
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>Hesap eklenemedi</AlertTitle>
                <AlertDescription>{addMsg}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
                {busy ? "Ekleniyor…" : "Hesap ekle"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
