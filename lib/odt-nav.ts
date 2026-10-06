export type OdtNavGroupId = "genel" | "ogrenci" | "ucus" | "iletisim" | "yonetim";

export type OdtNavItem = {
  id: string;
  href: string;
  label: string;
  short: string;
  icon: string;
  group: OdtNavGroupId;
  /** Görünmesi için gereken modül; boşsa `id` kullanılır. */
  module?: string;
};

export const ODT_NAV_GROUPS: Array<{ id: OdtNavGroupId; label: string }> = [
  { id: "genel", label: "Genel" },
  { id: "ogrenci", label: "Öğrenci" },
  { id: "ucus", label: "Uçuş" },
  { id: "iletisim", label: "İletişim ve Pazarlama" },
  { id: "yonetim", label: "Yönetim" },
];

/** Yeni sayfa: buraya bir satır ekle. Super yetki kutusu da buradan çıkar. */
export const ODT_NAV_ITEMS: OdtNavItem[] = [
  { id: "liste", href: "/ogrenciler", label: "Öğrenciler", short: "Öğrenciler", icon: "bi-table", group: "ogrenci" },
  { id: "ekstra", href: "/ekstra", label: "Ekstra", short: "Ekstra", icon: "bi-plus-square", group: "ogrenci" },
  { id: "hat-ppl", href: "/hat-durumu-ppl", label: "Hat PPL", short: "Hat PPL", icon: "bi-kanban", group: "ucus" },
  { id: "pic-takip", href: "/pic-takip", label: "PIC Takip", short: "PIC", icon: "bi-compass", group: "ucus" },
  { id: "wapi", href: "/wapi", label: "WhatsApp", short: "WAPI", icon: "bi-whatsapp", group: "iletisim" },
  { id: "formlar", href: "/formlar", label: "Formlar", short: "Formlar", icon: "bi-ui-checks", group: "iletisim" },
  { id: "aramalar", href: "/aramalar", label: "Aramalar", short: "Ara", icon: "bi-telephone", group: "iletisim" },
  { id: "seo", href: "/seo", label: "SEO", short: "SEO", icon: "bi-graph-up", group: "iletisim" },
  { id: "super", href: "/super", label: "Yetkiler", short: "Super", icon: "bi-shield-lock", group: "yonetim" },
  { id: "paylasim", href: "/paylasim", label: "API", short: "API", icon: "bi-braces", group: "yonetim" },
];

/**
 * Kenar menüsü: modül sayfaları + ayrı bir yetki kutusu olmayan ekranlar
 * (özet, uçuşlar, iptaller, askıya alınanlar, ödeme ekranları ve filo liste yetkisiyle,
 * Naeron eşitlemesi süper yetkiyle görünür).
 */
export const ODT_MENU_ITEMS: OdtNavItem[] = [
  { id: "panel", href: "/", label: "Özet", short: "Özet", icon: "bi-speedometer2", group: "genel", module: "liste" },
  { id: "ucuslar", href: "/ucuslar", label: "Uçuşlar", short: "Uçuşlar", icon: "bi-airplane", group: "genel", module: "liste" },
  { id: "iptaller", href: "/iptaller", label: "İptaller", short: "İptaller", icon: "bi-x-circle", group: "genel", module: "liste" },
  { id: "askida", href: "/askiya-alinanlar", label: "Askıya alınanlar", short: "Askıda", icon: "bi-pause-circle", group: "genel", module: "liste" },
  { id: "odeme-takvimi", href: "/odeme-takvimi", label: "Ödeme takvimi", short: "Takvim", icon: "bi-calendar3", group: "genel", module: "liste" },
  { id: "geciken", href: "/geciken-odemeler", label: "Geciken ödemeler", short: "Geciken", icon: "bi-exclamation-triangle", group: "genel", module: "liste" },
  { id: "filo", href: "/filo", label: "Filo", short: "Filo", icon: "bi-airplane-engines", group: "ucus", module: "liste" },
  ...ODT_NAV_ITEMS,
  { id: "naeron", href: "/naeron", label: "Naeron Eşitleme", short: "Naeron", icon: "bi-arrow-repeat", group: "yonetim", module: "super" },
];

export function odtNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
