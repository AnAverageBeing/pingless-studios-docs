---
title: Configuration Reference — Glacier Pack
description: Every setting on every Glacier Pack addon pane — name, type, default, what it does, when to change it, and common mistakes — grouped per addon.
outline: deep
---

# Configuration Reference

Every setting that actually exists on the 46 Glacier Pack addon panes, grouped per addon with an anchor each. Settings marked **(env-only)** live in the addon's config file and are tuned via `.env`, not the hub. Addons that manage *records* instead of settings (rules, destinations, alerts) list those fields under **Managed data**.

::: tip
All saves go through the hub's `_hub` round-trip: you always land back on the same pane, with validation errors shown above the form when a value is rejected.
:::

---

## Basic pack

### Audit Log {#audit-log}

No settings form — the pane is a filterable viewer (full-text search, event scope, actor type, date range) with a per-entry detail dialog and retention tools (prune entries older than N days, or clear the log; both behind confirmation prompts).

| Setting | Type | Default | What it does |
| --- | --- | --- | --- |
| `per_page` **(env-only)** | number | `25` (`AUDIT_LOG_PER_PAGE`) | Entries listed per page (clamped 1–100). |

**Common mistakes:** treating prune/clear as reversible — both delete activity rows permanently; expecting entries the panel never recorded — the addon reads the stock `activity_logs` feed and adds no extra logging of its own.

---

### Auto Suspend {#auto-suspend}

Sub-tabs: **Overview** (counters + latest activity), **Servers** (per-server expiry dates, one inline form per row), **History**, **Settings**. Settings save to `admin.auto-suspend.settings.update`.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `suspension_enabled` | checkbox | on | Master switch — off pauses warnings, suspensions, lifts and deletions. |
| `warn_days` | number (0–60) | `3` | Days before expiry the owner receives one warning email; `0` disables it. |
| `auto_delete_enabled` | checkbox | off | Delete servers suspended by this addon once they outstay the grace period. |
| `auto_delete_days` | number (1–365) | `14` | Grace period in days (suspended) before auto-delete fires. |
| `excluded_nodes[]` | multi-select | empty | Nodes whose servers are never auto-deleted. |
| `retention_days` | number (7–365) | `90` | History rows older than this are pruned daily. |

**Managed data:** per-server expiry dates on the **Servers** tab. Extending a suspended server's expiry into the future lifts the suspension on the next scheduler pass.

**Common mistakes:** missing the panel cron — processing runs every five minutes via `schedule:run` (`php artisan auto-suspend:process` by hand); warning emails silently absent when the panel's mail settings are broken; expecting manual suspensions to be auto-deleted — only addon-applied suspensions are eligible.

---

### Command History {#command-history}

Sub-tabs: **Overview** (capture status, totals, per-server counts, the 25 most recent commands panel-wide, per-server purge and purge-everything) and **Settings**.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | on | Pause/resume capture panel-wide. |
| `max_per_server` | number (50–1000) | `200` | Entries kept per server; excess is pruned on save. |
| `list_limit` **(env-only)** | number | `50` (`COMMAND_HISTORY_LIST_LIMIT`) | Newest entries shown in the console dropdown. |

Both UI settings also have env defaults (`COMMAND_HISTORY_ENABLED`, `COMMAND_HISTORY_MAX_PER_SERVER`).

**Common mistakes:** expecting the dropdown to show the full retention — it always shows the newest `list_limit` entries; purges (per-server or global) have no undo.

---

### Config Editor {#config-editor}

No settings form — this pane edits the panel's live `.env` directly. Sub-tabs: **Editor** (structured, grouped by prefix) and **Raw file** (whole-file textarea).

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `env[<KEY>]` (per parsed key) | text / password / true-false select | current `.env` value | One input per env key. Secret-looking keys (`PASSWORD`, `SECRET`, `KEY`, `TOKEN`, `SALT`) are masked with a reveal toggle; boolean keys get dropdowns. |
| `env[APP_KEY]` | password | always blank | Write-only. Blank keeps the current key; pasting a new one rotates it (format-validated as Laravel `base64:` or 32-char). |
| `contents` (Raw tab) | textarea | entire file verbatim | Bulk raw edit with the same validation, backup and atomic-write flow. |
| `backups_keep` **(env-only)** | number | `10` | Timestamped `.env` snapshots kept in `storage/app/config-editor/backups`. |

**Common mistakes**

- **Editing `APP_KEY`.** Never. Panel data encrypted with it (node database passwords) becomes unreadable.
- **Changing `APP_NAME`, `SESSION_*`, `CACHE_PREFIX` or `REDIS_*` casually** — it invalidates every active session panel-wide, logging everyone out immediately.
- Forgetting that backups contain full `.env` secrets — they are written `0640` in a `0750` directory; treat them like the `.env` itself.

---

### Console Log Share {#console-log-share}

Single settings pane (no sub-tabs). Posts to `admin.console-log-share.update`; **Reset to Defaults** restores the shipped values.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `paste_endpoint` | url | `https://api.mclo.gs/1/log` | Any mclogs-compatible API: the panel POSTs the log as form field `content` and expects JSON containing `url`. Change when self-hosting a paste service. |
| `upload_enabled` | checkbox | on | Off hides the Share button and rejects uploads; **Copy Log stays available**. |
| `placement` | select | `top` (Above the console) | Where the Copy/Share bar renders on the console page. |
| `default_paste_endpoint` **(env-only)** | — | `CONSOLE_LOG_SHARE_PASTE_ENDPOINT`, same URL | Shipped default the reset button returns to. |
| `max_log_lines` **(env-only)** | number | `1500` (`CONSOLE_LOG_SHARE_MAX_LINES`) | Trailing console lines requested from the node. |
| `max_upload_bytes` **(env-only)** | number | `5242880` (`CONSOLE_LOG_SHARE_MAX_BYTES`) | Largest payload pushed to the paste service; older lines are trimmed beyond it. |

**Common mistakes:** pointing `paste_endpoint` at a plain HTML pastebin (it must be the mclogs-compatible *API* URL); changing env overrides without `php artisan config:clear`.

---

### Login Activity {#login-activity}

No settings form. Sub-tabs: **Logins** (full history with user / date-range filters, pagination) and **Sessions** (live mirrored sessions with user filter, per-row revoke and revoke-all for one user). Deleted users show as "Deleted user #id".

| Setting | Type | Default | What it does |
| --- | --- | --- | --- |
| `admin_per_page` **(env-only)** | number | `25` (`LOGIN_ACTIVITY_ADMIN_PER_PAGE`) | Rows per page on the admin overview (clamped 1–100). |
| `client_per_page` **(env-only)** | number | `8` (`LOGIN_ACTIVITY_CLIENT_PER_PAGE`) | Rows per page in the account-area widget. |
| `sessions.enabled` **(env-only)** | bool | `true` (`LOGIN_ACTIVITY_SESSIONS`) | Mirror and track live sessions for the Sessions tab and self-service revoke. |
| `geo.enabled` **(env-only)** | bool | `true` (`LOGIN_ACTIVITY_GEO`) | Coarse ipwho.is geolocation per unique IP; set `false` to keep IPs in-house. |
| `geo.cache_days` **(env-only)** | number | `30` (`LOGIN_ACTIVITY_GEO_CACHE_DAYS`) | One lookup per unique IP per cache window. |
| `proxy.detection` **(env-only)** | — | `heuristic` (`LOGIN_ACTIVITY_PROXY_DETECTION`) | Network-name keyword heuristic; set `proxycheck` for an authoritative verdict. |
| `LOGIN_ACTIVITY_PROXYCHECK_KEY` **(env-only)** | — | empty | Free-tier proxycheck.io key, only used with the `proxycheck` detector. |

**Common mistakes:** expecting authoritative VPN detection out of the box — the default heuristic is best-effort (set the proxycheck mode for a real verdict); a revoked session is not instant-logout down to the millisecond — it dies on its very next request. History is kept on uninstall unless you pass `--drop-table` to `remove.sh`.

---

### Move Files {#move-files}

No settings at all — the pane is an informational card. The addon enhances every server's file manager automatically once installed; there is no config file and no backend.

