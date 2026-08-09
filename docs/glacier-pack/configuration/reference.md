---
title: Configuration Reference — Glacier Pack
description: Every setting on every Glacier Pack addon pane — name, type, default, what it does, when to change it, and common mistakes — grouped per addon.
outline: deep
---

# Configuration Reference

Every setting that actually exists on the 24 Glacier Pack addon panes, grouped per addon with an anchor each. Settings marked **(env-only)** live in the addon's config file and are tuned via `.env`, not the hub. Addons that manage *records* instead of settings (rules, destinations, alerts) list those fields under **Managed data**.

::: tip
All saves go through the hub's `_hub` round-trip: you always land back on the same pane, with validation errors shown above the form when a value is rejected.
:::

---

## Basic pack

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

No settings — the pane is a read-only, filterable record (user / date-range filters, pagination). Deleted users show as "Deleted user #id".

| Setting | Type | Default | What it does |
| --- | --- | --- | --- |
| `admin_per_page` **(env-only)** | number | `25` (`LOGIN_ACTIVITY_ADMIN_PER_PAGE`) | Rows per page on the admin overview (clamped 1–100). |
| `client_per_page` **(env-only)** | number | `8` (`LOGIN_ACTIVITY_CLIENT_PER_PAGE`) | Rows per page in the account-area widget. |

**Common mistakes:** none — there is nothing to misconfigure. History is kept on uninstall unless you pass `--drop-table` to `remove.sh`.

---

### Move Files {#move-files}

No settings at all — the pane is an informational card. The addon enhances every server's file manager automatically once installed; there is no config file and no backend.

**Common mistakes:** forgetting a hard refresh (`Ctrl+Shift+R`) on the Files page after install, and forgetting to re-run `install.sh` after panel updates overwrite `templates/base/core.blade.php`.

---

### Node Status {#node-status}

Sub-tabs: **Overview** (settings + per-node overrides) and **Service Updates** (posts). Settings save to `admin.uptime.settings`.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | on | Master switch — off hides the Uptime tab and stops collection. |
| `poll_interval` | select | `60` s (30 / 60 / 120 / 300) | How often the panel polls Wings. Lower = fresher graphs, more node load. |
| `retention_days` | select | `90` (30–365) | Nightly pruning horizon; the graph window maxes at 365 days. |
| `users_see_node_uptime` | checkbox | on | Whether regular users see node health data. |
| `show_node_names` | checkbox | off | Off masks real node names/FQDNs for users ("Your Node", "Node 1"); admins always see real names. |
| `job_timeout` / `node_connect_timeout` / `cache_ttl` **(env-only)** | numbers | `45` / `3` / `300` | Collection job timeout, per-node connect timeout, cache TTL (seconds). |

**Managed data:** per-node tracking overrides (toggle per node), and Service Update posts with `title` (required), `event_at` (optional — renders a live countdown) and `body_html` (required; whitelisted basic HTML).

**Common mistakes:** missing the panel cron — collection (`uptime:collect`) and pruning run via the scheduler; forgetting the `uptime.read` subuser permission, without which users see no Uptime tab.

---

### Panel Logs {#panel-logs}

No settings form — a tool pane with a file list and a tail viewer (level filters, 2/5/10/30 s auto-refresh, download, clear, delete).

| Setting | Type | Default | What it does |
| --- | --- | --- | --- |
| `PANEL_LOGS_TAIL_LINES` **(env-only)** | number | `400` | Lines of context loaded when a log opens. |
| `PANEL_LOGS_SCAN_BYTES` **(env-only)** | number | `4194304` (4 MiB) | Backwards scan budget for the initial tail. |
| `PANEL_LOGS_POLL_MAX_BYTES` **(env-only)** | number | `524288` (512 KiB) | Max bytes per poll response. |
| `PANEL_LOGS_POLL_INTERVAL` **(env-only)** | number | `5` (seconds) | Default auto-refresh interval in the viewer. |

**Common mistakes:** none — the panel recreates a cleared or deleted log file automatically on the next write.

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

**Managed data:** per-egg overrides — `egg_id` (required), `retention_hours` (blank inherits global), `max_mb` (blank inherits global).

