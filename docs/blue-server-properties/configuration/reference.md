---
title: Configuration Reference
description: Every Blue Server Properties Editor setting — the admin option, editor behavior, and the conf.yml manifest.
---

# Configuration Reference

## Admin settings

Managed at **Admin → Extensions → Blue Server Properties Editor** (`/admin/extensions/blueserverproperties`).

| Setting | Type | Default | Description |
|---|---|---|---|
| `navbar_text` | string (max 30, required) | `Server Properties` | Label of the sidebar tab shown inside servers. Stored in `storage/app/blueserverproperties_config.json` (not the database) and served to the frontend via `GET /api/client/extensions/blueserverproperties/settings/nav-text`. Applied live by the `NavButtonUpdater` components on every server page. |

::: warning Blueprint paths only
The admin page, the config JSON, and the live label updates are Blueprint-only.
On the Blueprint-free (`data/PanelFiles/`) path the tab is always named
`Server Properties`.
:::

## Editor behavior (built-in)

These are hard-coded editor behaviors, documented so you know what to expect:

| Behavior | Detail |
|---|---|
| Key normalization | `server.properties` keys are shown with dashes instead of dots (`view-distance` ↔ `view.distance`). The editor maps them back on save. |
| Boolean keys | Any key whose value is `true`/`false` renders as a **toggle**. |
| `difficulty` | Dropdown: `peaceful`, `easy`, `normal`, `hard`. |
| `gamemode` | Dropdown: `survival`, `creative`, `hardcore`, `adventure`, `spectator`. |
| Everything else | Plain text input. |
| Comments & unknown lines | Preserved verbatim on save — only `key=value` lines are rewritten. |
| Nest restriction | Only servers in the Minecraft nest (ID `1`) can use the editor; the backend rejects others. |

## Extension manifest (`conf.yml`)

Located at `blueprint/blueserverproperties/conf.yml` in the repo. You normally never edit these — Blueprint reads them at install time.

| Key | Value | Purpose |
|---|---|---|
| `info.identifier` | `blueserverproperties` | Extension identifier — used in all paths and URLs. |
| `info.version` | `1.12.4` | Extension version (shown on the admin page). |
| `info.target` | `beta-2026-06` | Blueprint version the extension targets. |
| `info.compatibility` | `beta-2026-01/02/05/06` | Blueprint versions accepted at install time. |
| `admin.view` / `admin.controller` | `view.blade.php` / `controller.php` | The admin settings page. |
| `dashboard.components` | `components` | React components (editor + `NavButtonUpdater`). |
| `data.directory` | `data` | Ships `data/PanelFiles/`, the Blueprint-free variant. |
| `requests.app` | `controllers` | Client API controllers. |
| `requests.routers.client` | `routes.php` | Client API router, mounted at `/api/client/extensions/blueserverproperties`. |