**Common mistakes:** forgetting a hard refresh (`Ctrl+Shift+R`) on the Files page after install, and forgetting to re-run `install.sh` after panel updates overwrite `templates/base/core.blade.php`.

---

### Node Status {#node-status}

Sub-tabs: **Overview** (settings + per-node overrides), **Monitors**, **Sharing & Alerts**, **Service Updates**. Settings save to `admin.uptime.settings`.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | on | Master switch — off hides the Uptime tab and stops collection. |
| `poll_interval` | select | `60` s (30 / 60 / 120 / 300) | How often the panel polls Wings. Lower = fresher graphs, more node load. The collector honors the configured interval. |
| `retention_days` | select | `90` (30–365) | Nightly pruning horizon; the graph window maxes at 365 days. |
| `users_see_node_uptime` | checkbox | on | Whether regular users see node health data. |
| `show_node_names` | checkbox | off | Off masks real node names/FQDNs for users ("Your Node", "Node 1"); admins always see real names. |
| `public_page_enabled` | checkbox | off | Unauthenticated `/status` page plus JSON feed (`/api/uptime-public/summary`), rate-limited and `noindex`. |
| `public_page_title` | text | shipped string | Title of the public status page. |
| `public_show_uptime` / `public_show_latency` / `public_show_monitors` / `public_show_notices` | checkboxes | on | Per-element display toggles for the public page. |
| `public_show_node_names` | checkbox | off | Show real node names publicly — node FQDNs are never exposed either way. |
| `discord_webhook_url` | url | empty | Discord webhook for down/resolved incident embeds. |
| `discord_alert_nodes` / `discord_alert_monitors` | checkboxes | on | Alert categories: node and monitor transitions. |
| `discord_alert_servers` | checkbox | off | Also alert on per-server transitions (noisy on big panels). |
| `discord_hide_endpoint` | checkbox | off | Mask the endpoint in alerts posted to public channels. |
| `job_timeout` / `node_connect_timeout` / `monitor_timeout` / `cache_ttl` **(env-only)** | numbers | `45` / `3` / `6` / `300` | Collection job timeout, per-node and per-monitor connect timeouts, cache TTL (seconds). |

**Managed data:** per-node tracking overrides (toggle per node); custom **Monitors** (`name`, `type` — `http` / `tcp` / `udp`, `target`, `port`), each with live state, 24 h uptime, latency, last check, failure reason and pause/resume; **Service Update** posts with `title` (required), `event_at` (optional — renders a live countdown) and `body_html` (required; whitelisted basic HTML). A **Send test alert** button verifies the Discord webhook.

**Common mistakes:** missing the panel cron — collection (`uptime:collect`) and pruning run via the scheduler; forgetting the `uptime.read` subuser permission, without which users see no Uptime tab; reading UDP monitors as proof of life — a silent host counts as up unless the network refuses the packet (noted in the UI).

---

### PWA {#pwa}

Single settings pane (posts to `admin.pwa.update`) with live endpoint links; **Reset to Defaults** restores the shipped values, disables the shell and rolls client caches on the next page load.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | off | Master switch. Disabling makes every client unregister the service worker and purge its caches on the next page load. |
| `app_name` | text (max 80) | empty (panel name) | Shown in the install dialog and on the home screen. |
| `app_short_name` | text (max 30) | empty | Used where space is tight (under the home-screen icon). |
| `app_description` | textarea (max 200) | empty | Shown in some install dialogs. |
| `theme_color` / `background_color` | color | `#0e4688` | Browser toolbar color / splash-screen background. |
| `display` | select | `standalone` | Display mode; `standalone` is the classic app-window mode. |
| `orientation` | select | `any` | Orientation lock. |
| `status_bar_style` | select | `default` | iOS status bar style (Apple devices only). |
| `icon_192` / `icon_512` / `icon_maskable` | text | panel favicons | Paths (`/favicons/…`) or full URLs; empty slots fall back to the bundled favicons. |
| `cache_strategy` | select | `cache-first` | `cache-first` (fastest) or `network-first` (freshest) for static assets. |
| `cache_max_age` | number (1–720) | `24` h | Cached entries older than this refresh from the network. |
| `cache_assets` | checkbox | on | Cache panel JS/CSS/fonts/images. |
| `cache_api` | checkbox | off | Network-first caching of `/api/client` GET responses with a cached fallback. |
| `offline_enabled` | checkbox | on | Branded offline fallback page at `/pwa/offline`. |
| `offline_title` / `offline_message` | text | shipped strings | Offline page copy. |
| `prompt_enabled` | checkbox | on | Dismissible install banner; dismissed banners stay hidden seven days, iOS shows *Share → Add to Home Screen* instructions. |
| `prompt_delay` | number (0–600) | `30` s | Delay before the banner appears. |
| `prompt_button` / `prompt_title` / `prompt_text` | text | shipped strings | Banner copy. |

**Common mistakes:** testing over plain HTTP — service workers and install prompts require a secure context (localhost is exempt); enabling `cache_api` and being surprised by briefly stale data on flaky connections.

---

### Panel Logs {#panel-logs}

No settings form — a tool pane with log files grouped by source and a tail viewer (level filters, 2/5/10/30 s auto-refresh, download, clear, delete). The panel's `storage/logs` is joined by auto-detected Nginx (`/var/log/nginx`) and Wings (`/var/log/pterodactyl`) sources plus any you configure.

| Setting | Type | Default | What it does |
| --- | --- | --- | --- |
| `PANEL_LOGS_TAIL_LINES` **(env-only)** | number | `400` | Lines of context loaded when a log opens. |
| `PANEL_LOGS_SCAN_BYTES` **(env-only)** | number | `4194304` (4 MiB) | Backwards scan budget for the initial tail. |
| `PANEL_LOGS_POLL_MAX_BYTES` **(env-only)** | number | `524288` (512 KiB) | Max bytes per poll response. |
| `PANEL_LOGS_POLL_INTERVAL` **(env-only)** | number | `5` (seconds) | Default auto-refresh interval in the viewer. |

**Log sources (`config/panellogs.php` → `sources`):** each source takes `label` (display name), `path` (absolute directory), `pattern` (glob, default `*.log`), `parser` (`laravel`, `auto` = Laravel + Nginx error + Wings, or `plain`), `readonly` (default `true` — hides and refuses clear/delete server-side) and `auto` (default `false` — silently skip when the directory is missing). Run `php artisan config:clear` after editing.

**Common mistakes:** expecting clear/delete on external sources — they are read-only by design so the addon can never truncate web server or daemon logs; a source whose directory exists but is unreadable by the panel user shows a permission notice — grant read access (e.g. group membership) to list it.

---

### Quick Files {#quick-file-access}

Single pane: settings, usage stats (total pins, servers with pins, most pinned servers) plus two separate actions — **Reset to defaults** and **Clear every pin panel-wide**.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | on | Off hides the Quick Access bar and row stars panel-wide. |
| `max_pins` | number (0–500) | `25` | Pins per server; `0` = unlimited. |

**Common mistakes:** forgetting pins are server-wide — everyone with file access sees the same bar; worrying about the re-check button — it only drops pins whose target is confirmed missing, unlistable directories are left untouched.

---

### Recycle Bin {#recycle-bin}

Single pane: global settings, storage overview, top-servers table and per-egg overrides.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | on | Off makes deletes permanent again (stock behavior). |
| `retention_hours` | number (1–8760) | `24` | Hours a trashed file stays recoverable before purge. |
| `default_max_mb_per_server` | number (0–10485760) | `0` (unlimited) | Per-server trash capacity in MB, counted against the server's real disk. Set this on shared nodes. Files too large for the bin can only be deleted permanently. |
| `max_files_per_delete` | number (1–10000) | `100` | Cap per delete request. |
| `purge_batch_size` | number (50–5000) | `200` | Rows per chunk processed by the hourly purge job. |
| `logging_enabled` | checkbox | on | Write activity-log entries for trash / restore / purge. |
| `protect_trash_dir` | checkbox | on | Protects `.trash` from manual moves and deletion. |
| `reroute_permanent_delete` | checkbox | off | Route "delete permanently" requests (UI or API clients sending the `permanent` flag) through the bin too; purges from inside the bin still destroy files. |

