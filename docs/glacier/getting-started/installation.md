---
title: Installation — Glacier
description: Install the Glacier theme on Pterodactyl Panel via Blueprint — prerequisites, verification, troubleshooting and uninstall.
---

# Installation

Glacier ships as a single `.blueprint` package and installs through the Blueprint CLI in one command.

## Prerequisites

| Requirement | Version |
| --- | --- |
| Pterodactyl Panel | **1.12.x** |
| Blueprint framework | **beta-2026-05** |
| PHP | **8.2+** (as required by the panel) |

::: warning Blueprint, not core edits
Glacier is a Blueprint extension. It does not patch Pterodactyl core files, so panel updates keep working — but Blueprint itself must be installed and healthy first. Verify with `blueprint -v` on the panel server.
:::

## Install

1. Download `glacier-v1.0.0.blueprint` and place it in the panel root (usually `/var/www/pterodactyl`).
2. From the panel root, run:

   ```bash
   blueprint -i glacier-v1.0.0
   ```

3. Open **Admin → Extensions → Glacier**. Defaults apply on first load — the panel is already themed before you touch a setting.

::: tip First-load behavior
On its very first page load Glacier seeds every `glacier::*` setting with the documented defaults. Nothing is written to your servers, nodes, or other extensions — only rows in the panel's own settings store.
:::

## Post-install verification

1. **The sidebar appears** on the left of every client page, replacing the top navigation.
2. **Admin → Extensions → Glacier** loads the settings hub with the Appearance tab open and a live preview.
3. **Hard-refresh once** (`Ctrl+Shift+R`) so your browser picks up the new assets. Glacier cache-busts its own assets on every save, but the first load after install may race an old cached page.

If the panel ever looks unstyled after an update, clear the compiled views:

```bash
php artisan view:clear
```

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `blueprint -i` says the package is invalid | Upload was corrupted or renamed | Re-download; keep the exact filename `glacier-v1.0.0.blueprint` |
| Extension not listed under Admin → Extensions | Blueprint cache | Run `blueprint -l` to list installed extensions; re-run the install |
| Pages render but look stock | Browser or view cache | `php artisan view:clear` + hard-refresh |
| Styles missing only for admins | Same as above, admin wrapper | Same fix — both wrappers are cache-busted on save |
| Background image doesn't show | URL not reachable by browsers, or blocked hotlinking | Use the upload field instead of a URL — uploaded files are served from your own panel |
| Settings don't save (validation error) | A field outside its documented range | Check the red field hint against the [Configuration Reference](../../configuration/reference.md) |

## Uninstall

```bash
blueprint -r glacier
```

The uninstaller makes a best-effort pass at removing Glacier's settings (`glacier::*` rows in the panel `settings` table). Your servers, users and other extensions are untouched, and the panel returns to the stock layout immediately.

::: danger Other extensions' theme settings
Glacier only removes its own `glacier::*` rows. If you installed other Blueprint themes previously, their leftovers are *not* Glacier's to clean — remove them with their own uninstallers.
:::
