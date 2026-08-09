---
title: Addons Guide — Glacier Pack
description: What each of the 24 Glacier Pack addons does, where it lives in the hub, what users see on the client side, and practical usage notes.
outline: deep
---

# Addons Guide

One compact brief per addon: what it does, where it lives in the hub, its client-facing surface, and the things worth knowing before you rely on it. Settings and defaults for each addon are in the [Configuration Reference](../configuration/reference.md).

---

## Basic pack

### Recycle Bin

Deleted files move to a hidden `/.trash` folder instead of vanishing, with per-server quotas, per-egg retention windows, collision-safe restore (`name (restored)`), and an hourly purge.

- **Hub:** `?a=recycle-bin` — single pane (settings, storage overview, top servers, per-egg overrides).
- **Client surface:** server file manager — a Recycle Bin toolbar button plus restore / empty-bin / permanent-delete flows, gated by the `trashbinpro.access` subuser permission.
- Trashed files count against the server's real disk quota — set a capacity on shared nodes (`0` = unlimited).
- **Requires a frontend rebuild** (`yarn build:production`) after install and again after uninstall; re-run `install.sh` after panel updates.

### URL Download

Users paste one or more remote URLs into a guided file-manager modal and the panel fetches the files straight into the server through Wings — no SFTP round-trip.

- **Hub:** `?a=url-download` — single settings pane (policy, throughput, client experience, safeguards, history).
- **Client surface:** server file manager — a toolbar button (label configurable) with a step-by-step modal, progress popup or floating deck, and per-user URL memory chips.
- Pre-flight checks include scheme/extension allow-lists and a remote HEAD probe; conflicts auto-rename, overwrite or skip per file.
- Transfers run on the node via the native `files/pull` endpoint — a healthy panel↔Wings link is required.

### Config Editor

Edit the panel's `.env` safely from the browser: structured rows grouped by prefix, secret masking, validation, review-before-save, and atomic writes with 10 rotating backups.

- **Hub:** `?a=config-editor` — sub-tabs **Editor** and **Raw file**.
- **Client surface:** none (admin-only tool).
- Never edit `APP_KEY` — encrypted panel data becomes unreadable. Changing session/cache keys logs everyone out.
- Requires the `.env` to be writable by the webserver user; otherwise the pane is read-only.

### Console Log Share

Copy-to-clipboard and one-click upload of the server console log to an mclogs-compatible paste service, proxied through the panel.

- **Hub:** `?a=console-log-share` — single settings pane (endpoint, enable, placement) with a reset action.
- **Client surface:** server console page — a Copy Log / Share Log bar above or below the terminal, gated by `websocket.connect`.
- ANSI codes are stripped server-side; oversized logs are trimmed to the configured cap.
- The paste endpoint must be the mclogs-compatible **API** URL (default `https://api.mclo.gs/1/log`).

### Login Activity

Records every successful sign-in (password, 2FA, remember-me) with IP, user agent and timestamp.

- **Hub:** `?a=login-activity` — single read-only pane with user and date-range filters.
- **Client surface:** a Login Activity section on the account page (`/account`) showing each user their own history with browser/OS summaries.
- Recording failures never block sign-in; history is kept on uninstall unless you pass `--drop-table`.
- Users only ever see their own records through the client API.

### Move Files

Upgrades the file manager's move/copy UX: a browsable destination tree, copy-to-anywhere, overwrite confirmation, progress feedback, rename-while-moving and create-folder-in-dialog.

- **Hub:** `?a=move-files` — informational card only; the addon has no settings.
- **Client surface:** server file manager move dialog and per-file Copy action.
- Frontend-only — no routes, tables or backend; all operations go through the panel's existing client API with the user's own permissions.
- Hard-refresh the Files page after install; re-run `install.sh` after panel updates overwrite the patched template.

### Node Status

Per-server uptime tracking: status banners, daily uptime strips, incident timelines with reasons, node health views, and admin-posted service updates with optional countdowns.

- **Hub:** `?a=node-status` — sub-tabs **Overview** (settings + per-node overrides) and **Service Updates**.
- **Client surface:** two server sub-navigation tabs — **Uptime** and **Service updates** — gated by the `uptime.read` subuser permission.
- The panel polls Wings on a schedule — the standard panel cron must be running; no agent on nodes.
- Real node names are hidden from users unless you enable them; tracking can be toggled per node.

### Panel Logs

A live view of the panel's own `storage/logs/*.log` files without SSH: tail viewer, level filters with counters, auto-refresh, download, clear and delete.

- **Hub:** `?a=panel-logs` — **Log files** tab plus a viewer tab that opens per file.
- **Client surface:** none (admin-only tool).
- Stack traces stay grouped; the viewer pauses when the tab is hidden and recovers from log rotation on its own.
- Root-admin only, strict filename validation; the panel recreates a cleared log automatically.

### Resource Alerts

