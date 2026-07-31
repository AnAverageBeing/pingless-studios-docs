---
title: Installation
description: Install Blue Mod Installer on a Pterodactyl panel via Blueprint or the standalone manual path.
---

# Installation

Blue Mod Installer installs on any Blueprint-enabled Pterodactyl panel. Two distributions are available in every release zip (`blue-mod-installer-vX.Y.Z.zip`):

- `blueprint/` — the `.blueprint` package, installed with the Blueprint CLI (**recommended**)
- `standalone/` — all extension files plus a manual-installation guide (for panels where the CLI can't run)

## Prerequisites

- Pterodactyl Panel **1.11.x – 1.14.x** (tested on **1.14.1**)
- Blueprint framework `beta-2026-01`, `beta-2026-02`, `beta-2026-05`, or `beta-2026-06`
- Root or sudo SSH access to the panel server
- Outbound HTTPS from the panel to `api.modrinth.com` and `api.curseforge.com`
- A **CurseForge API key** — only if you want CurseForge results. Create one at <https://console.curseforge.com/>; Modrinth works without any key.

## Blueprint install (recommended)

1. Download `bluemodinstaller-vX.Y.Z.blueprint` from the
   [latest release](https://github.com/AnAverageBeing/blue-mod-installer/releases).

2. Copy it into your panel directory and run the installer:

   ```bash
   cp bluemodinstaller-vX.Y.Z.blueprint /var/www/pterodactyl/
   cd /var/www/pterodactyl
   blueprint -install bluemodinstaller-vX.Y.Z
   ```

3. Wait for Blueprint to finish — it rebuilds the panel frontend (`yarn build:production`), which can take a few minutes.

## Standalone (manual) install

If `blueprint -install` fails or you want to audit every change, follow
`standalone/INSTALLATION.md` inside the release zip. In short, you will:

1. Replace the `{identifier}` / `{version}` / `{author}` placeholders in all files.
2. Copy `controllers/` to `.blueprint/extensions/bluemodinstaller/app/` and symlink it to `app/BlueprintFramework/Extensions/bluemodinstaller`.
3. Copy `routes.php` to `.blueprint/extensions/bluemodinstaller/routers/client.php` and symlink it to `routes/blueprint/client/bluemodinstaller.php`.
4. Copy `controller.php` (renamed to `bluemodinstallerExtensionController.php`) and `view.blade.php` into the admin controller/view locations.
5. Register the extension (`.store/conf.yml`, `.store/Components.yml`, `installed_extensions`).
6. Copy `components/` and symlink it to `resources/scripts/blueprint/extensions/bluemodinstaller`, then add the navigation route to `resources/scripts/blueprint/extends/routers/routes.ts`.
7. Rebuild the frontend (`yarn build:production` as the web user) and clear caches.

::: warning The Blueprint framework is still required
"Standalone" replaces the **CLI**, not the framework — the controllers call
`BlueprintAdminLibrary` and the components import through the
`@/blueprint/extensions/*` webpack alias.
:::

## Post-install verification

- **Admin area**: open **Admin → Extensions → Blue Mod Installer** (`/admin/extensions/bluemodinstaller`). Set the CurseForge API key, default provider, and items per page.
- **Server area**: open any Minecraft server — a **Mod Installer** tab appears in the sidebar (`/server/<id>/bluemodinstaller`).
- **Smoke test**: search for any mod on Modrinth (no key needed). If results render, the extension is fully wired.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Sidebar tab missing after install | The frontend rebuild didn't finish. Run `sudo -u www-data yarn install && sudo -u www-data yarn build:production` in the panel dir (on Node ≥ 17 export `NODE_OPTIONS=--openssl-legacy-provider` first). |
| CurseForge errors / empty results | The API key in the admin settings is missing or invalid. Modrinth works without a key — use it to confirm the extension itself is fine. |
| Install fails with a 503 | The panel can't reach the provider, or the node rejected the file pull. Check `storage/logs` and Blueprint's debug log at `.blueprint/extensions/blueprint/private/debug/logs.txt`. |
| Search 500s with custom API clients | Upgrade to ≥ 1.12.4 — older builds 500'd when optional query params were omitted. |

## Uninstall

**Blueprint:**

```bash
cd /var/www/pterodactyl
blueprint -remove bluemodinstaller
```

**Standalone:** reverse the steps in `standalone/INSTALLATION.md` (remove the symlinks, copied files, registration entries, and the `routes.ts` lines, then rebuild the frontend and clear caches).