**Common mistakes:** leaving capacity unlimited on busy nodes (trash eats real disk); forgetting `yarn build:production` after install **and** after uninstall; not re-running `install.sh` after panel updates overwrite the patched core files.

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

### Mod Installer {#mod-installer}

Single settings pane with provider status badges.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `curseforge_api_key` | text | empty | From the CurseForge for Studios console. Modrinth needs no key; CurseForge stays hidden from users until a key is saved. |
| `default_provider` | select | `modrinth` | Preselected repository when a user opens the Mods page. |
| `default_loader` | select | `fabric` | Preselected loader filter (`fabric`/`forge`/`quilt`/`neoforge`/any); users can change it anytime. |
| `install_directory` **(env-only)** | path | `/mods` (`MOD_INSTALLER_DIRECTORY`) | Server-relative install target. |
| `http_timeout` / `version_manifest_ttl` **(env-only)** | seconds | `15` / `86400` | Provider request timeout; Minecraft version manifest cache TTL. |

**Common mistakes:** assuming CurseForge works without a key; blocking outbound HTTPS to `api.modrinth.com`, `api.curseforge.com` or `launchermeta.mojang.com` (panel) and the mod CDNs (nodes).

---

### Modpack Installer {#modpack-installer}

Single settings pane with health badges (zip extension, staging writable, per-platform status), usage counters and a recent-installs table.

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

Separate actions: **Clear platform cache**, **Clear staging files**, **Reset defaults** (resets limits, keeps the API key).

**Common mistakes:** missing the PHP `zip` extension or a non-writable `storage/app/modpack-installer` (both shown as pane badges); expecting egg/Docker changes — the addon installs files only, and client-only mods plus third-party-opt-out files are auto-skipped and listed on the confirmation screen.

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

Single settings pane with a built-in host:port test tool.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | on | Off hides the widget panel-wide without uninstalling. |
| `protocol` | select | `auto` | `auto` (query, then ping), `query` (UDP query only), `ping` (status ping only). Query returns the full list but needs `enable-query=true`; ping needs no setup but returns only a name sample. |
| `timeout_ms` | number (250–10000) | `2000` | Per probe attempt. |
| `cache_seconds` | number (0–300) | `15` | Per-server result cache — prevents query floods. |
| `poll_seconds` | number (5–300) | `20` | Browser refresh interval of the console widget. |

All five also have env defaults (`PLAYER_LIST_ENABLED`, `PLAYER_LIST_PROTOCOL`, `PLAYER_LIST_TIMEOUT_MS`, `PLAYER_LIST_CACHE_SECONDS`, `PLAYER_LIST_POLL_SECONDS`).

**Common mistakes:** expecting full player lists from servers without `enable-query=true` and the query port reachable from the panel — the ping fallback only ever returns a sample.

---

### Player Manager {#player-manager}

Single settings pane plus a stored-credentials table (passwords shown only as `stored`/`—`, never the value).

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | on | Off answers the client page and every API action with a disabled notice. |
| `default_port` | number (1–65535) | `25575` | Used when neither a stored override nor a server variable defines a port (vanilla default). |
| `connect_timeout` | number (1.0–15.0) | `3.0` s | RCON connect timeout. |
| `read_timeout` | number (1.0–30.0) | `4.0` s | RCON response timeout. |

**Config-only:** the server-variable names consulted when no per-server override exists — `RCON_PASSWORD`, `RCON_PORT`, `RCON_HOST` (overridable via `PLAYER_MANAGER_VARIABLE_PASSWORD/PORT/HOST`).

**Common mistakes:** servers unreachable because RCON is not enabled in `server.properties` (`enable-rcon=true`, `rcon.port`, `rcon.password`) or the port is firewalled from the panel host; forgetting the credential resolution order — stored per-server override first, then server variables, host defaulting to the primary allocation.

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

**Common mistakes:** no installs landing — nodes must reach the provider CDNs (Wings performs the download via native file-pull); strict CSP blocking provider icon hosts (icons fall back to letter placeholders).

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
| `max_file_bytes` **(env-only)** | number | `1048576` (`SERVERPROPERTIES_MAX_FILE_BYTES`) | Refuse to read files larger than this. |

