# Northfly Öğrenci Ödeme Takip

Next.js 16 App Router, React 19 ve **Supabase (PostgreSQL + Auth)** ile öğrenci ödeme/eğitim takibi. Supabase üzerinden Google ile giriş, modül bazlı yetkiler, Desk360 WhatsApp, WordPress formları/SEO ve Verimor arama kayıtları içerir.

## Yerel çalıştırma

Node.js 22 kullanın.

```bash
npm ci
cp .env.example .env.local
```

`.env.local` içinde şunları doldurun (ayrıntılar `.env.example`'da):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase → Project Settings → API.
- `SUPABASE_SECRET_KEY`: Supabase → Project Settings → API Keys → Secret keys (`sb_secret_...`). Yalnızca sunucuda kullanılır; veritabanı şifresi ya da bağlantı adresi gerekmez.
- `ODT_SUPER_EMAIL`: ilk süper yönetici; `ODT_ALLOWED_EMAIL_DOMAINS` / `ODT_ALLOWED_EMAILS`: giriş yapabilecek hesaplar.
- `CRON_SECRET`: `openssl rand -base64 32` ile üretin.

```bash
npm run dev
```

Adres: http://localhost:3000. Branch akışı: geliştirme `development` branch'inde yapılır.

## Supabase kurulumu

**Şema.** `supabase/migrations/` altındaki SQL, MySQL dump'ının PostgreSQL karşılığıdır (RLS tüm tablolarda açık, politika yok; tarayıcıdaki anon anahtar hiçbir veriye erişemez). Supabase CLI ile (`supabase link` + `supabase db push`) ya da Dashboard → SQL Editor'den uygulayın. Geliştirme için uydurma örnek veri: `supabase/seed.sql`.

**Google ile giriş.** Giriş Supabase Auth ile yapılır; `GOOGLE_CLIENT_ID/SECRET` bu uygulamada kullanılmaz.

1. Google Cloud Console → OAuth istemcisi (Web). Yetkili yönlendirme URI'si: `https://<PROJE-REF>.supabase.co/auth/v1/callback`.
2. Supabase → Authentication → Providers → **Google**: istemci kimliği ve sırrı girin, etkinleştirin.
3. Supabase → Authentication → URL Configuration: **Site URL** üretim adresiniz; **Redirect URLs** listesine `http://localhost:3000/auth/callback` ve `https://SITE-ADRESI/auth/callback` ekleyin.

Giriş sonrası `/auth/callback`, e-postanın izinli alan adı/listesinde ve `northfly_odt_users` tablosunda aktif olduğunu denetler; değilse oturumu kapatıp `/login?error=AccessDenied` gösterir. `lib/odt-yetki.ts`, ilk kullanımda `ODT_SUPER_EMAIL` yöneticisini oluşturur. Diğer kullanıcılar ve modül yetkileri Super ekranından tanımlanır.

**Sorgu katmanı.** Uygulama veritabanına doğrudan bağlanmaz (Prisma/bağlantı dizesi yok). Her sorgu `supabase/migrations/*_rpc_*.sql` içinde sabit bir Postgres fonksiyonudur (`odt_*`) ve `lib/db.ts` içindeki `rows()` / `run()` ile Supabase API'si üzerinden çağrılır. Fonksiyonları yalnızca `service_role` çalıştırabilir (anon ve authenticated için yetki kaldırılmıştır) ve hiçbiri dışarıdan SQL metni kabul etmez. Yeni bir sorgu gerektiğinde: migration'a `RETURNS jsonb` bir fonksiyon ekleyin, yetkisini aynı şekilde kısıtlayın ve koddan `rows("odt_...", { p_... })` ile çağırın. API zaman aşımı 8 saniyedir; `UPDATE`/`DELETE` ifadeleri `WHERE` içermelidir.

## Naeron verisinin eşitlenmesi

Öğrenci, sözleşme, taksit, ödeme, eğitim, uçuş ve uçak (filo) verisi [Naeron REST BI v2](https://naeron.com/docs/restBI/) API'sinden `naeron_bi_*` tablolarına çekilir (`lib/naeron.ts`). `.env.local` içinde `NAERON_API_KEY` tanımlı olmalıdır.

- **Uygulama içinden:** süper yönetici oturumuyla `POST /api/naeron/sync`.
- **Komut satırı / zamanlanmış görev:** `GET /api/naeron/sync`, başlık `Authorization: Bearer <CRON_SECRET>`.
- `?full=1` tüm tabloları baştan çeker; parametresiz çağrı yalnızca son başarılı eşitlemeden beri değişen kayıtları alır (`/changes`). `?tables=students,flights` ile tablo seçilebilir; `?state=1` son eşitleme durumunu döndürür.

```bash
node --env-file=.env.local -e "fetch('http://localhost:3000/api/naeron/sync',{headers:{authorization:'Bearer '+process.env.CRON_SECRET}}).then(r=>r.json()).then(j=>console.log(JSON.stringify(j,null,1)))"
```

Satırlar `m_ID` üzerinden upsert edilir; Naeron'da silinen uçuşlar artımlı eşitlemede `/deleted` ile kaldırılır. Diğer tablolarda Naeron'dan tamamen kaldırılan kayıtlar yerelde kalır (Naeron bunları genellikle `_lastRowStatus = 'destroy'` ile işaretler ve uygulama bunları zaten göstermez).

Kurumsal etiket ID'leri Naeron hesabına özeldir. Listelerdeki varsayılan etiket filtresi `NEXT_PUBLIC_ODT_DEFAULT_CORP_LABEL_IDS` ile ayarlanır (boş bırakılırsa filtre uygulanmaz). `supabase/seed.sql` yalnızca Naeron verisi olmadan deneme yapmak içindir; gerçek veriyle birlikte uygulamayın.

## Veri notları

`example-database.sql` gerçek öğrenci verisi (TC kimlik no, e-posta, telefon) içeren bir MySQL dump'ıdır; **git'e girmez** (`.gitignore`) ve Supabase'e aktarılmadı. Dump üzerinde yapılan tutarlılık kontrollerinde öne çıkanlar: `northfly_odt_users` içinde iki e-postanın tek satıra yazıldığı bir kayıt, `naeron_bi_currencies` tablosunda olmayan para birimi ID'leri (25, 26), `trainingID=308` için eksik eğitim kaydı ve `destroy` durumundaki öğrencilere bağlı aktif sözleşme/taksitler.

## Cloudflare'de yayın

Uygulama [OpenNext Cloudflare adaptörü](https://opennext.js.org/cloudflare) ile Cloudflare Workers üzerinde çalışır (`wrangler.jsonc`, `open-next.config.ts`). Canlı adres: https://ogrenciodemetakip.furkantoptas.workers.dev

**Otomatik yayın (Workers Builds).** Worker, Cloudflare panelinden GitHub deposuna bağlıdır; `main` dalına her push Cloudflare'de derlenip yayınlanır (Workers & Pages → ogrenciodemetakip → Settings → Build). Ayarlar: build command `npx opennextjs-cloudflare build`, deploy command `npx opennextjs-cloudflare deploy`, root directory `/`. Derleme günlükleri aynı Worker'ın **Builds** sekmesindedir.

**Ortam değişkenleri.**

- `NEXT_PUBLIC_*` değerleri derleme anında pakete gömülür; gizli olmadıkları için `.env.production` dosyasında tutulur ve git'e girer.
- Gizli olmayan çalışma zamanı ayarları (`ODT_*`, `NAERON_API_BASE`) `wrangler.jsonc` → `vars` içindedir; değiştirmek için dosyayı düzenleyip push edin.
- Gizli anahtarlar (`SUPABASE_SECRET_KEY`, `CRON_SECRET`, `NAERON_API_KEY`) Worker secret'ıdır ve yayınlar arasında korunur. Değiştirmek için `npx wrangler secret put ANAHTAR_ADI` (ya da Cloudflare paneli → Settings → Variables and Secrets).
- Yerelden `npm run deploy` ile de yayın yapılabilir (`npx wrangler login` gerekir); bu durumda `.env.local` değerleri de pakete gömülür. `npm run preview` uygulamayı yerelde Workers ortamında (http://localhost:8787) çalıştırır.

**Notlar.**

- Supabase → Authentication → URL Configuration → Redirect URLs listesinde `https://ogrenciodemetakip.furkantoptas.workers.dev/auth/callback` bulunmalıdır.
- Küçültülmüş paket gzip ile yaklaşık 2,7 MiB'dir; ücretsiz planın sınırı 3 MiB olduğu için `wrangler.jsonc` içinde `minify` açıktır. `proxy.ts`, adaptörün deneysel Node.js middleware desteğiyle çalışır.
- `vercel.json` içindeki SEO cron'u Cloudflare'de tanımlı değildir; Naeron eşitlemesi de elle çalıştırılır (Naeron Eşitleme ekranı ya da `CRON_SECRET` ile `GET /api/naeron/sync`).

## Vercel'de ilk yayın

1. Vercel'de **Add New → Project** ile `ulukan2310/ogrenciodemetakip-next` reposunu içe aktarın. Framework **Next.js**, Production Branch **main**, Node.js **22.x**, Build Command **npm run build**.
2. **Environment Variables** bölümüne aşağıdaki değerleri ekleyin. Sırları Git'e koymayın. Preview için ayrı Supabase projesi/dalı kullanın.
3. Supabase → Authentication → URL Configuration bölümüne üretim adresini ekleyin (yukarıdaki adım 3).
4. Deploy edin; giriş ve öğrenci listesini yetkili hesapla kontrol edin.

| Değişken | Kullanım |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Auth; zorunlu |
| `SUPABASE_SECRET_KEY` | Sunucu tarafı gizli anahtar (veritabanı fonksiyonları); zorunlu, asla `NEXT_PUBLIC_` yapmayın |
| `ODT_SUPER_EMAIL`, `ODT_ALLOWED_EMAIL_DOMAINS`, `ODT_ALLOWED_EMAILS` | Yönetici ve izinli hesaplar |
| `CRON_SECRET` | Günlük SEO görevinin kimlik doğrulaması |
| `WP_BASE_URL`, `WP_USER`, `WP_APP_PASSWORD` | WordPress formları ve SEO; cron için de gerekli |
| `DESK360_API_TOKEN`, `DESK360_DEFAULT_INTEGRATION_ID` | WhatsApp modülü |
| `VERIMOR_API_KEY`, `VERIMOR_API_BASE` | Arama kayıtları |

Verimor anahtarı **Santral Ayarlarım → API Anahtarı** ekranından alınır; partner/webhook anahtarı değildir.

Git entegrasyonu bağlandıktan sonra main push'ları Vercel üretim dağıtımını tetikler. Sunucuya SSH ile dosya kopyalanmaz.

## Günlük SEO görevi

`vercel.json`, `GET /api/seo/cek` adresini her gün 06:00 UTC (09:00 Türkiye) için planlar. Planınıza göre çalışma dakikası değişebilir. Vercel `CRON_SECRET` değerini Authorization başlığıyla gönderir. Eksik/yanlış anahtar 401 döndürür; bugün başarılı kayıt varsa işlem atlanır. Süre sınırı 120 saniyedir.

Cron üretim dağıtımında çalışır. **Settings → Cron Jobs** ve function loglarından sonucu kontrol edin. WordPress henüz yapılandırılmadıysa görevi panelden devre dışı bırakın. Vercel başarısız cron çağrılarını otomatik tekrarlamaz; SEO ekranından tekrar çekilebilir. Büyük veri nedeniyle süre aşılırsa işi parçalara bölmek gerekir.

Mac'e özel `scripts/mac-acilis.sh` Vercel'de kullanılmaz. Eski yerel SEO çağrısı yalnızca development ortamında kabul edilir. `POST /api/seo/cek` üretimde oturum ve SEO modülü yetkisi gerektirir. WhatsApp gönderimleri bu cron'a dahil değildir.

## Yayın doğrulaması

- `npm run build`: Next.js derleme ve TypeScript kontrolü.
- Oturumsuz `/` isteği girişe yönlenmeli; Google girişi sonrası yetkili modüller açılmalı.
- Anahtarsız `GET /api/seo/cek` 401 dönmeli; oturumsuz POST görevi çalıştırmamalı.
- Yetkili kullanıcıyla liste ve öğrenci detayı açılmalı.
- Vercel Cron ekranında SEO görevini çalıştırıp tarih kaydını ve logları kontrol edin.

Kaynaklar: [Supabase Auth ile Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase + Prisma](https://supabase.com/docs/guides/database/prisma), [Vercel Cron yönetimi](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
