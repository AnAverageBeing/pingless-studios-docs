---
title: Installation
description: Install Trash Bin Pro on a Pterodactyl panel via Blueprint or the standalone installer, verify the install, upgrade from v1.0.0/v1.0.1, and uninstall cleanly.
---

# Installation

Trash Bin Pro ships in two flavors that install the **same** panel code:

1. **Blueprint extension** (recommended) — `pterodactyltrashbinpro-v1.0.2.blueprint`.
2. **Standalone installer** — copies `PanelFiles` into your panel and runs the idempotent patchers directly.

Both paths patch the panel's PHP backend and the React/TypeScript client SPA, register the service provider, and run migrations. The client SPA **must be rebuilt** after either path or the Trash UI will not appear.

---

## Prerequisites

- Pterodactyl Panel **v1.11.x / v1.12.x** (Laravel 11, PHP 8.2+)
- **Python 3** — the patchers are Python scripts
- **Node.js + Yarn** — to rebuild the client SPA after install
- [Blueprint](https://blueprint.zip) `beta-2026-05` — Blueprint path only
- Working **scheduler cron**: `* * * * * php /var/www/pterodactyl/artisan schedule:run` — the hourly purge is scheduled via the service provider, so it needs the stock panel scheduler running

## Back up first

Trash Bin Pro patches core panel files (`FileController.php`, `Server.php`, `Permission.php`, `routes/api-client.php`, and a dozen SPA files). Take a full backup before installing:

```bash
cp -r /var/www/pterodactyl /var/www/pterodactyl.bak
mysqldump -u root pterodactyl > pterodactyl.sql.bak
```

::: danger Do not skip the backup
The patchers fail loudly and refuse to rebuild on anchor mismatches, but a backup is the only way to undo a half-patched panel quickly.
:::

---

## Blueprint Install (recommended)

Place `pterodactyltrashbinpro-v1.0.2.blueprint` in `/var/www/pterodactyl` (or your custom panel path), then:

```bash
cd /var/www/pterodactyl
blueprint -i pterodactyltrashbinpro-v1.0.2
yarn build:production
```

::: tip Older Node versions
If the production build fails with OpenSSL errors, your Node is too old for the panel's webpack toolchain:

```bash
NODE_OPTIONS=--openssl-legacy-provider yarn build:production
```
:::

## Standalone Install (no Blueprint)

Download the release and use the `standalone/` folder:

```bash
# 1. Copy the addon files into the panel
PANEL=/var/www/pterodactyl
cp -a /path/to/standalone/PanelFiles/. "$PANEL/"

# 2. Run the installer
export PTERODACTYL_DIRECTORY="$PANEL"
bash /path/to/standalone/data/install.sh
```

The installer:

- Patches `FileController.php`, `Server.php`, `FileObjectTransformer.php`, `Permission.php`, and `routes/api-client.php` — all idempotent, safe to re-run.
- Registers `TrashBinProServiceProvider` in `config/app.php`.
- Patches all React/TypeScript client SPA files.
- Clears caches and runs migrations.

Then rebuild the SPA:

```bash
cd "$PANEL"
yarn build:production
# If your Node version requires it:
# NODE_OPTIONS=--openssl-legacy-provider yarn build:production
```

::: info Re-running is safe
Every patch block is marker-guarded (`// pterodactyltrashbinpro`) with a per-block presence check. Re-running the installer is a zero-diff no-op unless something is actually missing, in which case it fails loudly instead of double-inserting.
:::

---

## Post-Install Verification

1. **Admin panel loads** — open **Admin → Trash Bin Pro** (`/admin/trashbinpro`). Configure global retention and capacity here.
2. **Trash toolbar button** — open any server's file manager. A **Trash** button appears in the toolbar next to Upload / New File; clicking it opens the Trash view.
3. **Sub-user permission** — **trashbinpro.access** is now available on the sub-user management page.
4. **`.trash` stays hidden** — the `.trash` folder is filtered out of normal file listings; users only see it through the Trash view.
5. **Soft delete works** — delete a test file, confirm it appears in the Trash view, restore it, and confirm it returns to its original path.
6. **Purge scheduled** — `php artisan list trashbin` should show `p:trashbin:purge`; it runs hourly through the scheduler.

---

## Upgrading from v1.0.0 / v1.0.1

Install the new release over the top (Blueprint package or standalone files), then re-run the frontend patcher and rebuild:

```bash
export PTERODACTYL_DIRECTORY=/var/www/pterodactyl
python3 /path/to/standalone/data/patch-frontend.py
cd /var/www/pterodactyl && yarn build:production
```

::: warning The faTrash repair
v1.0.0/v1.0.1 patched the `faTrash` icon import with an anchored search that could be **silently skipped** on panels whose stock files were modified by themes or other addons — producing a white-screen `faTrash is not defined` error in the file manager. v1.0.2 uses anchor-free import merging: it merges into an existing `import { ... } from '@fortawesome/free-solid-svg-icons'` or inserts a new import line, and validates that every patched symbol has a matching import. Re-running `patch-frontend.py` from v1.0.2 repairs the broken import; you do not need to hand-edit any TSX file.
:::

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Patcher prints `FAILED` and exits 1 | Anchor mismatch — a stock panel file was modified by a theme, another addon, or a panel update | **Do not rebuild.** The patcher stops before leaving a broken state. Restore the file from your backup or a clean panel copy, re-run the installer, then build |
| Build succeeds but no Trash button in the file manager | Stale built assets — the SPA was not rebuilt (or the browser cached the old bundle) | `php artisan view:clear`, then hard-refresh the browser (Ctrl+Shift+R). Confirm `yarn build:production` completed without errors |
| `422 Unprocessable Content` on Empty Trash | Leftover v1.0.0 patch — the endpoint was bound to a request class that requires a `files` body | Re-run the v1.0.2 patchers (Blueprint reinstall or `install.sh` / `patch-file-controller.py`) and rebuild the SPA |
| `403` when opening the Trash view | Missing sub-user permission | Grant **trashbinpro.access** on the sub-user management page. Server owners always have it |

---

## Uninstall

**Standalone:**

```bash
export PTERODACTYL_DIRECTORY=/var/www/pterodactyl
bash /path/to/standalone/data/remove.sh
```

The remover strips the service provider registration and every marker-guarded patch block from the PHP and SPA files. Afterwards:

```bash
cd /var/www/pterodactyl
yarn build:production    # rebuild the SPA without the Trash UI
```

**Blueprint:**

```bash
blueprint -remove pterodactyltrashbinpro
cd /var/www/pterodactyl && yarn build:production
```

**Optional full cleanup:**

- Delete the merged `PanelFiles` the remover does not touch: `app/Services/TrashBinPro/`, `app/Models/TrashBinPro/`, `app/Console/Commands/TrashBinPro/`, `app/Providers/TrashBinProServiceProvider.php`, `config/trashbinpro.php`, `routes/admin-trashbinpro.php`, `resources/views/admin/trashbinpro/`, `lang/en/trashbinpro.php`, and the new SPA API files (`restoreFiles.ts`, `emptyTrash.ts`, `getTrashQuota.ts`).
- Drop the database tables. This is destructive and deletes all trash history:

```sql
DROP TABLE IF EXISTS trashbin_files, trashbin_settings, trashbin_egg_settings, trashbin_server_settings;
```

::: warning Files in `/.trash` are not removed
Uninstalling does not delete the `.trash` folders on your game servers. Empty the Trash Bin from the panel (or delete `/.trash` via SFTP/Wings) **before** removing the addon, or the files simply stay on disk and keep counting against server quotas.
:::
