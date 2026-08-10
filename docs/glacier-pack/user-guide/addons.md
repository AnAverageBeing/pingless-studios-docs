---
title: Addons Guide — Glacier Pack
description: What each of the 46 Glacier Pack addons does, where it lives in the hub, what users see on the client side, and practical usage notes.
outline: deep
---

# Addons Guide

One compact brief per addon: what it does, where it lives in the hub, its client-facing surface, and the things worth knowing before you rely on it. Settings and defaults for each addon are in the [Configuration Reference](../configuration/reference.md).

---

## Basic pack

### Audit Log

A chronological, filterable trail of everything the panel's stock activity feed records — sign-ins, server power actions, configuration changes, API calls — without SSH or external tools.

- **Hub:** `?a=audit-log` — single pane (filter bar, per-entry detail dialog, retention tools).
- **Client surface:** none (root-admin tool).
- One search box matches event names, descriptions, IPs, entry details, actor usernames and API key identifiers; scope, actor-type and date-range filters narrow the feed further.
- Retention tools prune entries older than a chosen number of days or clear the log entirely, both behind confirmation prompts.
- Zero schema changes — the addon ships no tables and no middleware; it reads the `activity_logs` the panel already writes.

### Auto Suspend

Give any server an expiry date and let the panel enforce it: the owner is warned by email before the date, the server suspends itself when the date passes, and — optionally — servers that outstay a grace period are deleted. Built for trials, prepaid plans and demo machines.

- **Hub:** `?a=auto-suspend` — sub-tabs **Overview**, **Servers** (searchable list with an inline expiry form per row), **History**, **Settings**.
- **Client surface:** an "Expires in Nd" countdown chip on dashboard server cards (amber near the date, red once overdue) plus a slim notice inside the server view.
- Extending a suspended server's expiry into the future lifts the suspension automatically on the next scheduler pass; only addon-applied suspensions are auto-delete eligible — manual suspensions are never deleted.
- Everything runs on the stock panel cron (`auto-suspend:process` every five minutes); warning emails use the panel's mail settings.
- Every warning, suspension, lift and deletion lands in the History pane with server name and context; rows survive the servers they describe.

### Command History

Persistent, per-server console command history: every command sent from a server's console page is stored with sender and timestamp, and the whole server team can re-run a previous command with one click.

- **Hub:** `?a=command-history` — sub-tabs **Overview** (capture status, totals, per-server counts, the 25 most recent commands panel-wide, per-server and purge-everything actions) and **Settings**.
- **Client surface:** a History button anchored on the console input opens a dropdown of the server's recent commands — clicking one loads it back into the command line; a footer action clears the list. Gated by `websocket.connect`, the same permission the console needs.
- Each server keeps only its newest entries (default 200, adjustable 50–1000); sending the same command twice in a row is not double-stored, and the dropdown shows the 50 newest.
- Delivered as static assets through the template wrapper — no `yarn build`.

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

Records every successful sign-in (password, 2FA, remember-me) with IP, user agent and timestamp, resolves each login to a coarse location with VPN/proxy badging, and mirrors live sessions with the power to revoke them.

- **Hub:** `?a=login-activity` — sub-tabs **Logins** (full history with user and date-range filters) and **Sessions** (live sessions with user filter, per-row revoke and revoke-all for a compromised account).
- **Client surface:** Login Activity and Active Sessions panels on the account page (`/account`) — users review their own history with browser/OS summaries and locations, and revoke any of their own sessions except the current one.
- Geolocation uses the keyless ipwho.is endpoint, one lookup per unique IP per cache window (default 30 days), cached and fail-safe; disable it entirely with `LOGIN_ACTIVITY_GEO=false`. VPN/proxy flags come from a network-name heuristic, or an optional free proxycheck.io key for an authoritative verdict.
- A revoked session is logged out on its very next request; users only ever see their own records through the client API.

### Move Files

Upgrades the file manager's move/copy UX: a browsable destination tree, copy-to-anywhere, overwrite confirmation, progress feedback, rename-while-moving and create-folder-in-dialog.

- **Hub:** `?a=move-files` — informational card only; the addon has no settings.
- **Client surface:** server file manager move dialog and per-file Copy action.
- Frontend-only — no routes, tables or backend; all operations go through the panel's existing client API with the user's own permissions.
- Hard-refresh the Files page after install; re-run `install.sh` after panel updates overwrite the patched template.

### Node Status

Per-server uptime tracking: status banners, daily uptime strips, incident timelines with reasons, node health views, and admin-posted service updates with optional countdowns. Plus a toggleable public status page, custom HTTP/TCP/UDP monitors, Discord incident alerts and panel-measured latency.

- **Hub:** `?a=node-status` — sub-tabs **Overview** (settings + per-node overrides), **Monitors** (custom endpoints), **Sharing & Alerts** (public page + Discord) and **Service Updates**.
- **Client surface:** two server sub-navigation tabs — **Uptime** and **Service updates** — gated by the `uptime.read` subuser permission, plus an unauthenticated public `/status` page with a JSON feed (`/api/uptime-public/summary`) when enabled.
- Custom monitors track any external HTTP(S)/TCP/UDP endpoint alongside your nodes, with their own incident history and pause/resume; every collection tick also records round-trip latency for nodes and monitors.
- The panel polls Wings on a schedule — the standard panel cron must be running; no agent on nodes. The public page is rate-limited, `noindex`, and never exposes node FQDNs.
- Real node names are hidden from users unless you enable them; tracking can be toggled per node.

