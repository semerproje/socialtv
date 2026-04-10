#!/bin/zsh

# Social Lounge TV Launcher
APP_DIR="/Users/user/Desktop/Social Web"
PORT=3000

cd "$APP_DIR" || { echo "Proje klasoru bulunamadi: $APP_DIR"; exit 1; }

# Portu temizle (onceki calisma varsa)
lsof -ti tcp:$PORT | xargs kill -9 2>/dev/null
sleep 0.5

echo ""
echo "============================================"
echo "  Social Lounge TV"
echo "  Baslatiliyor..."
echo "============================================"
echo ""

# Sunucuyu arka planda baslat
npm run dev &
SERVER_PID=$!

# Sunucu hazir olana kadar bekle (max 30s)
echo "Sunucu bekleniyor..."
for i in {1..30}; do
  if curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Sunucu hazir!"
echo ""

# Admin panelini tarayicide ac
open "http://localhost:$PORT/admin"

echo "Tarayici acildi: http://localhost:$PORT/admin"
echo ""
echo "Kapatmak icin bu pencereyi kapatin veya Ctrl+C basin."
echo ""

wait $SERVER_PID
