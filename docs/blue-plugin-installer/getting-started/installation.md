---
title: Installation
description: Install Blue Plugin Installer on a Pterodactyl panel via Blueprint or the standalone manual path.
---

# Installation

Blue Plugin Installer installs on any Blueprint-enabled Pterodactyl panel. Two distributions are available in every release zip (`blue-plugin-installer-vX.Y.Z.zip`):

- `blueprint/` — the `.blueprint` package, installed with the Blueprint CLI (**recommended**)
- `standalone/` — all extension files plus a manual-installation guide (for panels where the CLI can't run)

## Prerequisites

- Pterodactyl Panel **1.11.x – 1.14.x** (tested on **1.14.1**)
- Blueprint framework `beta-2026-01`, `beta-2026-02`, `beta-2026-05`, or `beta-2026-06`
- Root or sudo SSH access to the panel server
- Outbound HTTPS from the panel to `api.modrinth.com`, `api.curseforge.com`, `hangar.papermc.io`, `api.spiget.org`, and `api.polymart.org`
- A **CurseForge API key** — only if you want CurseForge results. Create one at <https://console.curseforge.com/>; the other providers work without any key.

## Blueprint install (recommended)

1. Download `blueplugininstaller-vX.Y.Z.blueprint` from the
   [latest release](https://github.com/AnAverageBeing/blue-plugin-installer/releases).

2. Copy it into your panel directory and run the installer:

   ```bash
   cp blueplugininstaller-vX.Y.Z.blueprint /var/www/pterodactyl/
   cd /var/www/pterodactyl
   blueprint -install blueplugininstaller-vX.Y.Z
   ```

3. Wait for Blueprint to finish — it rebuilds the panel frontend (`yarn build:production`), which can take a few minutes.

## Standalone (manual) install

If `blueprint -install` fails or you want to audit every change, follow
`standalone/INSTALLATION.md` inside the release zip. In short, you will:

1. Replace the `{identifier}` / `{version}` / `{author}` placeholders in all files.
2. Copy `controllers/` to `.blueprint/extensions/blueplugininstaller/app/` and symlink it to `app/BlueprintFramework/Extensions/blueplugininstaller`.
3. Copy `routes.php` to `.blueprint/extensions/blueplugininstaller/routers/client.php` and symlink it to `routes/blueprint/client/blueplugininstaller.php`.
4. Copy `controller.php` (renamed to `blueplugininstallerExtensionController.php`) and `view.blade.php` into the admin controller/view locations.
5. Register the extension (`.store/conf.yml`, `.store/Components.yml`, `installed_extensions`).
6. Copy `components/` and symlink it to `resources/scripts/blueprint/extensions/blueplugininstaller`, then add the navigation route to `resources/scripts/blueprint/extends/routers/routes.ts`.
7. Rebuild the frontend (`yarn build:production` as the web user) and clear caches.

::: warning The Blueprint framework is still required
"Standalone" replaces the **CLI**, not the framework — the controllers call
`BlueprintAdminLibrary` and the components import through the
`@/blueprint/extensions/*` webpack alias.
:::

## Post-install verification

- **Admin area**: open **Admin → Extensions → Blue Plugin Installer** (`/admin/extensions/blueplugininstaller`) and set the CurseForge API key.
- **Server area**: open any Minecraft server — a **Plugin Installer** tab appears in the sidebar (`/server/<id>/blueplugininstaller`).
- **Smoke test**: search for any plugin on Modrinth (no key needed). If results render, the extension is fully wired.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Sidebar tab missing after install | The frontend rebuild didn't finish. Run `sudo -u www-data yarn install && sudo -u www-data yarn build:production` in the panel dir (on Node ≥ 17 export `NODE_OPTIONS=--openssl-legacy-provider` first). |
| CurseForge errors / empty results | The API key in the admin settings is missing or invalid. Modrinth works without a key — use it to confirm the extension itself is fine. |
| Install fails | The panel could not download the file, or the node rejected the upload. Check `storage/logs` and Blueprint's debug log at `.blueprint/extensions/blueprint/private/debug/logs.txt`. |
| Search 500s with custom API clients | Upgrade to ≥ 1.0.3 — older builds 500'd when optional query params were omitted. |

## Uninstall

**Blueprint:**

```bash
cd /var/www/pterodactyl
blueprint -remove blueplugininstaller
```

**Standalone:** reverse the steps in `standalone/INSTALLATION.md` (remove the symlinks, copied files, registration entries, and the `routes.ts` lines, then rebuild the frontend and clear caches).