Watches CPU, memory, disk and network throughput of every server and notifies you the moment a server crosses a threshold — by email and optional Discord/Slack webhooks.

- **Hub:** `?a=resource-alerts` — sub-tabs **Overview**, **Rules**, **History**, **Settings**.
- **Client surface:** none; delivery is email + webhooks.
- Rules layer global → per-node → per-server (most specific wins) and fire only after N consecutive 1-minute samples — no flapping, with automatic recovery notices.
- Requires the panel cron (one sample per minute); use **Send Test Alert** after configuring channels.

---

## Advanced pack

### Backup Pro

Scheduled server backups to any S3-compatible storage (AWS, Cloudflare R2, Backblaze B2, Wasabi, MinIO, Spaces) using the panel's native backup pipeline, with retention policies, offload, restore and notifications.

- **Hub:** `?a=backup-pro` — sub-tabs **Overview**, **Destinations**, **Backup Rules**, **Backups**, **Archives**, **Activity**, **Settings**.
- **Client surface:** server backups page — a "protected by S3" banner, per-backup cloud badges, optional click-to-sync, and (when enabled) cloud download/restore.
- Rules combine two modes — mirror existing backups and/or create on a schedule — against all servers, a node, or hand-picked servers; credentials are encrypted with the panel app key.
- Pending uploads with a red cloud icon almost always mean the queue worker (`standard` queue) is not running.

### Database Manager

One-click `.sql` export and streamed import for panel-managed MySQL databases, straight from the server's Databases page — no phpMyAdmin, no shared credentials.

- **Hub:** `?a=database-manager` — single pane (limits, toggles, recent operations log).
- **Client surface:** server Databases page — per-database Export and Import actions, gated by the `databasemanager.export` / `databasemanager.import` subuser permissions.
- Exports use `--single-transaction` so InnoDB stays writable; optional wipe-before-import when you allow it.
- Requires `mysqldump`/`mysql` client binaries on the panel host; raise PHP upload limits before raising the import cap.

### Mod Installer

Browse, search and install Minecraft mods from Modrinth and CurseForge directly on the server page; the panel resolves the URL and Wings fetches the file into `/mods`.

- **Hub:** `?a=mod-installer` — single settings pane (CurseForge key, default provider, default loader) with provider status badges.
- **Client surface:** a **Mods** tab on every server's navigation with loader/version filters and a versions dialog; browsing needs `file.read`, installing needs `file.create`.
- Modrinth works out of the box; CurseForge unlocks once you save an API key from the CurseForge console.
- Panel needs outbound HTTPS to the catalogue APIs; nodes must reach the mod CDNs.

### Modpack Installer

One-click Modrinth and CurseForge modpack installs from the file manager — full version lists, a confirmation screen with exact file counts, and live per-file progress.

- **Hub:** `?a=modpack-installer` — single settings pane with health badges, usage counters and recent installs.
- **Client surface:** a **Modpacks** button in the server file manager opening the browse/install wizard, plus per-server install history.
- Everything ships to the node as a single bundle pulled via the native `files/pull` endpoint and extracted via `files/decompress`; client-only mods and third-party-opt-out files are auto-skipped and listed up front.
- Installs files only — egg, Docker image and startup jar are untouched; requires the PHP `zip` extension and a writable staging directory (both shown as pane badges).

### Node Stats

Fleet-wide analytics: CPU/RAM/disk/bandwidth time-series, per-node drill-downs, multi-tier historical aggregates, capacity exhaustion forecasts, top consumers, and downloadable daily/weekly/monthly reports.

- **Hub:** `?a=node-stats` — sub-tabs **Overview**, **Nodes**, **Capacity**, **Historical**, **Top Consumers**, **Reports**, **Settings**.
- **Client surface:** none (admin-only dashboards).
- Charts use a locally bundled Chart.js — zero external requests.
- Needs both the panel cron **and** a Supervisor worker on the `nodeanalytics` queue (`data/install-queue-worker.sh` sets it up); empty dashboards mean one of the two is missing.

### Permission Manager

Delegate admin work safely: staff roles, members, scoped assignments and a restricted staff area at `/admin/staff` — without ever granting `root_admin`.

- **Hub:** `?a=permission-manager` — sub-tabs **Overview**, **Roles**, **Members**, **Audit Log**.
- **Client surface:** no new client pages — staff reach in-scope servers as real, auto-provisioned Pterodactyl subusers (default: console, power actions, file read), enforced natively by the panel.
- Roles control which staff pages open, whether members see all or only assigned users/servers, and whether they may edit server build configuration; every write lands in the audit log.
- Role deletion is refused while members are assigned; before uninstalling, remove members or run `php artisan permgr:sync` so no provisioned subusers remain.

### Player List

A live online-player card with an `online / max` badge on the server console page, self-refreshing without reloads.

