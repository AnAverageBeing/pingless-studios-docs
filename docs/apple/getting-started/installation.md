---
title: Installation — Apple
description: Install the Apple admin theme on Pterodactyl Panel via Blueprint or the standalone variant — prerequisites, verification, troubleshooting and uninstall.
---

# Installation

Apple ships in two forms: a single `.blueprint` package (recommended, includes the settings hub) and a standalone variant for panels without Blueprint.

## Prerequisites

| Requirement | Version |
| --- | --- |
| Pterodactyl Panel | **1.12.x** |
| Blueprint framework | **beta-2026-05** (Blueprint install only) |
| PHP | **8.2+** (as required by the panel) |
| Python 3 | any (standalone install only, for the layout patcher) |

::: warning Blueprint, not core edits
Apple is a Blueprint extension. It does not patch Pterodactyl core files to work, so panel updates keep working — but Blueprint itself must be installed and healthy first. Verify with `blueprint -v` on the panel server.
:::

## Install (Blueprint)

1. Download `apple-v1.0.0.blueprint` and place it in the panel root (usually `/var/www/pterodactyl`).
2. From the panel root, run:

   ```bash
   blueprint -i apple-v1.0.0
   ```

3. Open **Admin → Apple Theme**. Defaults apply on first load — the admin area is already themed before you touch a setting.

::: tip First-load behavior
On its very first page load Apple seeds every `apple::*` setting with the documented defaults. Nothing is written to your servers, nodes, or other extensions — only rows in the panel's own settings store.
:::

## Install (standalone)

Use this on panels **without** Blueprint:

```bash
PANEL=/var/www/pterodactyl
cp -a standalone/PanelFiles/. "$PANEL/"
export PTERODACTYL_DIRECTORY="$PANEL"
bash standalone/data/install.sh
```

The script copies the theme files, injects one marker-delimited `@include('apple.wrapper')` line into `resources/views/layouts/admin.blade.php` (the original is backed up first), installs the bento dashboard, and clears compiled views. It is idempotent — re-running it changes nothing.

::: info Settings on standalone
The settings hub is a Blueprint-only feature. Standalone installs run with the documented defaults; each value can be adjusted directly in the panel `settings` table (keys `apple::*`) if you need to change one.
:::

## Post-install verification

1. **The sidebar and top bar** appear on every admin page, and a branded loader flashes while they build.
2. **Admin → Apple Theme** loads the settings hub (Blueprint installs).
3. **The admin dashboard** renders the bento grid (greeting, stat tiles, sparkline, quick actions, system tile).
4. **Hard-refresh once** (`Ctrl+Shift+R`) so your browser picks up the new assets.

If the admin area ever looks unstyled after an update, clear the compiled views:

```bash
php artisan view:clear
```

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `blueprint -i` says the package is invalid | Upload was corrupted or renamed | Re-download; keep the exact filename `apple-v1.0.0.blueprint` |
| `blueprint -i` / `-r` hangs with no output | A previous interrupted Blueprint run left a lock | Run `blueprint -unlock`, then retry |
| Blueprint asks for confirmation and aborts | Interactive prompt with no TTY | Answer the `y/N` prompt; avoid piping `yes` into Blueprint |
| Pages render but look stock | Browser or view cache | `php artisan view:clear` + hard-refresh |
| Dashboard is stock after reinstall | Install hook raced the views copy | Already handled (the hook probes three locations); if you hit it, re-run `blueprint -i` |
| Settings don't save (validation error) | A field outside its documented range | Check the red field hint against the [Configuration Reference](../../configuration/reference.md) |
| Dashboard patch missing after uninstall | Backup was deleted manually | Restore `resources/views/admin/index.blade.php.apple-backup` by hand, or re-copy the stock view from the panel release |

::: danger Interrupted Blueprint runs and `.env`
If a Blueprint install/remove is killed mid-flight it can leave `.env` re-quoted and a stale `.blueprint/lock`. If the panel starts 500-ing with database errors after an interrupted run, restore `.env` from your backup, then run `blueprint -unlock` and `php artisan config:clear`.
:::

## Uninstall (Blueprint)

```bash
blueprint -r apple
```

The uninstaller restores the stock dashboard from its backup and makes a best-effort pass at removing Apple's settings (`apple::*` rows in the panel `settings` table). Your servers, users and other extensions are untouched, and the admin area returns to the stock layout immediately.

## Uninstall (standalone)

```bash
export PTERODACTYL_DIRECTORY="$PANEL"
bash standalone/data/remove.sh
```

This removes the wrapper include from the admin layout, restores the stock dashboard and deletes Apple's settings rows. Theme files under `public/apple` and `resources/views/apple` can then be removed manually.