### PWA

Turns the whole panel into an installable app: browsers offer *Add to Home Screen* / *Install*, the panel launches in its own window with its own icon and splash colors, repeat visits load faster thanks to a service-worker cache, and users see a branded offline page instead of the browser's error page when the network drops.

- **Hub:** `?a=pwa` — single settings pane (identity, appearance, icons, caching, offline page, install prompt) with live links to all endpoints and a one-click reset.
- **Client surface:** panel-wide — a dynamic manifest at `/pwa/manifest.json`, the service worker at `/pwa-sw.js`, an offline fallback at `/pwa/offline`, and a dismissible install banner (stays hidden seven days once dismissed; on iOS it shows *Share → Add to Home Screen* instructions).
- Cache-first or network-first strategy for static assets, optional network-first caching of client API reads, and per-entry maximum cache age; admin pages, auth pages and `no-store` responses are never cached.
- Switching the feature off makes every client unregister the service worker and purge its caches on the next page load. Requires HTTPS in production (localhost is exempt); off by default.

### Panel Logs

A live view of the panel's own `storage/logs/*.log` files without SSH — and of any other log directories you point it at, such as the web server's or the Wings daemon's: tail viewer, level filters with counters, auto-refresh, download, clear and delete.

- **Hub:** `?a=panel-logs` — **Log files** tab (grouped per source) plus a viewer tab that opens per file.
- **Client surface:** none (admin-only tool).
- Sources are grouped by directory: the panel's `storage/logs` plus auto-detected Nginx (`/var/log/nginx`) and Wings (`/var/log/pterodactyl`) directories and any extra sources you configure. Unreadable sources show a plain-language notice instead of breaking the page.
- Clear/delete stay available for panel logs but are hidden and refused server-side for external sources — the addon can never truncate your web server or daemon logs.
- Level filters understand Laravel stack traces plus Nginx error and Wings line formats; the viewer pauses when the tab is hidden and recovers from log rotation on its own.

### Quick Files

Users pin important files and folders in the server file manager; pinned items show up as one-click chips in a collapsible Quick Access bar above the file list, so `server.properties` or the plugin config folder is always one click away.

- **Hub:** `?a=quick-file-access` — single pane (enable toggle, per-server pin limit, usage stats, reset to defaults, clear every pin panel-wide).
- **Client surface:** server file manager — a star toggle on every row and the Quick Access bar with an *Open* / *Open Folder*, *Go to Location* and *Remove* context menu; `file.read` to view, `file.create` to pin.
- Pins belong to the server, not to one user — everyone with file access sees the same bar; the bar hides itself when a server has no pins.
- The re-check button re-validates every pin against live node listings and quietly drops pins whose target was deleted; directories that cannot be listed at that moment are left untouched, so a node hiccup never wipes pins.

### Recycle Bin

Deleted files move to a hidden `/.trash` folder instead of vanishing, with per-server quotas, per-egg retention windows, collision-safe restore (`name (restored)`), and an hourly purge.

- **Hub:** `?a=recycle-bin` — single pane (settings, storage overview, top servers, per-egg overrides).
- **Client surface:** server file manager — a Recycle Bin toolbar button opening a full bin browser (live search, five sort orders, multi-select, restore / permanent-delete / empty), gated by the `trashbinpro.access` subuser permission.
- Trashed text files preview inline and any trashed file downloads via a one-time Wings signed URL; every item carries an expiry badge, and a stats header shows item counts, total size and quota usage.
- An optional toggle reroutes "delete permanently" requests (UI or API) through the bin too; purges from inside the bin still destroy files.
- The client UI integrates at runtime — **no `yarn build`** (a compiled SPA integration remains optional); re-run `install.sh` after panel updates.
- Trashed files count against the server's real disk quota — set a capacity on shared nodes (`0` = unlimited).

### Resource Alerts

Watches CPU, memory, disk and network throughput of every server and notifies you the moment a server crosses a threshold — by email and optional Discord/Slack webhooks.

- **Hub:** `?a=resource-alerts` — sub-tabs **Overview**, **Rules**, **History**, **Settings**.
- **Client surface:** none; delivery is email + webhooks.
- Rules layer global → per-node → per-server (most specific wins) and fire only after N consecutive 1-minute samples — no flapping, with automatic recovery notices.
- Requires the panel cron (one sample per minute); use **Send Test Alert** after configuring channels.

### Schedule Presets

Administrators define named schedule templates (cron timing plus an ordered task list) once; server owners materialize them as real schedules from their server's schedules page in one click, or move schedules between servers as portable JSON documents.

- **Hub:** `?a=schedule-presets` — preset CRUD (five cron fields with a quick-pick, offer-to-users toggle, only-run-when-online flag, ordered task list) plus a global switch for user-side JSON exports.
- **Client surface:** a Schedule Presets card on the server schedules page — apply a preset with a live cron/task preview, Copy JSON and Import JSON; applying and importing require the `schedule.create` subuser permission and are rate-limited like stock schedule creation.
- The task editor covers the stock task types — send command, send power action, create backup (with ignored-files payload) — each with a time offset (0–900 s) and a continue-on-failure flag; cron expressions are validated server-side.
- Applying honors the per-schedule task limit and refuses backup tasks when the server's backup limit is 0; every apply/import lands in the server activity log. No Wings changes, no extra cron — everything rides the stock schedule engine.

### Server Timezone