**Managed data:** per-egg overrides — `egg_id` (required), `retention_hours` (blank inherits global), `max_mb` (blank inherits global).

**Common mistakes:** leaving capacity unlimited on busy nodes (trash eats real disk); not re-running `install.sh` after panel updates overwrite the patched core files. The client UI integrates at runtime, so no `yarn build` is needed (a compiled SPA integration remains optional).

---

### Resource Alerts {#resource-alerts}

Sub-tabs: **Overview**, **Rules**, **History**, **Settings**. Settings save to `admin.resource-alerts.settings.update`; **Send Test Alert** emails all admins and hits the configured webhooks.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `monitoring_enabled` | checkbox | on | Pause switch — off skips every poll and fires nothing. |
| `discord_webhook_url` | url | empty | Discord incoming webhook for alert delivery. |
| `slack_webhook_url` | url | empty | Slack incoming webhook. |
| `retention_days` | number (1–365) | `30` | History records older than this are pruned daily. |
| `history_per_page` **(env-only)** | number | `25` | History pagination size. |

**Managed data (rules):** `name` (max 64), `metric` (`cpu`, `memory`, `disk`, `network_rx`, `network_tx`), `operator` (`above`/`below`), `threshold` (default `90`; % for cpu/memory/disk, Mbps for network), `scope` (`global`/`node`/`server`), `node_id`/`server_id` (per scope), `duration_minutes` (1–60, default `1` — consecutive 1-minute samples outside the threshold before firing), `enabled`, `notify_mail`, `notify_webhook`. Layering: global rule → per-node override → per-server override; most specific wins.

