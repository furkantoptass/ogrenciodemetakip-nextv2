#!/bin/bash
# Veritabanı köprüsü + öğrenci ödeme sayfası (sessiz).
# Mac girişinde VE her dakika (launchd StartInterval) çalışır; kopan parçayı geri açar.

set -u
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export HOME="${HOME:-/Users/ulukanabaci}"

ROOT="/Users/ulukanabaci/ogrenciodemetakip-next"
LOG="${HOME}/Library/Logs/ogrenciodemetakip-next.log"
mkdir -p "${HOME}/Library/Logs"

port_open() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

seo_cek() {
  curl -sS -o /tmp/ogrenciodemetakip-seo-cek.json -w '%{http_code}' --max-time 120 \
    -X POST -H 'Content-Type: application/json' \
    -d '{"yalnizYoksa":true}' \
    http://127.0.0.1:3000/api/seo/cek || true
}

{
  echo "---- $(date '+%Y-%m-%d %H:%M:%S') ----"

  if port_open 3307; then
    echo "Köprü zaten açık (3307)."
  else
    echo "Köprü açılıyor…"
    # Varsa ölü/yarım tüneli temizle (port dinlemiyorsa buraya geliriz).
    # Sadece gerçek ssh süreçlerini, kendi PID'imiz hariç, PID ile öldür.
    for pid in $(pgrep -f "ssh .*-L 3307:localhost:3306 .*cursor-plesk" 2>/dev/null); do
      [ "$pid" = "$$" ] || kill "$pid" 2>/dev/null || true
    done
    # ServerAlive*: bağlantı ölürse ssh ~90 sn içinde kendi kapanır, port boşalır,
    # bir sonraki dakikalık çalıştırma tüneli yeniden açar.
    if ssh -f -N \
      -o BatchMode=yes \
      -o ConnectTimeout=15 \
      -o ExitOnForwardFailure=yes \
      -o ServerAliveInterval=30 \
      -o ServerAliveCountMax=3 \
      -L 3307:localhost:3306 \
      cursor-plesk; then
      echo "Köprü açıldı."
    else
      echo "Köprü açılamadı (ağ veya SSH)."
    fi
  fi

  if port_open 3000; then
    echo "Site zaten açık (3000)."
  else
    echo "Site açılıyor…"
    cd "$ROOT" || {
      echo "Klasör yok: $ROOT"
      exit 1
    }
    nohup npm run dev >>"$LOG" 2>&1 </dev/null &
    disown || true
    echo "Site başlatıldı (http://localhost:3000)."
  fi

  # SEO: günde bir çek. Bugün olduysa geç. Olmadıysa dene; olmazsa 10 dk sonra tekrar.
  TODAY="$(TZ=Europe/Istanbul date +%Y-%m-%d)"
  SEO_OK="${HOME}/Library/Logs/ogrenciodemetakip-seo-${TODAY}.ok"
  SEO_FAIL="${HOME}/Library/Logs/ogrenciodemetakip-seo-${TODAY}.fail"
  if [ -f "$SEO_OK" ]; then
    echo "SEO bugün çekilmiş."
  elif ! port_open 3000; then
    echo "SEO çekilmedi (site kapalı)."
  elif [ -f "$SEO_FAIL" ]; then
    FAIL_AGE=$(( $(date +%s) - $(stat -f %m "$SEO_FAIL") ))
    if [ "$FAIL_AGE" -lt 600 ]; then
      echo "SEO bekleniyor (son deneme yeni)."
    else
      echo "SEO yeniden deneniyor…"
      SEO_CODE="$(seo_cek)"
      if [ "$SEO_CODE" = "200" ]; then
        rm -f "$SEO_FAIL"
        touch "$SEO_OK"
        echo "SEO günlük çekim oldu."
      else
        touch "$SEO_FAIL"
        echo "SEO günlük çekim olmadı (${SEO_CODE})."
      fi
    fi
  else
    echo "SEO çekiliyor…"
    SEO_CODE="$(seo_cek)"
    if [ "$SEO_CODE" = "200" ]; then
      touch "$SEO_OK"
      echo "SEO günlük çekim oldu."
    else
      touch "$SEO_FAIL"
      echo "SEO günlük çekim olmadı (${SEO_CODE})."
    fi
  fi
} >>"$LOG" 2>&1