Per-server timezone selection: owners pick any IANA zone from a searchable list with live clocks, and the panel feeds the zone to the container as the `TZ` environment variable so game processes, log timestamps and in-game clocks follow the server's own clock.

- **Hub:** `?a=server-time-changer` — single pane (master switch, navigation label, default timezone, every server override with per-row reset).
- **Client surface:** a **Timezone** tab on every server's navigation — ~430 searchable zones with current UTC offset and local time, plus a ticking server clock; reading needs `startup.read`, changing needs `startup.update`.
- The zone is injected through the panel's stock environment hook and synced to Wings on save; Docker cannot change a running container's environment, so the new zone applies at the next container (re)creation — the UI says exactly that.
- If the node is unreachable when a change is saved, the value is stored in the panel and delivered with the next successful sync. Container images need `tzdata` (every standard yolk ships it).
- Changes and resets are written to the panel's activity log.

### Server Wiper

Scheduled and on-demand file wipes — built for game hosts that rotate Rust/ARK maps, but useful for any server that needs logs, cache or player data cleared on a plan.

- **Hub:** `?a=server-wiper` — sub-tabs **Overview**, **Executions** and **Settings** (nav label, default timezone, per-server schedule limit, live-wipe policy, retention, stop grace period, Rust/ARK egg IDs, Rust map-size list).
- **Client surface:** a **Wiper** tab in the server sub-navigation (`/server/<id>/wiper`) — schedules, execution history and the per-server map library (up to 50 custom `.map` URLs), mounted inline as a native panel page.
- Schedules are one-time or recurring (interval, daily, weekly, monthly or raw cron), each in its own timezone; glob patterns (`logs/*`, `server/?/player.db`) resolve against the live node listing and delete through the normal Wings repositories — a matched folder is removed whole.
- Safe power handling optionally stops the server first and starts it again after (configurable grace period); a failed wipe never leaves a stopped server down. Manual "Run Now" requires typing `WIPE`.
- Pre-wipe warning commands, post-wipe commands, rename-on-wipe with `{day}`/`{month}`/`{year}` placeholders, and per-egg Rust options (blueprint wipes, fresh random seed, fixed or random custom maps written to startup variables).
- Due wipes process once per minute via the stock scheduler cron — no extra cron entries.

### Startup Presets

Administrators define approved startup commands once; server owners apply them from the stock Startup page in one click — no more pasting long Java flag lines into support tickets.

- **Hub:** `?a=startup-presets` — sub-tabs **Presets** (create/edit/delete with scope badges) and **Settings** (optional free-form editing).
- **Client surface:** an inline picker card above the stock Startup Command box with a dropdown of every preset available for that server, an exact command preview, a confirmation dialog, and a status line showing whether the server runs the egg default, a preset or a custom command; viewing needs `startup.read`, applying needs `startup.update`.
- Presets are scoped to every server or to selected nests/eggs; egg placeholders like `{{SERVER_MEMORY}}` keep working, and users can always reset to the egg's original command.
- Free-form custom commands are off by default and can be enabled globally or per nest/egg for holders of `startup.update`; every application and custom save lands in the server activity log with old/new values.

### URL Download

Users paste one or more remote URLs into a guided file-manager modal and the panel fetches the files straight into the server through Wings — no SFTP round-trip.

- **Hub:** `?a=url-download` — single settings pane (policy, throughput, client experience, safeguards, history).
- **Client surface:** server file manager — a toolbar button (label configurable) with a step-by-step modal, progress popup or floating deck, and per-user URL memory chips.
- Pre-flight checks include scheme/extension allow-lists and a remote HEAD probe; conflicts auto-rename, overwrite or skip per file.
- Transfers run on the node via the native `files/pull` endpoint — a healthy panel↔Wings link is required.

---

## Advanced pack

### Ark Mod Installer

Manage an ARK server's mod list straight from the server page — CurseForge mods for **ARK: Survival Ascended**, Steam Workshop mods for **ARK: Survival Evolved** — no FTP, no manual ini editing.

- **Hub:** `?a=ark-mod-installer` — CurseForge API key, catalogue cache counters and a flush action.
- **Client surface:** an **ARK Mods** tab on every server; viewing needs `startup.read`, installing/removing needs `startup.update`.
- Survival Ascended vs. Survival Evolved is detected from the egg (name plus well-known mod variables); ASA gets a searchable/sortable CurseForge catalogue browser with a per-mod file history dialog, ASE adds classic workshop mods by numeric id.
- Installing adds the mod id to the server's startup variable (or `ActiveMods=` in `GameUserSettings.ini` when the egg has no mod variable) — the game server downloads the mods itself on the next boot; no files ever pass through the panel.
- The ASA browser needs a CurseForge API key and outbound HTTPS to `api.curseforge.com` and `media.forgecdn.net`; ASE works without a key. The page reminds users to restart right where the change happens.

### Arma Reforger Tools

Complete Arma Reforger server tooling on one inline server page: a workshop **mod manager**, a structured **config editor**, and an **admin tools** integration for the in-game admin mod — skinned from stock components so it looks native under any theme.

