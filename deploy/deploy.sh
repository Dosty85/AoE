#!/usr/bin/env bash
# Nasazení AoE RTS na Linux server.
# Použití:  bash deploy/deploy.sh root@<host-nebo-domena>
# Předpoklad: lokálně proběhl `npm run build:all` (vznikne dist/ + dist-server/server.cjs).
set -euo pipefail

HOST="${1:?Použití: deploy/deploy.sh root@<host>}"
REMOTE_DIR=/opt/aoe
SSH_KEY="${SSH_KEY:-$HOME/.ssh/aoe_deploy}"
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new"

[ -f dist/index.html ] || { echo "Chybí dist/ — spusť: npm run build:all"; exit 1; }
[ -f dist-server/server.cjs ] || { echo "Chybí dist-server/server.cjs — spusť: npm run build:all"; exit 1; }

echo "==> Nahrávám build (tar přes ssh)"
$SSH "$HOST" "rm -rf $REMOTE_DIR/dist $REMOTE_DIR/dist-server && mkdir -p $REMOTE_DIR"
tar czf - dist dist-server | $SSH "$HOST" "tar xzf - -C $REMOTE_DIR"
$SSH "$HOST" "cat > /etc/systemd/system/aoe.service" < deploy/aoe.service

echo "==> Nastavení serveru (uživatel, systemd)"
$SSH "$HOST" bash -s <<'REMOTE'
set -euo pipefail
id aoe >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin aoe
chown -R aoe:aoe /opt/aoe
if ! command -v node >/dev/null; then
  echo "!! Node.js není nainstalovaný. Nainstaluj Node 18+ (NodeSource) a spusť deploy znovu."
  exit 1
fi
echo "Node: $(node -v)"
systemctl daemon-reload
systemctl enable aoe
systemctl restart aoe   # restart načte nový server.cjs (důležité pro redeploy)
sleep 1
systemctl --no-pager --full status aoe | head -n 14
REMOTE

echo "==> Hotovo. Otevři http://<doména>/ a vyzkoušej Multiplayer."