All four UI settings also have env defaults (`SERVERPROPERTIES_NAV_LABEL`, `SERVERPROPERTIES_FILE_NAME`, `SERVERPROPERTIES_ALLOWED_NESTS`, `SERVERPROPERTIES_SHOW_DESCRIPTIONS`).

**Common mistakes:** expecting instant effect — Minecraft reads `server.properties` at boot, so changes apply after a restart; pointing `file_name` at a path (only a bare name is accepted).

---

### Staff Requests {#staff-requests}

Single pane: policy settings, stat tiles, recent requests, active grants, audit trail (the three tables are read-only; approve/deny/revoke happens on the user side).

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

**Common mistakes:** confused by the two expiry knobs (`request_decay_hours` in the UI vs `request_ttl_days` in env — both exist); expecting uninstall to clean up granted access — approved requests created **real subuser rows** that survive uninstall.

---

### Subdomain Manager {#subdomain-manager}

Sub-tabs: **Settings**, **Domains**, **Records**.

**Settings tab** (`admin.subdomainplus.settings`, plus **Test Cloudflare connection**):

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `cf_token` | password | empty | Cloudflare API token with **Zone / DNS / Edit**. Placeholder shows "(saved - enter to change)" once set. |
| `cf_email` / `cf_api_key` | email / password | empty | Deprecated Global API Key mode — only use when a token is impossible. |
| `default_quota` | number (0–100) | `5` | DNS records per server; `0` = unlimited. |
| `rate_per_minute` | number (1–120) | `5` | Requests per minute per server. |

**Managed data (domains):** `domain` and `zone_id` (required), `allow_srv_record` / `allow_a_record` (both on), `target_ip` (optional forced IP; empty auto-resolves from each server's allocation FQDN), SRV presets (`service` default `_minecraft`, `proto` `_tcp`/`_udp`, `priority` 0, `weight` 5, `ttl` 1 = automatic), `banned_patterns` (PHP regex, one per line), `allowed_eggs[]` (empty = all).

**Common mistakes:** a token without Zone / DNS / Edit scope; expecting proxied records — the addon always creates unproxied records (SRV requires it); missing the panel cron, which drives `subdomainplus:sync-all` and orphan cleanup.

---

### Version Changer {#version-changer}

Single settings pane plus a recent-changes table. Saving settings also flushes the manifest cache.

| Setting | Type | Default | What it does / when to change |
| --- | --- | --- | --- |
| `enabled` | checkbox | on | Off hides the picker in the client panel and rejects installs. |
| `allowed_types[]` | checkboxes | `release` only | Version types users may install: `release`, `snapshot`, `old_beta`, `old_alpha`. |
| `default_filename` | text | `server.jar` | Target jar name; must match a plain `.jar` file name (validated, resets to `server.jar` otherwise). |
| `cache_ttl` | number (60–86400) | `300` | Seconds the Mojang version manifest is cached. |
| `history_limit` | number (0–500) | `50` | History entries kept per server, pruned after each install. |
| `allow_filename_choice` | checkbox | on | Let users override the jar name per install. |
| `backup_previous` | checkbox | on | Rename the current jar to `<name>.backup-<timestamp>` before writing. |
| `update_startup_variable` | checkbox | on | Point the egg's `SERVER_JARFILE` variable at the new jar. |
| `manifest_url` / `http_timeout` / `http_retries` **(env-only)** | — | piston-meta URL / `10` / `2` | Version-service endpoint and HTTP tuning (`VERSION_CHANGER_MANIFEST_URL`, `VERSION_CHANGER_HTTP_TIMEOUT`, `VERSION_CHANGER_HTTP_RETRIES`). |

**Common mistakes:** assuming a mirror manifest widens download sources — jar downloads are pinned to `mojang.com` / `minecraft.net` regardless; expecting the running server to switch jars live — the old jar runs until the next restart.

---

## What's Next?

- **[The Hub Dashboard →](../user-guide/dashboard.md)** — how panes, sub-tabs and saves work.
- **[Addons Guide →](../user-guide/addons.md)** — per-addon usage notes and client surfaces.