- **Hub:** `?a=arma-reforger` — navigation label, default config file, addons path, admin-tools base path, workshop site URL and build-id override, HTTP timeout, cache TTL, per-feature toggles, collection limit, Discord webhook identity, cache statistics and a one-click flush.
- **Client surface:** `/server/<id>/arma-reforger`; reading anything needs `file.read-content`, changing anything needs `file.update`.
- Mod installs are configuration edits (`game.mods`) — the dedicated server downloads the content itself on the next start; dependencies are pulled in automatically, and the installed view handles load order, version pinning, update badges and bulk removal.
- Collections snapshot the current mod list (private or shared with the server's other users) and re-apply in one click; a guided bisection flow isolates the mod that crashes the server on start, snapshotting and restoring the original list automatically.
- The config editor covers identity, scenarios, gameplay, network/A2S/RCON and limits with optimistic concurrency (a save after an external edit is refused, not silently clobbered); the admin-tools section edits the mod's JSON documents (behaviour, roster, bans, MOTD, scheduled messages, webhooks, priority queue) with a raw JSON fallback per section.
- The workshop catalogue's rotating build id is auto-detected (cached 6 hours, re-detected on failure) with an override field for the rare miss.

### Backup Pro

Scheduled server backups to any S3-compatible storage (AWS, Cloudflare R2, Backblaze B2, Wasabi, MinIO, Spaces) using the panel's native backup pipeline, with retention policies, offload, restore and notifications.

- **Hub:** `?a=backup-pro` — sub-tabs **Overview**, **Destinations**, **Backup Rules**, **Backups**, **Archives**, **Activity**, **Settings**.
- **Client surface:** server backups page — a "protected by S3" banner, per-backup cloud badges, optional click-to-sync, and (when enabled) cloud download/restore.
- Rules combine two modes — mirror existing backups and/or create on a schedule — against all servers, a node, or hand-picked servers; credentials are encrypted with the panel app key.
- Pending uploads with a red cloud icon almost always mean the queue worker (`standard` queue) is not running.

### Bedrock Addon Installer

Browse the Minecraft: Bedrock Edition catalogue and install behavior packs, resource packs, scripts and world templates straight onto a server — no FTP, no manual unzipping, no hand-editing of world pack lists.

- **Hub:** `?a=bedrock-addon-installer` — enable toggle, CurseForge API key, section allow-list and default, egg restriction, cache lifetime, and panel-wide install records with a clear action.
- **Client surface:** a **Bedrock Addons** tab on every server; browsing needs `file.read`, installing needs `file.create`, uninstalling needs `file.delete`.
- True one-click installs: Wings downloads and unpacks on the node, the panel reads the pack manifest, moves it into `behavior_packs` / `resource_packs` / `worlds` and registers packs in the active world's `world_behavior_packs.json` / `world_resource_packs.json`; `.mcaddon` bundles install pack by pack with live pipeline progress.
- Uninstalling deletes the pack directory and drops its world registration; the Installed tab lists every recorded pack with kind, version, location and activation state.
- Behaviour/resource packs activate in the world named by `level-name` (default `world`); scripts install as behavior packs; a restart is usually required. Catalogue icons are proxied through the panel, and downloads are re-derived server-side and pinned to the content CDN.

### Bedrock Version Changer

Switch a Minecraft: Bedrock Edition server between official **Vanilla** dedicated server builds and **PocketMine-MP** release phars — straight from the server page, no FTP, no reinstall.

- **Hub:** `?a=bedrock-version-changer` — enable toggle, flavor allow-list, wipe-option toggles, egg restriction, cache lifetime, per-server history size, and the recorded change history with a clear action.
- **Client surface:** a **Bedrock Versions** tab on every server; browsing needs `file.read`, changing needs `file.create`.
- Builds are grouped by version line (1.21, 1.20, …) with live search, flavor filter, sorting and pagination; a guided flow (pick line → pick build → review → confirm) reports live progress from the node.
- Users may wipe the server before installing, or archive the whole server into `backup-before-bedrock-<timestamp>.zip` first and then wipe — both options can be disabled panel-wide.
- Downloads are re-derived server-side and pinned to official hosts (`www.minecraft.net`, GitHub); preview/beta builds are intentionally not offered. Every change is recorded (flavor, line, build, wipe mode, backup, user).

### Database Manager

One-click `.sql` export and streamed import for panel-managed MySQL databases, straight from the server's Databases page — no phpMyAdmin, no shared credentials.

- **Hub:** `?a=database-manager` — single pane (limits, toggles, recent operations log).
- **Client surface:** server Databases page — per-database Export and Import actions, gated by the `databasemanager.export` / `databasemanager.import` subuser permissions.
- Exports use `--single-transaction` so InnoDB stays writable; optional wipe-before-import when you allow it.
- Requires `mysqldump`/`mysql` client binaries on the panel host; raise PHP upload limits before raising the import cap.

### FastDL Manager

Publish game server content over HTTP FastDL so players fetch maps, textures, models and sounds from a plain web server instead of the game server — with per-node download URLs and a one-click config sync.

- **Hub:** `?a=fastdl` — navigation label, nest allow-list, a global default URL and per-node URL overrides.
- **Client surface:** a **FastDL** tab on eligible servers showing the copy-ready download URL and a sync button; viewing needs `file.read-content`, syncing needs `file.update`.
- Built-in game profiles for Garry's Mod, Counter-Strike: Global Offensive and Counter-Strike 1.6 pick both the URL subdirectory and the config file (`garrysmod/cfg/server.cfg`, …); the likely profile is preselected from the egg.
- Sync writes `sv_downloadurl`, `sv_allowdownload 1` and `sv_allowupload 1` through the Wings file repository — existing lines are replaced in place, comments and unrelated settings survive, and a missing config is created. Changes apply after a restart.
- There is intentionally no built-in web server provisioning (that would need a node-side agent): vhost setup, TLS and file mirroring stay host-level; a minimal nginx vhost ships in the addon's README.

### FiveM Utils

A utilities page for FiveM servers with the day-to-day helpers a host otherwise hands to support tickets: cache clearing, game build pinning, txAdmin controls, the server artifact track and the MySQL connection string.

- **Hub:** `?a=fivem-utils` — tab label, egg keywords, a review of which managed variables each matching egg defines, and a one-click variable re-sync for newly imported eggs.
- **Client surface:** a **FiveM Utils** tab on servers whose egg name matches the configured keywords; reads need `startup.read`, variable writes `startup.update`, the database helper `database.update` and the cache cleaner `file.delete`.
- Each card renders only when the egg defines the backing variable (`GAME_BUILD`, `TXADMIN_ENABLE` / `TXADMIN_PORT`, `ARTIFACT_URL`, `MYSQL_CONNECTION_STRING`); the installer adds them to every egg matching `fivem`, `txadmin` or `cfx` automatically.
- The database helper writes a ready-to-use `mysql://…` string into the hidden variable without ever showing credentials; the artifact picker uses the public artifact feed (cached, with a static fallback).
- The addon sets variables only — the txAdmin port must be free on the node, and the egg's install script must actually consume `ARTIFACT_URL`. Changes apply after a restart (artifacts on the next reinstall).

### Git Source Control

Full git source control for game servers inside the client panel: users link their Git provider account with a fine-grained personal access token, clone a repository into a server, then stage, commit, pull and push — no SFTP round-trips, no command line.

- **Hub:** `?a=github-source-control` — host diagnostics (git version, volume root, linked accounts), settings (navigation label, allowed nests, allowed git hosts, push toggle, manual-URL toggle) and every linked account with one-click revoke.
- **Client surface:** `/server/<id>/source-control` mounted inline — working-tree status, per-file stage/unstage/discard, commit, fetch/pull/push, a line-diff viewer, branches, the 50 most recent commits and a sub-repository path switcher; reads need `file.read-content`, staging/commit/push need `file.update`, clone/pull need `file.create`.
- Tokens are validated against the GitHub API on connect, stored encrypted, and passed per command as an HTTP header — never written into the server's `.git/config`; pulls are fast-forward-only with a clear message on divergence.
- Git operations run panel-side against `<volume_root>/<server uuid>` using the host's `git` binary — servers whose volume is not mounted on the panel host (remote nodes without shared storage) show a clear "files not reachable" state instead of failing obscurely.
- `GSC_API_BASE` can point at a GitHub Enterprise Server; clone/fetch/pull/push themselves are plain git over HTTPS and work with any host on the allow-list.

### Hytale Mod Installer

Browse, search and install Hytale mods from the CurseForge Hytale catalogue directly on the server page — no FTP, no manual downloads.

- **Hub:** `?a=hytale-mod-installer` — CurseForge API key (the install directory lives in config, default `/mods`).
- **Client surface:** a **Hytale Mods** tab on every server — servers whose egg does not look like Hytale see an explanatory notice instead of the catalogue; browsing needs `file.read`, installing needs `file.create`, removing needs `file.delete`.
- One-click install drops the newest file into `/mods`; the Versions dialog picks a specific file with its own text filter and paging; the installed list shows file sizes and dates with a confirmed removal step.
- The panel only resolves the download URL — Wings fetches the file directly onto the node.
- CurseForge is currently the only public mod repository with a real Hytale section, so it is the only provider; the provider layer stays pluggable if that changes.

### Hytale World Manager

Browse the CurseForge Hytale world catalogue, install worlds onto a server with one click, choose which world the server loads, and remove worlds again — all from the server page.

- **Hub:** `?a=hytale-world-manager` — CurseForge API key (the same key as the Hytale Mod Installer works) plus a panel-wide managed-world count.
- **Client surface:** a **Hytale Worlds** tab on every server; browsing needs `file.read`, installing needs `file.create`, activating needs `file.update`, removing needs `file.delete`.
- A current-world banner shows which folder the server loads; a guided install (latest or a specific version, with a "load after installation" checkbox) downloads and extracts directly on the node into `/universe/worlds` — no data passes through the panel.
- Activation rewrites `Defaults.World` in the server's `config.json` (both known layouts probed); worlds dropped onto the node manually are listed alongside catalogue installs, and the currently loaded world cannot be removed.
- Hytale rewrites its config while running — activate while the server is offline; the change always applies on the next start.

### Mod Installer

Browse, search and install Minecraft mods from Modrinth and CurseForge directly on the server page; the panel resolves the URL and Wings fetches the file into `/mods`.

- **Hub:** `?a=mod-installer` — single settings pane (CurseForge key, default provider, default loader) with provider status badges.
- **Client surface:** a **Mods** tab on every server's navigation with loader/version filters, sorting and a versions dialog; browsing needs `file.read`, installing needs `file.create`, uninstalling and updating additionally need `file.delete`.
- Installs run as tracked background jobs with live progress polling instead of a blocking request; the installed-mod list sorts by name, size or date and removes any file with a two-step confirm.
- Installed jars are SHA-512 fingerprinted and matched against Modrinth — outdated mods show the newer release with a one-click update that downloads the new file and removes the old one once it has landed (CurseForge files cannot be fingerprint-matched and report as untracked).
- Modrinth works out of the box; CurseForge unlocks once you save an API key. Catalogue responses are cached panel-side (default 5 minutes) to keep rate limits happy; nodes must reach the mod CDNs.

### Modpack Installer

One-click Modrinth and CurseForge modpack installs from the file manager — full version lists, a confirmation screen with exact file counts, and live per-file progress.

- **Hub:** `?a=modpack-installer` — settings pane (health badges, usage counters, recent installs) plus an **Installs** sub-tab with currently running tasks and every pack tracked as installed panel-wide.
- **Client surface:** a **Modpacks** button in the server file manager opening the browse/install wizard, plus per-server install history.
- Installs run fully server-side as a phased pipeline (fetch → pack → backup → wipe → transfer → extract) that the wizard polls for progress; closing or reloading the wizard does not lose the task — reopening re-attaches to the running install.
- Three install modes: standard merge, *wipe, then install*, and *back up, wipe, then install* (current files are zipped into a `modpack-backup-<date>` archive left in the target directory first); both destructive modes are operator-gated.
- Every completed install records its full file manifest — the wizard's "Installed on this server" block uninstalls a tracked pack with a two-click confirm, removing exactly the manifest files and nothing else. Installs completed before 1.1.0 have no manifest and cannot be uninstalled from the wizard.
- Installs files only — egg, Docker image and startup jar are untouched; requires the PHP `zip` extension and a writable staging directory (both shown as pane badges). Nodes pull the install bundle back from the panel URL; small bundles (≤ 32 MB) are pushed through the daemon write endpoint when a node cannot reach the panel.

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

- **Hub:** `?a=player-list` — single settings pane (enable, protocol, avatar and action toggles, timeout/cache/refresh) with a built-in host:port test tool.
- **Client surface:** server console page — a Players card beneath the terminal polling the client API at your configured interval.
- Each row shows the player's head avatar (provider URL configurable, local placeholder on load failure), and busy servers get a type-to-filter box with a "showing x of y" counter.
- Row moderation actions (kick, ban with reason, op/deop, gamemode, whitelist add/remove) are sent as plain console commands, logged in the server activity log, and only appear for users with console access.
- When a server answers the ping but not the query, the card explains that only a sample is shown and offers an **Enable query** button (visible to users with the file-edit permission) that rewrites `enable-query=true` and `query.port` in `server.properties` — a restart is required.
- UDP query returns the full list but needs `enable-query=true`; the status-ping fallback needs no setup but returns only a name sample. Results are cached per server; the card degrades quietly when a server is offline.

### Player Manager

Manage Minecraft Java players over plain RCON from the client panel: online list, moderation, player actions, server controls and an offline roster. Nothing is installed on the node.

- **Hub:** `?a=player-manager` — single settings pane (enable, avatars and player-data toggles, default port, timeouts) plus the stored-credentials table with revocation.
- **Client surface:** a **Players** page on every server's navigation, including a per-server RCON connection form (stored encrypted); viewing needs `websocket.connect`, every action needs `control.console`, and every action hits the activity log.
- Beyond kick/ban/unban, op/deop and whitelist management: gamemode switch, give items, clear inventory, set/add XP, heal, feed, potion effects, plus time, weather, difficulty and game-rule controls with current values read back.
- The offline roster merges whitelist, ban list, ops and join cache with the live online list — searchable, works while the server is stopped; the player-data viewer reads `playerdata/*.dat` through the node (vitals, XP, position, inventory, ender chest) and edits documented scalar fields offline, keeping a `.pm-backup` on the node before every write.
- One-click **Fix RCON** writes `enable-rcon=true`, `rcon.port` and `rcon.password` into `server.properties` through the node's file API, generating and storing a password when the server has none; avatars are served through a caching panel-side proxy.
- Credentials resolve per-server override → `RCON_PASSWORD`/`RCON_PORT`/`RCON_HOST` server variables → defaults; the RCON port must be reachable from the panel host.

### Plugin Installer

Search Modrinth, Hangar, Spiget, CurseForge and Polymart from the server page and install plugins straight into `/plugins` — with an installed-plugin library and SHA-512 update hints.

- **Hub:** `?a=plugin-installer` — single settings pane (provider toggles, CurseForge key, install directory, analysis cap).
- **Client surface:** a **Plugins** page on every server's navigation with provider/software/version filters, catalogue sorting, a per-plugin details modal, per-release install buttons, and an Installed tab with one-click updates; browsing needs `file.read`, installing needs `file.create`, uninstalling needs `file.delete`.
- Installs run asynchronously with a live progress dialog (resolving → downloading) driven by polling; the Installed tab removes jars after a confirmation (plugin configuration folders stay on the server).
- Premium/external resources are marked and never pulled; CurseForge and Polymart are off by default. Catalogue responses are cached panel-side (TTL tunable via `catalogue_cache_ttl`).
- Wings performs the actual downloads — nodes must reach the provider CDNs.

### Reverse Proxy

Managed reverse proxy rules for game servers: users point a domain at one of their server's allocations, pick an SSL mode, and the panel tracks the rule — including whether the domain's DNS already resolves to the node's address.

- **Hub:** `?a=reverse-proxy` — sub-tabs **Settings** (allowed nodes, default per-server limit, whitelist mode), **Whitelist** (per-server limit overrides with a server search picker) and **All Proxies** (every rule on the panel, with delete for moderation).
- **Client surface:** a **Reverse Proxy** tab on every server; reads need `allocation.read`, writes need `allocation.update`.
- Three SSL modes — plain HTTP, Let's Encrypt (contact email stored for issuance/expiry notices) or a custom certificate chain + key; certificate material is write-only and never leaves the panel again.
- On save the domain is checked against the node's public addresses, so the rule shows "DNS verified" or "DNS pending"; each rule can render a copy-paste nginx server block for the machine that terminates web traffic.
- The panel stores and validates the rule set only — actually answering traffic needs a web server on the node configured from the rule. The competitor's automatic node-side provisioning needs a node agent and is deliberately not included. Raw TCP/UDP game protocols are better served by SRV records (see Subdomain Manager).

### Server Importer

Move servers from another Pterodactyl panel using the source's Application API: stored connections, inventory fetch, dry run with a full conflict report, execution, and one-click rollback.

- **Hub:** `?a=server-importer` — sub-tabs **Overview** and **Run report**.
- **Client surface:** none (root-admin tool).
- A dry run creates nothing — it reports user matches, egg matches, allocation claims and dropped environment values; claims are re-verified before execution, and rollback force-deletes everything a run created.
- Needs a `ptla_…` key on the source panel with read access to servers, users, nodes, nests and eggs, and a target node with enough free allocations.

### Server Properties

A friendly, categorized `server.properties` editor for Minecraft servers — plus a MOTD editor with live preview, a server icon manager and an auto-detected YAML configuration editor.

- **Hub:** `?a=server-properties` — single settings pane (tab label, file name, allowed nests, descriptions, and per-feature toggles for the MOTD, icon and YAML editors).
- **Client surface:** a **Properties** tab on eligible servers (default: nest `1`, the stock Minecraft nest); reads need `file.read-content`, writes need `file.update`, icon uploads need `file.create`, icon removal needs `file.delete`.
- The options editor keeps its typed inputs (toggles, dropdowns, clamped numbers), per-key descriptions, live search and dirty tracking; writes go through the Wings file repository so comments, blank lines and key order survive.
- The MOTD editor handles legacy `§` codes, MiniMessage tags and raw text with a live multiplayer-list preview; the icon manager center-crops any image to exactly 64×64 PNG (verified again server-side).
- Every root-level `.yml`/`.yaml` file opens in a structured editor (typed rows, nesting, filter box) with per-key descriptions for BungeeCord-style proxy configs; a raw mode covers hand-tuned files, and the server validates YAML before writing.
- Changes apply after a server restart — Minecraft reads the file at boot.

### Server Splitter

Let your users split one big server into several smaller ones: the owner picks how much CPU, RAM, disk, ports, databases and backups to carve out, and the addon creates a sub-server on the same node, egg and startup configuration — debited immediately, handed back on removal.

- **Hub:** `?a=server-splitter` — sub-tabs **Overview**, **Whitelist**, **Splits**, **Link Servers** and **Settings** (safety-rail minimums, unlimited policy, whitelist modes).
- **Client surface:** a **Splitter** tab at `/server/<id>/splitter`, visible to the server owner (and root admins) only — remaining splittable resources, allowance usage, and existing sub-servers with resize/rename/remove.
- Split allowances come from a per-server whitelist with fixed limits or resource-graded rules ("a server with at least 1 GB RAM may run 2 sub-servers") checked in an admin-defined priority order; whitelist-only mode and a higher-of-both fallback are both supported.
- Safety rails: configurable minimums that must remain on the master, minimums every sub-server must receive, a node free-port check, and a hard block on splitting a sub-server further; optional subuser sync copies the master's subusers onto a new sub-server.
- Admin linking attaches an existing standalone server to a master without moving resources; `php artisan server-splitter:reconcile` repairs the books after sub-servers are deleted outside the splitter.
- If the node is unreachable at creation, the sub-server stays in the *installing* state with the bookkeeping intact — reinstall it (or remove the split) once the node answers.

### Server Type Changer

Let server owners move their server to a different **egg** — or, when you allow it, a different **nest** — from a guided page in the client panel, while administrators keep full control via global flags, per-server whitelists and blocked nests/eggs.

- **Hub:** `?a=server-type-changer` — sub-tabs **Overview** (enable toggle, nest/egg change flags, blocked nests/eggs, history retention, the last 25 change runs) and **Whitelist** (per-server grants by short identifier or UUID).
- **Client surface:** a guided page at `/server/<id>/type-changer` (pick target type → choose data handling → review → confirm), gated by the `settings.reinstall` subuser permission — server owners always pass; without a whitelist grant the nav entry stays hidden.
- Data handling per change: keep all files, wipe server data (prominent warning), or backup-and-wipe — a **locked** safety backup is created first, and if it cannot be started, nothing is changed. An optional reinstall runs the new egg's installation script.
- Startup variables that exist under the same environment name on both eggs keep their values; everything else resets to the new egg's defaults. Docker images carry over when the new egg offers them.
- Unreachable-node steps complete as *completed with warnings* with the exact failed step recorded; suspended, installing, restoring or transferring servers cannot be changed until they settle.

### Staff Requests

Users request server access from each other — by server ID or owner email — with owner approval, three permission presets, temporary access, blocking and a full audit trail. Approved requests create real subusers. Owners can also flip the flow around and ask a designated staff member for help.

- **Hub:** `?a=staff-requests` — single pane (access policy, limits, stats, staff roster management, read-only requests/grants/audit tables).
- **Client surface:** Account → Staff Requests (`/account/server-access`) plus an Access Manager shortcut on the server Users page for owners and holders of the `accessmanager.manage` permission.
- Any request can be marked urgent (requires a short message, floats to the top with a red badge), and every request carries a sanitized free-text reason — reused as the "what do you need help with?" description on help requests.
- Owner-initiated **Request Staff Help** reverses the direction: the owner picks a server and a staff member from the admin-curated roster (added by email, with role labels like "Support"); when the staff member approves, *they* receive the subuser access. Roster usernames are shown to users; emails are never exposed.
- Temporary access (1 hour to 30 days) is revoked automatically by the panel cron, including SFTP session invalidation; the email flow never reveals account existence, and uninstalling does not remove already-granted subusers.

### Subdomain Manager

Self-service DNS for game servers: users create A and SRV records on the Network page, provisioned through the Cloudflare API against zones you control.

- **Hub:** `?a=subdomain-manager` — sub-tabs **Settings**, **Domains**, **Records** and **Limits** (per-server quota overrides, node allow/deny policy).
- **Client surface:** a Subdomains card on the server Network page, gated by the `subdomainplus.read` / `create` / `delete` subuser permissions.
- The create form verifies the chosen subdomain as you type (format, banned patterns, local records and the zone itself) and blocks known-taken names; **Fetch zones from Cloudflare** auto-fills domain + Zone ID from your account.
- When the allocation alias is a hostname, an A request is transparently upgraded to a **CNAME** pointing at that hostname (per-domain toggle); SRV records point at stable per-allocation hostnames that survive IP changes, and records are always created unproxied.
- Per domain you can restrict eggs, ban names via regex, force a target IP, and define SRV presets; per-server quota overrides and node allow/deny rules live on the Limits tab (restricted servers keep managing existing records). Keep the panel cron running for sync and orphan cleanup; records are de-provisioned automatically when a server is deleted.

### Version Changer

Let users switch a server's Minecraft: Java Edition software and version from the panel — Vanilla (releases, snapshots, historic builds) plus Paper, Purpur, Folia, Velocity and Waterfall down to an exact build, with automatic jar backups, optional data wipe choices and live install progress.

- **Hub:** `?a=version-changer` — settings pane with a recent-changes table, plus a **Server Access** sub-tab for per-server grants.
- **Client surface:** a Version Changer card on the server Startup page; viewing needs `file.read`, installing needs `file.create`.
- The picker walks software → game version → build (build numbers, channels, dates, sizes, latest markers and commit summaries for build-based software); per install the user chooses to keep files, archive-then-wipe (a zip of the whole server stays behind) or wipe — wipe options can be disabled panel-wide.
- The picker polls a per-server progress endpoint and shows the running step (resolving → archiving → wiping → downloading → finalizing); installs are recorded with software, version, build, filename, backup/archive and wipe mode.
- Jar downloads are pinned to the official distribution hosts of each software regardless of the manifest endpoints; the previous jar is renamed to `<name>.backup-<timestamp>` on keep-files installs, and the egg's `SERVER_JARFILE` variable can be pointed at the new jar automatically.
- The running process keeps the old jar until the next restart — tell users to restart after switching.

### Votifier Tester

Send a real test vote from the client panel to any Votifier/NuVotifier listener and instantly see whether delivery succeeds — the fastest way to debug vote listener host, port, token and key setup.

- **Hub:** `?a=votifier-tester` — single pane (global feature toggle, default listener port, connection timeouts).
- **Client surface:** a **Votifier** page on every server's navigation; viewing needs `websocket.connect`, sending a test needs `control.console`, and every test lands in the server's activity log.
- Speaks both wire protocols — Votifier v1 (RSA-sealed vote block) and NuVotifier v2 (HMAC-SHA-256 signed JSON) — with auto-detect from the listener's handshake banner; the result shows the banner, any reply, the detected protocol and the round-trip time.
- The page keeps the session's recent attempts (target, protocol, outcome, duration) for quick iteration; token and public key travel with the test only — the panel never persists them.
- Zero node footprint: the panel talks straight to the listener, whose port must be reachable from the panel host. A well-formed vote is answered with silence, so a clean handshake plus transmission counts as a pass — the reward event shows up in the server console.

### World Manager

Browse the CurseForge world catalogue, install a world onto a server with one click, and point the server at any of its world directories — no FTP, no manual uploads.

- **Hub:** `?a=mc-world-manager` — CurseForge API key, default catalogue sort, navigation label, catalogue cache lifetime.
- **Client surface:** a **Worlds** tab on every server; browsing needs `file.read`, installing needs `file.create`, deleting needs `file.delete`, switching the active world needs `file.update`.
- Each world card opens a versions dialog (game versions, release channel, size, download count); a confirmation step explains what happens, and a progress dialog follows the real install (downloading → extracting → moving) instead of a dead spinner.
- Smart unpacking stages the archive in a hidden folder, and the directory containing `level.dat` is moved to the server root under a collision-free name; archives Wings cannot unpack (rar, 7z, plain gzip) are rejected with a clear message.
- Every root directory holding a `level.dat` is listed with its modification date; switching the active world rewrites `level-name` in `server.properties` (restart to play), and deletes verify the directory really is a world first. Catalogue responses are cached panel-side.

---

## What's Next?

- **[Configuration Reference →](../configuration/reference.md)** — every setting on every pane, with defaults.
- **[The Hub Dashboard →](./dashboard.md)** — layout, sub-tabs and the save round-trip.
