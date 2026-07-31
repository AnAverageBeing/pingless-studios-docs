---
title: Installation
description: Install Blue Server Properties Editor — Blueprint, standalone manual, or the Blueprint-free PanelFiles path.
---

# Installation

Blue Server Properties Editor supports **three** install paths — more than any
other PingLess panel addon:

| Path | When to use |
|---|---|
| **Blueprint** (recommended) | Blueprint CLI available on the panel |
| **Standalone (manual)** | Blueprint framework present, but the CLI fails or you want to audit changes |
| **Blueprint-free** (`data/PanelFiles/`) | Panels with **no Blueprint at all** |

Every release zip (`blue-server-properties-vX.Y.Z.zip`) contains `blueprint/`
(the `.blueprint` + guide) and `standalone/` (all files + guide, including the
PanelFiles tree).

## Prerequisites

- Pterodactyl Panel **1.11.x – 1.14.x** (tested on **1.14.1**)
- For the Blueprint paths: Blueprint framework `beta-2026-01`, `beta-2026-02`, `beta-2026-05`, or `beta-2026-06`
- Root or sudo SSH access to the panel server
- At least one **Minecraft** server (the editor only works on nest ID `1`)

## Blueprint install (recommended)

1. Download `blueserverproperties-vX.Y.Z.blueprint` from the
   [latest release](https://github.com/AnAverageBeing/blue-server-properties/releases).

2. Copy it into your panel directory and run the installer:

   ```bash
   cp blueserverproperties-vX.Y.Z.blueprint /var/www/pterodactyl/
   cd /var/www/pterodactyl
   blueprint -install blueserverproperties-vX.Y.Z
   ```

3. Wait for Blueprint to finish — it rebuilds the panel frontend (`yarn build:production`).

## Standalone (manual) install

Follow `standalone/INSTALLATION.md` in the release zip: replace placeholders,
place controllers/router/admin files, register the extension
(`.store/conf.yml`, `installed_extensions`), copy + symlink components, add the
`routes.ts` navigation entry and the optional `NavButtonUpdater` wrapper
injections, then rebuild the frontend and clear caches.

::: warning The Blueprint framework is still required for this path
"Standalone" replaces the **CLI**, not the framework — the admin controller
uses `BlueprintAdminLibrary` and the components import through the
`@/blueprint/extensions/*` alias. For a truly Blueprint-free panel, use the
next section.
:::

## Blueprint-free install (no Blueprint at all)

The extension ships a second, genuinely Blueprint-free variant inside
`data/PanelFiles/` (a mirror of the panel tree — it only **adds** files). Full
steps are in `standalone/INSTALLATION.md`; in short:

1. Back up `routes/api-client.php` and `resources/scripts/routers/routes.ts`.
2. `cp -a data/PanelFiles/. /var/www/pterodactyl/`
3. Register the API routes in `routes/api-client.php` inside the `/servers/{server}` group:

   ```php
   Route::group(['prefix' => '/servercfg', 'middleware' => [Pterodactyl\Http\Middleware\Api\Client\Server\MinecraftServerCheck::class]], function () {
       Route::get('/', [Pterodactyl\Http\Controllers\Api\Client\Servers\ServerConfigEditorController::class, 'fetch']);
       Route::post('/update', [Pterodactyl\Http\Controllers\Api\Client\Servers\ServerConfigEditorController::class, 'update']);
   });
   ```

4. Register the frontend route in `resources/scripts/routers/routes.ts`:

   ```ts
   import ServerConfigEditor from '@/components/server/servercfg/ServerConfigEditor';
   // in the `server` array:
   { path: '/servercfg', permission: null, name: 'Server Properties', component: ServerConfigEditor },
   ```

5. `yarn build:production` as the web user, clear caches, fix ownership.

**Limitations of this path:** no admin settings page and no custom navbar text
(those are Blueprint-only). The tab appears on non-Minecraft servers too, but
the middleware/backend reject them.

## Post-install verification

- **Admin area** (Blueprint paths): **Admin → Extensions → Blue Server Properties Editor** — set the sidebar button text.
- **Server area**: open a Minecraft server — the **Server Properties** tab appears in the sidebar (`/server/<id>/servercfg`) and lists the live config.
- **Smoke test**: toggle any value, save, and confirm the change landed in the server's `server.properties` (Files → open the file).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Sidebar tab missing after install | Rebuild the frontend: `sudo -u www-data yarn install && sudo -u www-data yarn build:production` (on Node ≥ 17 export `NODE_OPTIONS=--openssl-legacy-provider` first). |
| "This feature is only available for Minecraft servers" | Expected on non-Minecraft nests (the editor targets nest ID `1`). |
| "Unable to retrieve server configuration file." | The server has no `server.properties` in its root, or Wings could not read it. Check the node/Wings logs. |
| Custom button text not applying | Hard-refresh the browser; the label is fetched from `/api/client/extensions/blueserverproperties/settings/nav-text` on each page. |

## Uninstall

**Blueprint:**

```bash
cd /var/www/pterodactyl
blueprint -remove blueserverproperties
```

**Standalone / Blueprint-free:** reverse the documented steps — remove the
placed files and symlinks, revert the `routes.ts` / `api-client.php` edits
(restore the `.bak-servercfg` backups on the Blueprint-free path), then rebuild
the frontend and clear caches.
