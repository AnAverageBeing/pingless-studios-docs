---
title: Installation — Glacier Pack
description: Install the Glacier Pack hub and any of the 24 Glacier addons on Pterodactyl Panel v1.12.x — prerequisites, per-addon install, verification, troubleshooting and uninstall.
outline: deep
---

# Installation

Glacier Pack installs as **standalone packages** — self-contained directories that mirror your panel root, each with an idempotent installer. There is no Blueprint step, no daemon on your nodes, and no core-file replacement. This guide covers prerequisites, installing the hub (required), adding addons, verification, and removal.

---

## Prerequisites

| Requirement | Minimum | Notes |
| --- | --- | --- |
| **Pterodactyl Panel** | v1.12.x | Laravel 11 panel. The standard panel cron (`* * * * * php artisan schedule:run`) should be running — several addons schedule work through it. |
| **PHP** | 8.2+ | Same version the panel runs on. |
| **Root access** | Yes | Shell access to the panel host; the installer writes into the panel directory and resets ownership to the web user. |
| **Panel admin** | root admin | The hub and all addon admin surfaces are root-admin only. |

Some addons have extra prerequisites — see the [per-addon notes](#per-addon-install-notes) below (RCON, a Cloudflare token, `mysql` client binaries, and so on).

### Quick dependency check

```bash
# Panel version (run from the panel root)
php artisan --version

# PHP version (8.2+ required)
php -v

# Panel cron registered
crontab -l | grep schedule:run
```

---

## Step 1 — Install the hub (required)

The **Glacier Pack hub is the only admin surface** for the whole family. Individual addons ship no admin pages of their own — install the hub first, or your addons will have nowhere to be managed from.

```bash
cd glacier-pack
sudo bash data/install.sh
```

The installer:

1. Copies `PanelFiles/` into your panel root (`$PTERODACTYL_DIRECTORY`, default `/var/www/pterodactyl` — export it first if your panel lives elsewhere).
2. Registers `Pterodactyl\Providers\GlacierPackServiceProvider` in `config/app.php` (marker comment `// pterodactylglacierpack`).
3. Injects the **Glacier Pack** sidebar link into `resources/views/layouts/admin.blade.php` as a marker-delimited block.
4. Clears the config, route, view and application caches and resets ownership to `www-data`.

The installer is **idempotent** — safe to re-run, and you *should* re-run it after any panel update that overwrites `config/app.php` or the admin layout.

::: tip
The hub needs **no database migrations** — its addon registry is a plain config file (`config/glacier-pack.php`).
:::

---

## Step 2 — Install addons

Every addon installs the same way, from its own directory:

```bash
cd recycle-bin
sudo bash data/install.sh
```

Each addon's installer copies its `PanelFiles/` tree over the panel root, registers the addon's service provider, runs its database migrations (`php artisan migrate --force --no-interaction`), clears caches, and fixes ownership. Re-running an installer is always safe.

Set a non-standard panel path or web user before running:

```bash
export PTERODACTYL_DIRECTORY=/srv/pterodactyl
export PTERODACTYL_WEB_USER=nginx   # default: www-data
sudo bash data/install.sh
```

Addons are independent — install any subset, in any order, and they appear in the hub rail as they land.

### Per-addon install notes

| Addon | Extra step or requirement |
| --- | --- |
| **Recycle Bin** | Requires a **frontend rebuild**: `yarn build:production` after install (and again after uninstall). Needs Node.js, Yarn and Python 3 on the host. |
| **Node Stats** | Needs a Supervisor queue worker on the `nodeanalytics` queue — run the bundled `data/install-queue-worker.sh` after install. |
| **Player Manager** | Each managed server needs `enable-rcon=true`, `rcon.port` and `rcon.password` in `server.properties`, with the RCON port reachable from the panel host. |
| **Subdomain Manager** | Needs a Cloudflare API token (Zone / DNS / Edit) and the Zone ID of each domain you attach. |
| **Database Manager** | Needs `mysqldump` and `mysql` client binaries on the panel host (Debian/Ubuntu: `apt install default-mysql-client`). |
| **Backup Pro** | Needs a queue worker on the stock `standard` queue (the panel's `pteroq` service covers this) and an S3-compatible bucket. |
| **Server Importer** | Needs an Application API key (`ptla_…`) on the *source* panel with read access to servers, users, nodes, nests and eggs. |
| **Plugin / Mod / Modpack installers** | Panel needs outbound HTTPS to the catalogue APIs (`api.modrinth.com`, `api.curseforge.com`, …); nodes must reach the content CDNs. CurseForge requires an API key. |
| **Permission Manager** | Before uninstalling, remove members or run `php artisan permgr:sync` so no provisioned subusers are left behind. |

All remaining addons work out of the box after `install.sh`.

---

## Step 3 — Verify the install

### 1. Routes registered

```bash
php artisan route:list | grep -i glacier-pack
```

Expected: the hub route `GET /admin/glacier-pack`. For each installed addon, its **action** routes appear too — addons ship no `GET /admin/<addon>` page routes of their own by design.

### 2. Providers registered

```bash
grep -c "ServiceProvider::class" config/app.php
grep "pterodactyl" config/app.php
```

Each installed addon adds one marker-commented provider line to `config/app.php`.

### 3. Open the hub

Sign in as a root admin and open **Admin → Glacier Pack**, or browse directly to:

```
https://your-panel.example/admin/glacier-pack
```

The rail lists all 23 addons in two groups; installed addons open their pane, addons without files on the panel show a fallback card.

### 4. Save smoke test

Open any installed addon's pane, change a setting, and save. You should land back on the same pane with the green **Settings saved.** banner.

---

## Troubleshooting

### Provider not registered

**Symptom:** `route:list` shows nothing for an addon, or the panel errors with `Class ... not found`.

**Cause:** the provider line in `config/app.php` was lost — usually a panel update overwrote the file, or caches are stale.

**Fix:** re-run the addon's installer (it is idempotent), then clear caches:

```bash
cd <addon> && sudo bash data/install.sh
cd /var/www/pterodactyl
php artisan config:clear && php artisan route:clear && php artisan view:clear
```

### Blank or missing pane in the hub

**Symptom:** the rail entry shows a dot and the pane renders a "Settings UI not linked yet" card.

**Cause:** the addon's view files are not on the panel — the `PanelFiles/` copy never happened or was reverted.

**Fix:** re-run the addon's `data/install.sh`, then `php artisan view:clear`.

### Stale view or config cache after installing

**Symptom:** changes do not appear, old pages still render, or new routes 404.

**Fix:**

```bash
cd /var/www/pterodactyl
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan cache:clear
```

### Sidebar link missing after a panel update

Panel updates can overwrite `resources/views/layouts/admin.blade.php` and `config/app.php`. Re-run the hub's installer — it re-applies the marker-delimited blocks without duplicating them:

```bash
cd glacier-pack && sudo bash data/install.sh
```

### Scheduled work not running (alerts, backups, uptime, expiry)

**Symptom:** Resource Alerts never fire, Backup Pro uploads sit pending, uptime graphs stay flat.

**Fix:** confirm the standard panel cron exists and the queue worker is up:

```bash
crontab -l | grep schedule:run
systemctl status pteroq
```

Backup Pro additionally needs a worker on the `standard` queue; Node Stats needs its own `nodeanalytics` worker (`data/install-queue-worker.sh`).

---

## Uninstall

Every addon ships `data/remove.sh`, run from the addon directory:

```bash
cd recycle-bin
sudo bash data/remove.sh
```

The remover de-registers the service provider, removes the injected marker-delimited blocks, and clears caches. Copied files are left in place; the remover prints the exact paths to delete manually if you want them gone.

Addons with database tables keep their data by default. Most removers accept an explicit purge flag to drop it:

```bash
sudo bash data/remove.sh --purge-data       # or --drop-table / --purge-tables / --purge-settings, per addon
```

Check the addon's own `INSTALL.md` for the exact flag.

::: warning
Purging is irreversible. Recycle Bin trash contents, Backup Pro archive records, Login Activity history, Resource Alerts history, and Staff Requests grants are all lost with their tables. Approved Staff Requests created **real subuser rows** — uninstalling does not remove already-granted subusers. For Permission Manager, remove members (or run `php artisan permgr:sync`) *before* removing the provider so no provisioned subusers remain.
:::

To remove the hub itself:

```bash
cd glacier-pack
sudo bash data/remove.sh
```

This removes the provider registration and the sidebar block, then clears caches. Remove the hub **last** — while it is installed it is the only admin surface for every pack addon.

---

## What's Next?

- **[Quick Start →](./quick-start.md)** — hub plus three starter addons in minutes.
- **[The Hub Dashboard →](../user-guide/dashboard.md)** — a tour of the unified admin UI.
- **[Configuration Reference →](../configuration/reference.md)** — every setting, every default.