**Common mistakes:** enabling `notify_webhook` on rules before saving webhook URLs; treating CPU/memory/disk thresholds as absolute values (they are percentages of the server's limits); missing the panel cron — sampling runs once per minute via the scheduler.

---

### Schedule Presets {#schedule-presets}

Preset CRUD plus a global export switch on one pane.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `export_enabled` | checkbox | on | Allow user-side JSON export/import of schedules. |
| `max_preset_tasks` **(env-only)** | number | `10` (`SCHEDULE_PRESETS_MAX_TASKS`) | Task cap per preset. |
| `max_import_bytes` **(env-only)** | number | `16384` (`SCHEDULE_PRESETS_MAX_IMPORT_BYTES`) | Largest accepted JSON import document. |

**Managed data (presets):** `name`, five cron fields (with a quick-pick for common timings, validated server-side), an *offer to users* toggle, an *only run when online* flag, and an ordered task list — each task is a stock task type (send command, send power action, create backup with ignored-files payload) with a time offset (0–900 s) and a continue-on-failure flag.

**Common mistakes:** backup tasks are refused when the server's backup limit is 0, and applies honor the panel's per-schedule task limit — both surface as clear errors to the user.

---

### Server Timezone {#server-time-changer}

Single pane: master switch, label, default zone, and every server override with a per-row reset.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | on | Off hides the client tab panel-wide. |
| `nav_label` | text | `Timezone` | Label of the tab in the server navigation. |
| `default_timezone` | select | `UTC` | Zone used by every server without an override. |

All three also have env defaults (`SERVERTIMECHANGER_ENABLED`, `SERVERTIMECHANGER_NAV_LABEL`, `SERVERTIMECHANGER_DEFAULT_TIMEZONE`).

**Common mistakes:** expecting a running container to pick up the zone — Docker environment changes only at the next container (re)creation, so restart after changing; container images without `tzdata` fall back to UTC-style behavior (every standard yolk ships it).

---

### Server Wiper {#server-wiper}

Sub-tabs: **Overview**, **Executions**, **Settings**.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `nav_label` | text | `Wiper` | Client tab label. |
| `default_timezone` | select | `UTC` | Preselected zone for new schedules. |
| `max_schedules_per_server` | number | `10` | Schedule cap per server. |
| `allow_live_wipes` | checkbox | on | Permit wipes without stopping the server first. |
| `retention_days` | number | `30` | Execution history kept. |
| `stop_grace_seconds` | number | `15` | How long to wait for the server to go offline before wiping. |
| `rust_eggs` / `ark_eggs` | text | empty | Comma-separated egg IDs that unlock the Rust/ARK options. |
| `rust_map_sizes` | text | `1000,1500,…,6000` | Selectable map sizes. |
| `rust_default_map_size` | number | `4500` | Preselected map size. |

**Managed data:** per-server wipe schedules and map libraries (up to 50 `.map` URLs) live on the client side; the **Executions** tab lists every run with status, files deleted, power actions, commands sent and applied Rust variables.

**Common mistakes:** a glob that matches a folder removes the folder whole — test patterns on a throwaway server first; each schedule runs in its own timezone, not the panel's.

---

### Startup Presets {#startup-presets}

Sub-tabs: **Presets** (CRUD with scope badges) and **Settings**.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `custom_command_enabled` | checkbox | off | Let users with `startup.update` type a fully custom startup command instead of only picking presets. |
| `custom_command_nest_ids[]` / `custom_command_egg_ids[]` | multi-selects | empty (every server) | Restrict free-form editing to specific nests and/or eggs. |

**Managed data (presets):** `name`, optional `description`, the startup command (egg placeholders like `{{SERVER_MEMORY}}` are substituted at server start), and nest/egg scoping (empty = offered everywhere).

**Common mistakes:** none major — users can always reset to the egg's original startup command from the same picker.

---

### URL Download {#url-download}

Single settings pane (one form, four boxes). **Reset to defaults** and **Clear caches** (remembered URLs + activity) are separate actions.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `max_file_size_value` + `max_file_size_unit` | number + select (MB/GB) | `10` `GB` | Files larger than this are rejected before download. `0` = unlimited. |
| `allowed_url_schemes` | text | `http,https` | Comma-separated scheme allow-list. |
| `allowed_file_extensions` | text | empty (all allowed) | Comma-separated without dots, e.g. `zip,gz,tar,jar`. |
| `max_urls_allowed` | number (1–100) | `3` | URLs per batch. |
| `max_concurrent_downloads` | number (1–50) | `3` | Queued + active downloads per user per server. |
| `max_query` / `max_query_window` | numbers | `10` / `60` | URL-validation rate limit (queries per window, seconds). |
| `button_label` | text (max 60) | `Download from URL` | File-manager toolbar button label. |
| `show_progress` | select | `popup` | `popup`, `deck` (modal + floating deck), `deck_only`, `none`. The deck survives page reloads. |
| `memory_limit` | number (1–20) | `20` | Remembered URL chips per user. |
| `allow_simultaneous_downloads` | checkbox | on | Let users run a batch simultaneously instead of queued. |
| `prevent_incomplete_downloads` | checkbox | on | Post-transfer verification; empty/missing results are flagged and cleaned up. |
| `follow_redirects` | checkbox | on | Follow HTTP redirects when probing/downloading. |
| `allow_unknown_size` | checkbox | off | Accept downloads whose size the HEAD probe cannot determine — size limits cannot be enforced for these. |
| `validate_urls_on_entry` | checkbox | on | Validate URLs as the user types. |
| `prevent_html_downloads` | checkbox | off | Reject URLs that resolve to HTML pages. |
| `max_active_history` / `max_failed_history` / `max_completed_history` | numbers (0–1000) | `20` each | History rows kept per state; `0` = unlimited. |
| `stale_download_timeout` | number (60–86400) | `3600` s | A download with no progress this long is marked failed. |
| `probe_timeout` **(env-only)** | number | `15` (`URL_DOWNLOAD_PROBE_TIMEOUT`) | Seconds per remote HEAD probe. |

**Common mistakes:** enabling `allow_unknown_size` and expecting size limits to still apply; forgetting transfers run on the node via the native `files/pull` endpoint — a broken panel↔Wings link fails every download.

---

## Advanced pack

### Ark Mod Installer {#ark-mod-installer}

Single pane: the CurseForge API key, catalogue cache counters and a flush action.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `curseforge_api_key` | text | empty | Unlocks the Survival Ascended catalogue browser; Survival Evolved works keyless. |
| `max_mods` **(env-only)** | number | `100` (`ARK_MOD_INSTALLER_MAX_MODS`) | Mod id cap per server. |
| `ini_path` **(env-only)** | path | `ShooterGame/Saved/Config/LinuxServer/GameUserSettings.ini` | Where `ActiveMods=` is written for eggs without a mod variable. |
| `http_timeout` / cache TTLs **(env-only)** | seconds | `15`; search `600`, details `86400`, files `1800`, icons `86400` | `ARK_MOD_INSTALLER_HTTP_TIMEOUT`, `…_SEARCH_TTL`, `…_DETAILS_TTL`, `…_FILES_TTL`, `…_ICON_TTL`. |

**Common mistakes:** expecting mod files to pass through the panel — installing only edits the startup variable (or `GameUserSettings.ini`) and the game server downloads the mods itself on the next boot; ini-mode ASE servers need the node reachable from the panel (Wings file API).

---

### Arma Reforger Tools {#arma-reforger}

Single pane: settings, cache statistics and a one-click cache flush.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `nav_label` | text | `Reforger` | Client tab label. |
| `config_file` | text | `config.json` | Default server config file the editor opens. |
| `addons_path` | text | `addons` | Path the admin-tools integration resolves addons under. |
| `admin_tools_base_path` | text | `profile/profile/Misfits_Logging` | Base path of the in-game admin mod's JSON documents. |
| `workshop_site` | url | `https://reforger.armaplatform.com` | Public workshop site used for catalogue browsing. |
| `workshop_build_id` | text | auto-detected | Override for the catalogue's rotating build id (auto-detect caches 6 h and re-detects on failure). |
| `http_timeout` | number | `15` s | Catalogue request timeout. |
| `cache_ttl_minutes` | number | `360` | Workshop catalogue cache lifetime (panel database). |
| `config_editor_enabled` / `admin_tools_enabled` / `collections_enabled` | checkboxes | on | Per-feature toggles. |
| `collection_limit_per_user` | number (1–100) | `5` | Saved mod-list collections per user. |
| `webhook_username` / `webhook_avatar_url` | text | `Server Panel` / empty | Identity for per-server Discord webhooks. |
| `max_config_bytes` **(env-only)** | number | `524288` (`ARMA_REFORGER_MAX_CONFIG_BYTES`) | Largest config file the editor touches. |

**Common mistakes:** a save refused after the file changed on disk is the optimistic-concurrency guard — reload and re-apply instead of expecting a silent overwrite; the panel never downloads mod binaries — the dedicated server fetches everything listed in `game.mods` at start (upstream behavior).

---

### Backup Pro {#backup-pro}

Sub-tabs: **Overview**, **Destinations**, **Backup Rules**, **Backups**, **Archives**, **Activity**, **Settings**.

**Settings tab** (`admin.s3backuppro.settings.update`):

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `default_retention_count` | number (0–10000) | `0` | Copies kept for manual offloads not attached to a rule; `0` = unlimited. |
| `show_user_ui` | checkbox | on | "Protected by S3" banner and cloud badges on the user's backup page. |
| `download_source` | select | `auto` | Default download/restore source: `auto` (local first, S3 fallback), `local`, `cloud`. |
| `allow_user_cloud_download` | checkbox | on | Users may download backups from S3 copies. |
| `allow_user_cloud_restore` | checkbox | off | Users may restore from S3 copies — overwrites server files, hence off. |
| `auto_retention_mode` | checkbox | off | Match S3 retention to each server's panel backup limit; ignores per-rule "Keep newest N". |
| `backup_rate_limit_count` / `backup_rate_limit_seconds` | numbers | `2` / `600` | Backup creation throttle; window `0` = no throttle. |
| `notify_webhook_url` | text | empty | Discord-compatible webhook for notifications; blank disables. |
| `notify_level` | select | `failures` | `none`, `failures` (recommended), `all`. |
| `sync_check_interval` | number (1–1440) | `60` | Minutes between sync checks. |
| `allow_user_sync_trigger` | checkbox | off | Makes the red "pending" cloud icon clickable for users. |

**Managed data:**

- **Destinations** — `name`, `access_key_id`, `secret_access_key` (encrypted at rest; blank on edit keeps it), `provider_hint` (`custom`/`aws`/`r2`/`b2`/`wasabi`/`minio`/`datalix` — auto-fills defaults, does not affect functionality), `bucket`, `region` (default `us-east-1`; R2 = `auto`), `endpoint` (blank = AWS), `prefix`, `use_path_style` (on; most non-AWS providers require it), `is_enabled`. One-click connection tests, per-row or "test all".
- **Backup rules** — `name`, `target_type` (`all`/`node`/`servers`), `node_id` or `servers[]`, `destinations[]`, `backup_mode` (`mirror` / `schedule` / `both` / `off`), `interval_minutes` (default `1440`), `retention_count` (default `5`, `0` = unlimited), `retention_days` (`0` = no age limit), `offload` (delete node copy after upload), `lock_backups`, `ignored_files` (one glob per line, `.pteroignore` syntax).

**Env-only tuning (`config/s3backuppro.php`):** `S3BACKUPPRO_QUEUE_CONNECTION` / `S3BACKUPPRO_QUEUE_NAME` (default `standard`), multipart threshold/part size (16 MiB), `completion_timeout_seconds` (3600), `stale_after_minutes` (180), `max_servers_per_run` (100), `prune_time` (04:00), `log_retention_days` (60).

**Common mistakes:** uploads sitting pending with a red cloud icon — almost always a missing queue worker on the `standard` queue; wrong path-style/endpoint combo for the provider (AWS: blank endpoint, path-style **off**; R2/B2/Wasabi/MinIO: provider endpoint, path-style **on**).

---

### Bedrock Addon Installer {#bedrock-addon-installer}

Single pane: settings plus the panel-wide install records with a clear action.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | on | Off hides the client tab panel-wide. |
| `curseforge_api_key` | text | empty | Required — the browser stays hidden from users until a key is saved; the key never leaves the panel. |
| `allowed_types[]` | checkboxes | all four | Catalogue sections users may browse: addons, resource packs, scripts, world templates. |
| `default_type` | select | `addons` | Preselected section. |
| `egg_ids` | text | empty (every egg) | Restrict the browser to specific egg IDs. |
| `cache_ttl` | number | `300` s | Catalogue cache lifetime. |

**Common mistakes:** behavior/resource packs activate in the world named by `level-name` (default `world`) — point it elsewhere first if you run multiple worlds; a restart is usually required before new packs take effect; record cleanup never touches pack files on servers.

---

### Bedrock Version Changer {#bedrock-version-changer}

Single pane: settings plus the recorded change history with a clear action.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | on | Off hides the client tab and rejects installs. |
| `allowed_types[]` | checkboxes | both | Flavors users may install: Vanilla (official BDS) and PocketMine-MP. |
| `allow_wipe` | checkbox | on | Permit the wipe-before-install option. |
| `allow_zip_wipe` | checkbox | on | Permit archive-and-wipe (`backup-before-bedrock-<timestamp>.zip` left in the server root). |
| `egg_ids` | text | empty (every egg) | Restrict the picker to specific egg IDs. |
| `cache_ttl` | number (300–86400) | `21600` | Version catalogue cache lifetime. |
| `history_limit` | number (0–500) | `50` | Change records kept per server. |
| `http_timeout` / `http_retries` **(env-only)** | numbers | `10` / `2` (`BEDROCK_VERSION_CHANGER_HTTP_TIMEOUT`, `…_HTTP_RETRIES`) | Catalogue request tuning. |

**Common mistakes:** preview/beta builds are intentionally not offered — only stable releases; nodes must reach `www.minecraft.net` and `github.com` for the actual downloads.

---

### Database Manager {#database-manager}

Single settings pane plus a recent-operations log.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `max_export_mb` | number | `256` | Databases estimated larger are refused before a dump starts. |
| `max_import_mb` | number | `64` | Upload cap for imports — the pane shows your live PHP `upload_max_filesize`/`post_max_size`; raise those first for large imports. |
| `allow_export` | checkbox | on | Users with `databasemanager.export` may download dumps. |
| `allow_import` | checkbox | on | Users with `databasemanager.import` may restore uploads. |
| `allow_wipe` | checkbox | on | Permit emptying the target schema before import. |
| `log_activity` | checkbox | on | Mirror each operation into the server's activity log. |
| `mysqldump_binary` / `mysql_binary` / `work_directory` **(env-only)** | — | `mysqldump` / `mysql` / `storage/app/database-manager` | Override via `DATABASE_MANAGER_MYSQLDUMP`, `DATABASE_MANAGER_MYSQL`, `DATABASE_MANAGER_WORKDIR`. |
| `export_timeout` / `import_timeout` **(env-only)** | seconds | `280` / `580` | Process limits. |

**Common mistakes:** setting `max_import_mb` above the PHP upload limits; missing `default-mysql-client` on the panel host (both binaries must be reachable by the web user).

---

### FastDL Manager {#fastdl}

Single pane: navigation label, nest allow-list, the global default URL and per-node URL overrides.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `nav_label` | text | `FastDL` | Client tab label. |
| `allowed_nests` | text | empty (every nest) | Comma-separated nest IDs the tab is available for. |
| `default_url` | url | empty | Global download base URL covering every node without its own override. |
| `max_config_bytes` **(env-only)** | number | `1048576` | Largest `server.cfg` the sync reads. |

**Managed data:** per-node URL overrides (`node_id` + `url`). Built-in game profiles: Garry's Mod, CS:GO and CS 1.6 — the profile picks the URL subdirectory and the config path; the likely profile is preselected from the server's egg.

**Deliberately dropped:** automatic web-server provisioning (nginx vhosts, TLS, file mirroring) — the competitor's version needs a node-side agent; this addon manages URLs and configs only, and its README ships a minimal vhost example.

**Common mistakes:** the rule is base URL + game directory must reach the folder holding the server's `maps/`, `models/`, `sound/` and `materials/` folders — with a vhost rooted at the volumes directory the base URL ends in the server `<uuid>`; changes apply after a restart (Source games read `server.cfg` at boot).

---

### FiveM Utils {#fivem-utils}

Single pane: tab label, egg keywords, a review of which managed variables each matching egg defines, and a one-click variable re-sync for newly imported eggs.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `nav_label` | text | `FiveM Utils` | Client tab label (`FIVEM_UTILS_NAV_LABEL`). |
| `egg_keywords` | text | `fivem,txadmin,cfx` | Egg-name keywords deciding where the page appears (`FIVEM_UTILS_EGG_KEYWORDS`). |
| `artifact_cache_minutes` **(env-only)** | number | `360` (`FIVEM_UTILS_ARTIFACT_CACHE_MINUTES`) | Artifact feed cache lifetime (a static fallback ships). |

**Managed data:** none — cards write the egg variables `GAME_BUILD`, `TXADMIN_ENABLE` / `TXADMIN_PORT`, `ARTIFACT_URL` and `MYSQL_CONNECTION_STRING`, which the installer adds to every matching egg automatically.

**Common mistakes:** `ARTIFACT_URL` is consumed by the egg's install script on the next (re)install — a custom egg may need a one-line reference; the addon sets the txAdmin port variable but does not open firewall ports on the node.

---

### Git Source Control {#github-source-control}

Single pane: host diagnostics (git version, volume root presence/writability, API base, linked-account count), settings, and the linked-account list with one-click revoke.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `nav_label` | text (max 30) | `Source Control` | Client tab label. |
| `allowed_nests` | text | empty (every nest) | Comma-separated nest IDs the feature is available for. |
| `allowed_hosts` | text | `github.com` | Comma-separated HTTPS git hosts; tokens are only ever sent to these hosts. |
| `allow_push` | checkbox | on | Off panel-wide makes every mirror read-only. |
| `allow_manual_url` | checkbox | on | Permit cloning arbitrary HTTPS URLs on allowed hosts, not just the linked account's repository list. |
| `volume_root` / `git_binary` / `command_timeout` / `api_base` **(env-only)** | — | `/var/lib/pterodactyl/volumes` / `git` / `120` s / `https://api.github.com` | `GSC_VOLUME_ROOT`, `GSC_GIT_BINARY`, `GSC_COMMAND_TIMEOUT`, `GSC_API_BASE` (point the last at a GitHub Enterprise Server, e.g. `https://git.example.com/api/v3`). |

**Managed data:** linked connections (provider profile ↔ panel user); revoking forgets the stored token immediately.

**Common mistakes:** servers whose volume is not mounted on the panel host (remote nodes without shared storage) show a clear "files not reachable" state — operations run panel-side against the volume root; pulls are fast-forward-only by design, so a diverged branch reports instead of merging.

---

### Hytale Mod Installer {#hytale-mod-installer}

Single pane: the CurseForge API key.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `curseforge_api_key` | text | empty | Required — CurseForge is currently the only public repository with a Hytale section. |
| `install_directory` **(env-only)** | path | `/mods` (`HYTALE_MOD_INSTALLER_DIRECTORY`) | Server-relative install target. |
| `http_timeout` / `cache_ttl` **(env-only)** | seconds | `15` / `900` (`HYTALE_MOD_INSTALLER_HTTP_TIMEOUT`, `…_CACHE_TTL`) | Catalogue request timeout and cache lifetime. |

**Common mistakes:** non-Hytale eggs see an explanatory notice instead of the catalogue (the installed-mod list stays available); nodes must reach the CurseForge CDN for downloads.

---

### Hytale World Manager {#hytale-world-manager}

Single pane: the CurseForge API key plus a panel-wide managed-world count.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `curseforge_api_key` | text | empty | Required — the same key as the Hytale Mod Installer works. |
| `worlds_directory` **(env-only)** | path | `/universe/worlds` (`HYTALE_WORLD_MANAGER_DIRECTORY`) | Where installed worlds land. |
| `staging_directory` **(env-only)** | path | `/.hytale-world-manager` (`HYTALE_WORLD_MANAGER_STAGING`) | Hidden staging folder for unpacks. |
| `http_timeout` / `cache_ttl` **(env-only)** | seconds | `15` / `900` (`HYTALE_WORLD_MANAGER_HTTP_TIMEOUT`, `…_CACHE_TTL`) | Catalogue request timeout and cache lifetime. |

**Common mistakes:** activate worlds while the server is offline — Hytale rewrites its `config.json` while running, so activation always applies on the next start; the world the server currently loads cannot be removed.

---

### Mod Installer {#mod-installer}

Single settings pane with provider status badges.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `curseforge_api_key` | text | empty | From the CurseForge for Studios console. Modrinth needs no key; CurseForge stays hidden from users until a key is saved. |
| `default_provider` | select | `modrinth` | Preselected repository when a user opens the Mods page. |
| `default_loader` | select | `fabric` | Preselected loader filter (`fabric`/`forge`/`quilt`/`neoforge`/any); users can change it anytime. |
| `install_directory` **(env-only)** | path | `/mods` (`MOD_INSTALLER_DIRECTORY`) | Server-relative install target. |
| `http_timeout` / `version_manifest_ttl` **(env-only)** | seconds | `15` / `86400` | Provider request timeout; Minecraft version manifest cache TTL. |
| `search_cache_ttl` **(env-only)** | seconds | `300` (`MOD_INSTALLER_SEARCH_CACHE_TTL`) | Panel-side catalogue search/version-list cache. |
| `job_timeout` **(env-only)** | seconds | `600` (`MOD_INSTALLER_JOB_TIMEOUT`) | Background download job limit. |
| `analysis_limit` **(env-only)** | bytes | `26214400` (25 MB) | Largest jar read back for update detection. |

**Common mistakes:** assuming CurseForge works without a key; blocking outbound HTTPS to `api.modrinth.com`, `api.curseforge.com` or `launchermeta.mojang.com` (panel) and the mod CDNs (nodes); CurseForge-installed jars reporting "untracked" in update checks — fingerprint matching is Modrinth-only.

---

### Modpack Installer {#modpack-installer}

Settings pane with health badges (zip extension, staging writable, per-platform status), usage counters and a recent-installs table, plus an **Installs** sub-tab (tasks running right now with phase/progress, and every pack currently tracked as installed panel-wide with its backup archive name).

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enable_modrinth` | checkbox | on | Modrinth works out of the box, no key required. |
| `enable_curseforge` | checkbox | off | Requires an API key from the CurseForge console. |
| `curseforge_api_key` | text | always rendered blank | Stored key is never shown; blank keeps it. |
| `clear_curseforge_key` | checkbox | off | Check + save to remove the stored key. |
| `button_label` | text (max 40) | `Modpacks` | File-manager button label. |
| `results_per_page` | number (5–50) | `20` | Search results per page. |
| `cache_ttl_minutes` | number (5–1440) | `30` | Platform response cache — respects catalogue rate limits. |
| `max_archive_size_mb` | number (10–2048) | `512` | Pack archives/bundles larger than this are rejected. |
| `max_files_per_pack` | number (10–20000) | `2500` | File-count cap per pack. |
| `max_staged_file_mb` / `max_staged_total_mb` | numbers | `5` / `64` | Caps for configs and other files shipped inside the pack archive. |
| `plan_rate_limit` / `plan_rate_window` | numbers | `5` / `300` | How often one user may prepare an install per server. |
| `allow_clean_install` | checkbox | on | Users may wipe the target directory before pack files land. |
| `allow_zip_backup` | checkbox | on | Users may pick *back up, wipe, then install* — current files are zipped into a `modpack-backup-<date>` archive left in the target directory first. |

Separate actions: **Clear platform cache**, **Clear staging files**, **Reset defaults** (resets limits, keeps the API key).

**Common mistakes:** missing the PHP `zip` extension or a non-writable `storage/app/modpack-installer` (both shown as pane badges); expecting egg/Docker changes — the addon installs files only, and client-only mods plus third-party-opt-out files are auto-skipped and listed on the confirmation screen; uninstalling a pack installed before 1.1.0 — there is no file manifest, so the button explains why it cannot. A background install keeps its state in the panel cache for the plan lifetime (default 45 minutes); a cache flush mid-install settles the task as a clearly-labelled failure that can simply be started again.

---

### Node Stats {#node-stats}

Sub-tabs: **Overview**, **Nodes**, **Capacity**, **Historical**, **Top Consumers**, **Reports**, **Settings**.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `collection_enabled` | yes/no radio | yes | Master switch for metric collection from Wings. |
| `collection_interval` | number (10–300) | `30` s | How often metrics are collected. |
| `retention_raw_days` | number (1–365) | `7` | Raw snapshot retention. |
| `retention_1m_days` | number (1–365) | `30` | 1-minute aggregate retention. |
| `retention_5m_days` | number (1–730) | `90` | 5-minute aggregate retention. |
| `retention_1h_days` | number (1–1825) | `365` | Hourly aggregate retention. |
| `retention_1d_days` | number (1–3650) | `1825` | Daily aggregate retention. |
| `retention.aggregates_1mo_days` **(env-only)** | number | `0` (keep forever) | Monthly aggregate retention. |

**Env-only (`config/nodeanalytics.php`):** queue name `nodeanalytics`, batch sizes (collection 50 / aggregation 500), cache TTL 60 s, `reports.max_rows` 100000.

**Common mistakes:** dashboards staying empty — the addon needs both the panel cron (the scheduler runs `nodeanalytics:schedule` every minute) **and** a Supervisor worker on the `nodeanalytics` queue (`data/install-queue-worker.sh` sets it up).

---

### Permission Manager {#permission-manager}

Sub-tabs: **Overview**, **Roles**, **Members**, **Audit Log**. No global settings form — the panes manage roles, members and scoped assignments.

**Managed data:**

- **Roles** — `name` (required), `description`, `pages[]` (which staff-area pages the role can open: Users, Servers, Nodes, Nests), `see_all_servers`, `see_all_users` (off = only explicitly assigned servers/users), `allow_build_edit` (edit CPU/memory/disk/swap/IO/feature limits via the panel's own build service), `subuser_permissions[]` (defaults to console, power actions and file read — provisioned as a *real* subuser on every in-scope server; editing re-syncs all members).
- **Members** — `user_id`, `role_id`, `active` (unchecking revokes access and provisioned subusers but keeps assignments). Per member: assign specific users (staff then see those users *and their servers*) and specific servers.
- **Config-only (`config/permissionmanager.php`):** the page list and `default_subuser_permissions` (`websocket.connect`, `control.console`, `control.start`, `control.stop`, `control.restart`, `file.read`, `file.read-content`).

**Common mistakes:** trying to delete a role that still has members (refused — reassign or remove them first); uninstalling without removing members or running `php artisan permgr:sync`, which leaves provisioned subusers behind.

---

### Player List {#player-list}

Single settings pane with a built-in host:port test tool (reports whether the full UDP query answered).

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | on | Off hides the widget panel-wide without uninstalling. |
| `protocol` | select | `auto` | `auto` (query, then ping), `query` (UDP query only), `ping` (status ping only). Query returns the full list but needs `enable-query=true`; ping needs no setup but returns only a name sample. |
| `avatars` | checkbox | on | Head images next to player names. |
| `avatar_url` **(env-only)** | url template | `https://mc-heads.net/avatar/{name}/40` (`PLAYER_LIST_AVATAR_URL`) | Avatar provider; `{name}` placeholder. A local placeholder head is used when the image cannot be loaded. |
| `actions` | checkbox | on | Moderation menu on player rows (kick, ban, op/deop, gamemode, whitelist add/remove) for users with console access. |
| `timeout_ms` | number (250–10000) | `2000` | Per probe attempt. |
| `cache_seconds` | number (0–300) | `15` | Per-server result cache — prevents query floods. |
| `poll_seconds` | number (5–300) | `20` | Browser refresh interval of the console widget. |

All UI settings also have env defaults (`PLAYER_LIST_ENABLED`, `PLAYER_LIST_PROTOCOL`, `PLAYER_LIST_AVATARS`, `PLAYER_LIST_ACTIONS`, `PLAYER_LIST_TIMEOUT_MS`, `PLAYER_LIST_CACHE_SECONDS`, `PLAYER_LIST_POLL_SECONDS`).

**Common mistakes:** expecting full player lists from servers without `enable-query=true` and the query port reachable from the panel — the ping fallback only ever returns a sample (the card's **Enable query** button writes `enable-query=true` and `query.port` for users with the file-edit permission; a restart is required); avatar images load client-side, so users' browsers need outbound access to the avatar provider.

---

### Player Manager {#player-manager}

Single settings pane plus a stored-credentials table (passwords shown only as `stored`/`—`, never the value) with revocation.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | on | Off answers the client page and every API action with a disabled notice. |
| `avatars` | checkbox | on | Head renders served through a caching panel-side proxy (browsers never contact third-party services). |
| `playerdata` | checkbox | on | Offline roster and the player-data viewer/editor (`playerdata/*.dat` via the node file API). |
| `default_port` | number (1–65535) | `25575` | Used when neither a stored override nor a server variable defines a port (vanilla default). |
| `connect_timeout` | number (1.0–15.0) | `3.0` s | RCON connect timeout. |
| `read_timeout` | number (1.0–30.0) | `4.0` s | RCON response timeout. |

**Config-only:** the server-variable names consulted when no per-server override exists — `RCON_PASSWORD`, `RCON_PORT`, `RCON_HOST` (overridable via `PLAYER_MANAGER_VARIABLE_PASSWORD/PORT/HOST`).

**Common mistakes:** servers unreachable because RCON is not enabled in `server.properties` — use the built-in **Fix RCON** button, which writes `enable-rcon=true`, `rcon.port` and `rcon.password` through the node's file API (generating and storing a password when the server has none); forgetting the credential resolution order — stored per-server override first, then server variables, host defaulting to the primary allocation; player-data edits/wipes are refused while the player is online.

---

### Plugin Installer {#plugin-installer}

Single settings pane (save only; no reset/test actions).

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `provider_modrinth` / `provider_hangar` / `provider_spiget` | checkboxes | on | Free catalogues, no API key required. Spiget lists premium resources but cannot install them. |
| `provider_curseforge` | checkbox | off | Stays unavailable until a valid API key is saved, even when toggled on. |
| `provider_polymart` | checkbox | off | Marketplace catalogue; only entries flagged downloadable are installable. |
| `curseforge_api_key` | text | empty | From the CurseForge console; empty keeps CurseForge disabled. |
| `install_directory` | text | `/plugins` | Server-relative install target — `/plugins` for Bukkit-based, `/mods` for modded setups. Normalized to a leading slash; falls back to `/plugins` when empty, `/`, containing `..`, or over 64 chars. |
| `analysis_max_mb` | number (1–100) | `15` | Jars larger than this are listed in the Installed tab but skipped for metadata extraction and update checks. |
| `provider_timeout` **(env-only)** | seconds | `20` (`PLUGIN_INSTALLER_PROVIDER_TIMEOUT`) | Catalogue request timeout. |
| `catalogue_cache_ttl` **(env-only)** | minutes | `5` (`PLUGIN_INSTALLER_CACHE_TTL`) | Panel-side cache for search, version and details responses. |

**Common mistakes:** no installs landing — nodes must reach the provider CDNs (Wings performs the download via native file-pull); strict CSP blocking provider icon hosts (icons fall back to letter placeholders).

---

### Reverse Proxy {#reverse-proxy}

Sub-tabs: **Settings**, **Whitelist** (per-server limit overrides with a server search picker), **All Proxies** (every rule on the panel with server, owner, node, SSL and DNS status, plus delete for moderation).

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `allowed_nodes[]` | checkboxes | empty (all nodes) | Restrict the feature to specific nodes. |
| `default_proxy_limit` | number (0–1000) | `3` | Proxy rules each server may create. |
| `whitelist_enabled` | checkbox | off | Whitelist mode gives individual servers their own limit. |

**Managed data:** whitelist entries (`server`, `proxy_limit` 0–1000). Client rules carry `domain` (unique panel-wide), `allocation_id`, `ssl_type` (`none` / `letsencrypt` / `custom`) plus `ssl_email` or `ssl_certificate` + `ssl_key` — certificate material is write-only and never leaves the panel again.

**Deliberately dropped:** automatic node-side provisioning — answering traffic for the domain needs a web server on the node, and the competitor's automation needs a node-side agent; this addon stores/validates the rules and renders a copy-paste nginx server block per rule instead.

**Common mistakes:** a rule shows "DNS pending" until the domain's A record resolves to the node's public address; raw TCP/UDP game protocols are better served by SRV records (see [Subdomain Manager](#subdomain-manager)) or an nginx `stream` block.

---

### Server Importer {#server-importer}

Sub-tabs: **Overview** (connections + runs) and **Run report**. No persistent settings — all inputs are per-operation.

**Managed data:**

- **Connections** — `name`, `base_url` (public root URL of the source panel), `token` (Application API key `ptla_…`, min 16 chars, stored encrypted, with read access to servers, users, nodes, nests and eggs), `verify_tls` (on; uncheck for self-signed panels).
- **Runs (dry run form)** — `connection_id`, `target_node_id` (allocations claimed from its free pool), `fallback_egg_id` (optional; unmatched eggs otherwise become conflicts), `owner_strategy` (`map` by email / `fixed` one account), `fixed_user_id`, `create_missing_users`, `include_suspended`, `skip_scripts`.
- **Config-only (`config/server-importer.php`):** `per_page` 50, `timeout` 15 s, `connect_timeout` 8 s, `max_servers_per_run` 500.

**Common mistakes:** skipping the dry run — it builds the full conflict report and changes nothing; executing against a node without enough free allocations (claims are re-verified between dry run and import). Rollback force-deletes every server a run created.

---

### Server Properties {#server-properties}

Single settings pane.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `nav_label` | text (max 30) | `Properties` | Label of the tab in the server sub-navigation. |
| `file_name` | text (max 64) | `server.properties` | File in the server root the editor reads/writes. Bare file names only. |
| `allowed_nests` | text | `1` | Comma-separated nest IDs the editor is available for (`1` = stock Minecraft). Empty = every nest. |
| `show_descriptions` | checkbox | on | Short explanation under each known key. |
| `enable_motd` | checkbox | on | MOTD editor (legacy `§` codes, MiniMessage, raw) with live server-list preview. |
| `enable_icon` | checkbox | on | Server icon manager — center-crop to exactly 64×64 PNG, verified again server-side. |
| `enable_yaml` | checkbox | on | Auto-detected YAML editor for root-level `.yml`/`.yaml` files, with BungeeCord-style proxy support and a raw mode. |
| `max_file_bytes` **(env-only)** | number | `1048576` (`SERVERPROPERTIES_MAX_FILE_BYTES`) | Refuse to read files larger than this. |

The four original UI settings also have env defaults (`SERVERPROPERTIES_NAV_LABEL`, `SERVERPROPERTIES_FILE_NAME`, `SERVERPROPERTIES_ALLOWED_NESTS`, `SERVERPROPERTIES_SHOW_DESCRIPTIONS`).

**Common mistakes:** expecting instant effect — Minecraft reads `server.properties`, `server-icon.png` and the YAML files at boot, so changes apply after a restart; the structured YAML editor rewrites the file from the parsed structure, so YAML comments are not preserved there (use raw mode for hand-tuned files); MiniMessage `<rainbow>` tags are not rendered in the MOTD preview and show literally.

---

### Server Splitter {#server-splitter}

Sub-tabs: **Overview** (counters + policy summary), **Whitelist**, **Splits**, **Link Servers**, **Settings**.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | on | Master switch for the client Splitter page. |
| `allow_unlimited` | checkbox | on | Unlimited masters (limit `0`) may hand out unlimited sub-servers. |
| `whitelist_only` | checkbox | off | Only whitelisted servers may split. |
| `whitelist_fallback` | checkbox | on | When a server has both a whitelist entry and matching rules, the higher allowance wins. |
| `min_master_cpu` / `min_master_memory` / `min_master_disk` | numbers | `50` / `512` / `1024` | Must remain on the master after a split (% / MB / MB). |
| `min_sub_cpu` / `min_sub_memory` / `min_sub_disk` | numbers | `25` / `128` / `512` | Every sub-server must receive at least this. |
| `max_ports_per_sub` **(env-only)** | number | `10` (`SERVER_SPLITTER_MAX_PORTS`) | Port cap per sub-server. |
| `sub_description` **(env-only)** | text | `Sub-server of {master}` (`SERVER_SPLITTER_SUB_DESCRIPTION`) | Description template for created sub-servers. |

**Managed data:** whitelist entries (per-server fixed limits), resource-graded rules ("at least 1 GB RAM may run 2 sub-servers") checked in an admin-defined `priority` order, and admin links (`master_server_id` ↔ `sub_server_id`) that attach an existing standalone server without moving resources.

**Common mistakes:** a sub-server stuck in the *installing* state means the node was unreachable at creation — the bookkeeping is still correct, so reinstall it (or remove the split) once the node answers; after deleting sub-servers outside the splitter, run `php artisan server-splitter:reconcile` to credit the master back and clear stale markers.

---

### Server Type Changer {#server-type-changer}

Sub-tabs: **Overview** (settings + the last 25 change runs across all servers) and **Whitelist** (per-server grants by short identifier or UUID, with a name/identifier search helper).

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | off | Master switch — the client page and API stay off until enabled. |
| `allow_nest_changes` | checkbox | on | Permit cross-nest moves. |
| `allow_egg_changes` | checkbox | on | Permit in-nest egg swaps. |
| `blocked_nests[]` / `blocked_eggs[]` | multi-selects | empty | Nests/eggs excluded from selection. |
| `event_retention` | number (1–200) | `25` | History entries kept per server. |

**Managed data:** whitelist grants; without one the nav entry stays hidden and the API rejects requests (root admins and the `settings.reinstall` permission govern access).

**Common mistakes:** a failed safety backup aborts the whole change before anything is touched — that is the point, check backup capacity instead of retrying blindly; suspended, installing, restoring or transferring servers are rejected until they settle; node-unreachable steps complete as *completed with warnings* naming the exact step that could not run.

---

### Staff Requests {#staff-requests}

Single pane: policy settings, stat tiles, staff roster management, recent requests (with type + urgent badges and message previews), active grants, audit trail (the three tables are read-only; approve/deny/revoke happens on the user side).

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `access_mode` | select | `everyone` | Who can use Staff Requests: `everyone`, `allowlist`, `blacklist`. Root admins always bypass. |
| `allowlist` | textarea | empty | One email per line; only these accounts may use the feature (shown when mode = allowlist). |
| `blacklist` | textarea | empty | One email per line; these accounts are blocked (shown when mode = blacklist). |
| `request_decay_hours` | number (1–8760) | `24` | Unanswered requests expire after this; runs on the panel's schedule cron. |
| `block_rate_limit` | number (1–1000) | `10` | Block-user actions per user per minute. |
| `request_ttl_days` **(env-only)** | number | `14` (`ASKACCESS_REQUEST_TTL_DAYS`) | Separate backend validity window for pending requests — distinct from `request_decay_hours`. |
| `max_pending_per_user` **(env-only)** | number | `25` (`ASKACCESS_MAX_PENDING`) | Pending-request cap per user. |
| `create_rate_limit` / `create_rate_window_minutes` **(env-only)** | numbers | `15` / `60` | Request-creation rate limit. |
| `max_servers_per_grant` **(env-only)** | number | `250` | Cap on servers touched by a single "all servers" approval. |

**Managed data (staff roster):** `email` (required — the account is added by email, never enumerated) and an optional role `label` like "Support". Roster members receive owner-initiated **Request Staff Help** requests; usernames are shown to users, emails are never exposed, and staff can still opt out via their own accept-requests toggle or blocks.

**Common mistakes:** confused by the two expiry knobs (`request_decay_hours` in the UI vs `request_ttl_days` in env — both exist); expecting uninstall to clean up granted access — approved requests created **real subuser rows** that survive uninstall.

---

### Subdomain Manager {#subdomain-manager}

Sub-tabs: **Settings**, **Domains**, **Records**, **Limits**.

**Settings tab** (`admin.subdomainplus.settings`, plus **Test Cloudflare connection**):

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `cf_token` | password | empty | Cloudflare API token with **Zone / DNS / Edit**. Placeholder shows "(saved - enter to change)" once set. |
| `cf_email` / `cf_api_key` | email / password | empty | Deprecated Global API Key mode — only use when a token is impossible. |
| `default_quota` | number (0–100) | `5` | DNS records per server; `0` = unlimited. |
| `rate_per_minute` | number (1–120) | `5` | Requests per minute per server. |

**Managed data (domains):** `domain` and `zone_id` (required — or click **Fetch zones from Cloudflare** to pick from your account and auto-fill both), `allow_srv_record` / `allow_a_record` (both on), `allow_cname_record` (on; a requested A record becomes a CNAME when the allocation alias is a hostname — the *Use allocation IP* checkbox keeps the old behavior), `target_ip` (optional forced IP; empty auto-resolves from each server's allocation FQDN), SRV presets (`service` default `_minecraft`, `proto` `_tcp`/`_udp`, `priority` 0, `weight` 5, `ttl` 1 = automatic), `banned_patterns` (PHP regex, one per line), `allowed_eggs[]` (empty = all).

**Managed data (Limits tab):** per-server quota overrides (`server_id` + `quota`) and the node policy — `node_policy` (allow or deny) with `node_ids[]`; restricted servers keep viewing/deleting existing records but cannot create new ones.

**Common mistakes:** a token without Zone / DNS / Edit scope; expecting proxied records — the addon always creates unproxied records (SRV and CNAME require it); missing the panel cron, which drives `subdomainplus:sync-all` and orphan cleanup. The create form's live availability check blocks known-taken names before submit.

---

### Version Changer {#version-changer}

Settings pane plus a recent-changes table (saving settings also flushes the manifest cache), and a **Server Access** sub-tab for per-server grants (by short id or UUID).

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | on | Off hides the picker in the client panel and rejects installs. |
| `allowed_software[]` | checkboxes | all | Software entries users may see: `vanilla`, `paper`, `purpur`, `folia`, `velocity`, `waterfall`. |
| `allowed_types[]` | checkboxes | `release` only | Vanilla version types users may install: `release`, `snapshot`, `old_beta`, `old_alpha`. |
| `allow_wipe` | checkbox | on | Permit the archive-then-wipe and plain-wipe data options per install. |
| `require_grant` | checkbox | off | Restrict the feature to servers on the Server Access list. |
| `default_filename` | text | `server.jar` | Target jar name; must match a plain `.jar` file name (validated, resets to `server.jar` otherwise). |
| `cache_ttl` | number (60–86400) | `300` | Seconds the version/build catalogues are cached. |
| `history_limit` | number (0–500) | `50` | History entries kept per server, pruned after each install. |
| `allow_filename_choice` | checkbox | on | Let users override the jar name per install. |
| `backup_previous` | checkbox | on | Rename the current jar to `<name>.backup-<timestamp>` before writing (keep-files installs). |
| `update_startup_variable` | checkbox | on | Point the egg's `SERVER_JARFILE` variable at the new jar. |
| `manifest_url` / `http_timeout` / `http_retries` **(env-only)** | — | piston-meta URL / `10` / `2` | Vanilla version-service endpoint and HTTP tuning (`VERSION_CHANGER_MANIFEST_URL`, `VERSION_CHANGER_HTTP_TIMEOUT`, `VERSION_CHANGER_HTTP_RETRIES`). |

**Common mistakes:** assuming a mirror manifest widens download sources — jar downloads are pinned to the official hosts of each software (`mojang.com` / `minecraft.net`, `papermc.io`, `purpurmc.org`) regardless of the catalogue endpoints; expecting the running server to switch jars live — the old jar runs until the next restart.

---

### Votifier Tester {#votifier-tester}

Single pane: global toggle, default port and timeouts.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | on | Off disables the client page and API panel-wide. |
| `default_port` | number (1–65535) | `8192` | Pre-filled listener port on the test form. |
| `connect_timeout` | number (1–15) | `5.0` s | TCP connect timeout. |
| `read_timeout` | number (1–30) | `5.0` s | Response timeout. |
| `service_name` **(env-only)** | text | `VotifierTest` (`VOTIFIER_TESTER_SERVICE_NAME`) | Service name sent in test votes. |

**Common mistakes:** the listener port must be reachable from the panel host (open the firewall / publish it for remote nodes); a well-formed vote is answered with silence — a clean handshake plus transmission counts as a pass, and the reward event shows up in the server console; tokens and public keys travel with the test only and are never persisted.

---

### World Manager {#mc-world-manager}

Single settings pane.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `curseforge_api_key` | text | empty | From the CurseForge console; the catalogue stays unavailable to users until one is saved. |
| `default_sort` | select | `downloads` | Preselected catalogue ordering. |
| `nav_label` | text (max 32) | `Worlds` | Client tab label. |
| `catalog_ttl` | number (60–86400) | `900` | Catalogue cache lifetime in seconds. |
| `http_timeout` / `version_manifest_ttl` / `progress_ttl` **(env-only)** | seconds | `15` / `86400` / `600` (`MC_WORLD_MANAGER_HTTP_TIMEOUT`, `…_MANIFEST_TTL`, `…_PROGRESS_TTL`) | Request timeout, MC version manifest cache, install progress record lifetime. |

**Common mistakes:** archives Wings cannot unpack (rar, 7z, plain gzip) are rejected with a clear message — repack as zip; switching the active world rewrites `level-name` in `server.properties`, so restart to play; manually uploaded worlds under a different directory name simply show without a catalogue badge.

---

## What's Next?

- **[The Hub Dashboard →](../user-guide/dashboard.md)** — how panes, sub-tabs and saves work.
- **[Addons Guide →](../user-guide/addons.md)** — per-addon usage notes and client surfaces.
