# Nasazení

Hra běží na **Linux VPS** jako jeden Node proces, který servíruje statický klient i WebSocket na stejném
portu (same‑origin). Aktuálně: **http://37.235.109.6/** (Debian 13, port 80, zatím HTTP bez TLS).

## Princip
```
prohlížeč ──HTTP+WS──> Node (port 80) ── servíruje dist/ + autoritativní Room (ws)
```
- Server je zabalený esbuildem do jednoho souboru `dist-server/server.cjs` (vč. `ws`) → na serveru stačí
  `node`, žádné `npm install`.
- Běží jako **systemd služba `aoe`** (`deploy/aoe.service`): `Restart=always`, dedikovaný uživatel `aoe`,
  `AmbientCapabilities=CAP_NET_BIND_SERVICE` (bind portu 80 bez rootu). Env `PORT` a `STATIC_DIR`.

## Předpoklady na serveru
- Linux se **systemd**, **Node.js 18+** (na Debianu: `apt-get install -y nodejs`).
- Volný **port 80** (jinak uprav `PORT` v unitu a dej před něj reverzní proxy).
- SSH přístup klíčem (deploy skript používá `~/.ssh/aoe_deploy`).

## Redeploy
```bash
npm run build:all
bash deploy/deploy.sh root@37.235.109.6
```
`deploy/deploy.sh`:
1. ověří přítomnost `dist/` a `dist-server/server.cjs`,
2. přenese build (**tar přes ssh** — na Windows lokálně chybí rsync),
3. nahraje `aoe.service`,
4. vytvoří uživatele `aoe`, `systemctl daemon-reload && enable --now aoe`, vypíše status.

Klíč/host lze přepsat: `SSH_KEY=~/.ssh/jiny bash deploy/deploy.sh root@jiny-host`.

## Automatický deploy (GitHub Actions)
Workflow **`.github/workflows/deploy.yml`** při každém **push do `main`** (a ručně přes
*Actions → Deploy → Run workflow*) zbuilduje hru a nasadí ji na server stejným `deploy/deploy.sh`.

Potřebuje dva **repo secrets** (Settings → Secrets and variables → Actions):
| Secret | Hodnota |
|--------|---------|
| `SSH_PRIVATE_KEY` | privátní část deploy klíče (`~/.ssh/aoe_deploy`) — odpovídá veřejnému klíči v `authorized_keys` na serveru |
| `DEPLOY_HOST` | adresa serveru, např. `37.235.109.6` |

Workflow zapíše klíč na runner, spustí `deploy/deploy.sh root@$DEPLOY_HOST` (build už proběhl v CI).
Běh: `npm ci` → `npm run build:all` → SSH klíč → deploy. Souběžné deploye jsou serializované (`concurrency`).

> Tip: stejný klíč jde používat lokálně i v CI. Pro vyšší bezpečnost lze vygenerovat oddělený CI klíč
> a přidat jeho veřejnou část do `authorized_keys` na serveru.

## Provoz (ops)
```bash
# stav + logy
ssh -i ~/.ssh/aoe_deploy root@37.235.109.6 "systemctl status aoe; journalctl -u aoe -n 50 --no-pager"
# restart
ssh -i ~/.ssh/aoe_deploy root@37.235.109.6 "systemctl restart aoe"
```

## HTTPS (až bude potřeba)
Doporučený postup bez zásahu do appky:
1. Změnit `PORT` v `deploy/aoe.service` na `8080` (a `CAP_NET_BIND_SERVICE` lze pak vypustit).
2. Před Node dát **nginx** jako reverzní proxy s `Upgrade`/`Connection` hlavičkami (WebSocket) na
   `http://127.0.0.1:8080`.
3. **certbot** vystaví TLS pro doménu → `https`.

Klient se na `wss` přepne sám (`client/src/main.ts` volí `wss` podle `location.protocol`), takže žádná
změna kódu. Stačí, aby doména mířila na server.

## Omezení
- **Jedna místnost pro 2 hráče** (sdílený stav). Třetí připojený sdílí slot hráče 0. Pro víc paralelních
  zápasů by bylo potřeba lobby s místnostmi (`server/src/room.ts` → správce místností).
