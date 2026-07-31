---
title: Installation
description: Install Ask Access on a Pterodactyl panel via Blueprint or the standalone installer, verify it works, and uninstall cleanly.
---

# Installation

Ask Access installs like any other Pterodactyl addon. Pick the path that matches your panel.

## Prerequisites

- Pterodactyl Panel **v1.11+** at `/var/www/pterodactyl`
- **PHP 8.1+**, **Composer**, **python3**
- **Node.js + Yarn** (to rebuild the client frontend)
- The panel's scheduler cron already configured (standard for any Pterodactyl install):

```bash
* * * * * php /var/www/pterodactyl/artisan schedule:run >> /dev/null 2>&1
```

- [Blueprint](https://blueprint.zip) installed on the panel — **required for the Blueprint package**, and strongly recommended for standalone installs too (the account page route is wired through Blueprint's extends layer)

---

## Blueprint install (recommended)

1. Download `pterodactylaskaccess-v1.0.0.blueprint` from the [latest release](https://github.com/AnAverageBeing/Ask-Access/releases) and place it in your panel directory.

2. Install:

```bash
cd /var/www/pterodactyl
blueprint -install pterodactylaskaccess-v1.0.0.blueprint
```

Blueprint merges the addon files, registers the service provider, wires the client routes, runs the migrations, and rebuilds the frontend.

---

## Standalone install

1. Download `AskAccess-v1.0.0-standalone.zip` from the [latest release](https://github.com/AnAverageBeing/Ask-Access/releases), unzip it, and enter the folder:

```bash
unzip AskAccess-v1.0.0-standalone.zip -d askaccess
cd askaccess
```

2. Run the installer as root:

```bash
sudo bash install.sh
```

If your panel lives somewhere other than `/var/www/pterodactyl`:

```bash
sudo PTERODACTYL_DIRECTORY=/path/to/panel bash install.sh
```

The installer will:

- create a full panel backup under `/var/backups/pterodactyl-askaccess-<timestamp>`
- merge `PanelFiles/` into the panel
- register `AskAccessServiceProvider` in `config/app.php` (idempotent)
- register the `accessmanager.manage` subuser permission in `app/Models/Permission.php`
- wire the **Server Access** account route into Blueprint's extends layer (if present)
- rebuild the Composer autoloader and run the database migrations
- rebuild the client assets (`yarn build:production`)
- fix ownership, clear caches, and restart the queue worker

::: tip Re-running is safe
Both installers are idempotent — running them twice won't duplicate providers, permissions, routes, or tables.
:::

---

## Verify the install

1. Log in to the client area and open **Account → Server Access** — the page should load without errors.
2. Check the database tables exist:

```bash
cd /var/www/pterodactyl
php artisan tinker --execute="echo implode(' ', \Illuminate\Support\Facades\Schema::getColumnListing('askaccess_requests'));"
```

You should see `askaccess_requests`, `askaccess_settings`, `askaccess_blocks`, `askaccess_logs`, `askaccess_grants`, and `askaccess_admin_settings` in your database.

3. Confirm the scheduler is pruning:

```bash
php artisan askaccess:prune
# [Ask Access] Expired 0 pending request(s); revoked 0 temporary grant(s).
```

4. Admin settings live at **Admin → Extensions → Ask Access** (Blueprint installs).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Server Access` page missing from Account menu | Frontend not rebuilt or route not wired | `cd /var/www/pterodactyl && yarn build:production`, then hard-refresh (Ctrl+Shift+R) |
| Page loads but shows a 404 on API calls | Routes cached before install | `php artisan route:clear && php artisan optimize:clear` |
| `Class 'Pterodactyl\Services\AskAccess\...' not found` | Autoloader not rebuilt | `composer dump-autoload --optimize` in the panel dir |
| Migration errors about existing tables | Partial previous install | Safe — migrations check `hasTable`/`hasColumn` before creating; re-run `php artisan migrate --force` |
| Temporary access never expires | Scheduler cron missing | Add the `schedule:run` cron entry (see Prerequisites) |
| Build fails on Node 17+ | OpenSSL 3 legacy provider | The installer sets this automatically; manually: `NODE_OPTIONS=--openssl-legacy-provider yarn build:production` |
| Blank page after install | File ownership | `chown -R www-data:www-data /var/www/pterodactyl` |

---

## Uninstall

**Blueprint:**

```bash
cd /var/www/pterodactyl
blueprint -remove pterodactylaskaccess
```

**Standalone:**

```bash
sudo bash uninstall.sh
cd /var/www/pterodactyl && yarn build:production
```

Both paths remove the provider registration, the custom permission, the frontend route, and the addon's files. **Database tables are left intact** so no access history is lost. To fully purge:

```bash
cd /var/www/pterodactyl
php artisan migrate:rollback --path=database/migrations/2026_06_03_100000_askaccess_grants_and_limits.php
php artisan migrate:rollback --path=database/migrations/2026_06_02_100000_extend_askaccess.php
php artisan migrate:rollback --path=database/migrations/2026_06_01_100000_create_askaccess_tables.php
```

::: danger Rolling back drops data
The rollback commands above **drop** every `askaccess_*` table, including the audit log and all grant records. There is no undo.
:::