- **Hub:** `?a=player-list` — single settings pane (enable, protocol, timeout/cache/refresh) with a built-in host:port test tool.
- **Client surface:** server console page — a Players card beneath the terminal polling the client API at your configured interval.
- UDP query returns the full list but needs `enable-query=true`; the status-ping fallback needs no setup but returns only a name sample (flagged as such).
- Results are cached per server to avoid query floods; degrades quietly when a server is offline.

### Player Manager

Manage Minecraft Java players over plain RCON from the client panel: online list, kick/ban/unban, op/deop and whitelist management. Nothing is installed on the node.

- **Hub:** `?a=player-manager` — single settings pane (enable, default port, timeouts) plus the stored-credentials table.
- **Client surface:** a **Players** page on every server's navigation, including a per-server RCON connection form (stored encrypted); viewing needs `websocket.connect`, actions need `control.console`, and every action hits the activity log.
- Each server needs `enable-rcon=true`, `rcon.port` and `rcon.password` in `server.properties`, with the RCON port reachable from the panel host.
- Credentials resolve per-server override → `RCON_PASSWORD`/`RCON_PORT`/`RCON_HOST` server variables → defaults.

### Plugin Installer

Search Modrinth, Hangar, Spiget, CurseForge and Polymart from the server page and install plugins straight into `/plugins` — with an installed-plugin library and SHA-512 update hints.

- **Hub:** `?a=plugin-installer` — single settings pane (provider toggles, CurseForge key, install directory, analysis cap).
- **Client surface:** a **Plugins** page on every server's navigation with provider/software/version filters, per-release install buttons, and an Installed tab with one-click updates; browsing needs `file.read`, installing needs `file.create`.
- Premium/external resources are marked and never pulled; CurseForge and Polymart are off by default.
- Wings performs the actual downloads — nodes must reach the provider CDNs.

### Server Importer

Move servers from another Pterodactyl panel using the source's Application API: stored connections, inventory fetch, dry run with a full conflict report, execution, and one-click rollback.

- **Hub:** `?a=server-importer` — sub-tabs **Overview** and **Run report**.
- **Client surface:** none (root-admin tool).
- A dry run creates nothing — it reports user matches, egg matches, allocation claims and dropped environment values; claims are re-verified before execution, and rollback force-deletes everything a run created.
- Needs a `ptla_…` key on the source panel with read access to servers, users, nodes, nests and eggs, and a target node with enough free allocations.

### Server Properties

A friendly, categorized `server.properties` editor for Minecraft servers: typed inputs (toggles, dropdowns, clamped numbers), per-key descriptions, live search and dirty tracking.

- **Hub:** `?a=server-properties` — single settings pane (tab label, file name, allowed nests, descriptions).
- **Client surface:** a **Properties** tab on eligible servers (default: nest `1`, the stock Minecraft nest); reads need `file.read-content`, writes need `file.update`.
- Writes go through the panel's Wings file repository — comments, blank lines and key order survive; unknown keys land under "Other".
- Changes apply after a server restart — Minecraft reads the file at boot.

### Staff Requests

Users request server access from each other — by server ID or owner email — with owner approval, three permission presets, temporary access, blocking and a full audit trail. Approved requests create real subusers.

- **Hub:** `?a=staff-requests` — single pane (access policy, limits, stats, read-only requests/grants/audit tables).
- **Client surface:** Account → Staff Requests (`/account/server-access`) plus an Access Manager shortcut on the server Users page for owners and holders of the `accessmanager.manage` permission.
- Temporary access (1 hour to 30 days) is revoked automatically by the panel cron, including SFTP session invalidation.
- The email flow never reveals account existence; uninstalling does not remove already-granted subusers.

### Subdomain Manager

Self-service DNS for game servers: users create A and SRV records on the Network page, provisioned through the Cloudflare API against zones you control.

- **Hub:** `?a=subdomain-manager` — sub-tabs **Settings**, **Domains**, **Records**.
- **Client surface:** a Subdomains card on the server Network page, gated by the `subdomainplus.read` / `create` / `delete` subuser permissions.
- SRV records point at stable per-allocation hostnames that survive IP changes; records are always created unproxied.
- Per domain you can restrict eggs, ban names via regex, force a target IP, and define SRV presets; keep the panel cron running for sync and orphan cleanup.

### Version Changer

Let users switch a server's Minecraft: Java Edition version from the panel — official Mojang releases, snapshots and historic builds, with automatic jar backups and optional startup-variable updates.

- **Hub:** `?a=version-changer` — single settings pane plus a recent-changes table.
- **Client surface:** a Version Changer card on the server Startup page; viewing needs `file.read`, installing needs `file.create`.
- Jar downloads are pinned to official Mojang hosts regardless of the manifest endpoint; the previous jar is renamed to `<name>.backup-<timestamp>` before writing.
- The running process keeps the old jar until the next restart — tell users to restart after switching.

---

## What's Next?

- **[Configuration Reference →](../configuration/reference.md)** — every setting on every pane, with defaults.
- **[The Hub Dashboard →](./dashboard.md)** — layout, sub-tabs and the save round-trip.
