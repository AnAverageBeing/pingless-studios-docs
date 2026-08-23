---
title: Configuration Reference
description: Every Pterodactyl Revamp configuration surface — the revamp_settings keys with defaults and validation rules, config/revamp.php, the REVAMP_BULK_SYNC env var, and the Blueprint conf.yml / Components.yml manifests.
---

# Configuration Reference

Pterodactyl Revamp has **four configuration surfaces**, each serving a different purpose:

| Surface | Where it lives | Who changes it |
|---|---|---|
| [Runtime settings](#runtime-settings-revamp-settings) | `revamp_settings` database table, edited at `/admin/revamp/settings` | Panel admins, any time |
| [`config/revamp.php`](#config-revamp-php) | Panel root `config/` folder | Rarely — set at install time |
| [`REVAMP_BULK_SYNC`](#revamp-bulk-sync) | `.env` / server environment | Debugging or worker-less setups |
| [Blueprint manifests](#blueprint-manifest-conf-yml) | `conf.yml` / `Components.yml` inside the extension | Extension packaging only — not runtime |

Most admins only ever touch the first one. The rest of this page documents every key, in order of how likely you are to need it.

---

## Runtime Settings (`revamp_settings`)

All runtime settings are stored as key-value rows in the **`revamp_settings`** table (primary key `key`, column `value`). Reads go through `RevampSettingsRepository`, which caches every key for **5 minutes** — writes through the admin UI flush the cache entry immediately, so changes made in the panel are live on the next request.

If a key has no row in the table, the typed default from the repository's `DEFAULTS` constant is used. This means you can delete a row to revert that key to its default.

::: warning Editing the table directly
If you change `revamp_settings` rows with SQL instead of the admin UI, the 5-minute cache is **not** flushed. Either wait for the TTL or run `php artisan cache:clear` afterwards.
:::

### Settings page map

The settings form lives at **`/admin/revamp/settings`** (route `admin.revamp.settings`, root admins only) and posts to `admin.revamp.settings.update`. Every field is validated by `UpdateSettingsRequest` — the rules below are the hard limits; out-of-range values are rejected with a form error.

| UI section | UI field | Settings key | Default | Validation |
|---|---|---|---|---|
| Auto-Naming | Naming Pattern | `naming_pattern` | `{server_id} - {username}` | required, string, max 191 |
| Allocations | Allocations per Page | `allocation_page_size` | `50` | required, integer, 10–200 |
| Metrics & Upgrade Suggestions | Raw Sample Retention (days) | `metrics_retention_days` | `90` | required, integer, 7–3650 |
| Metrics & Upgrade Suggestions | CPU Threshold (%) | `upgrade_cpu_threshold` | `85` | required, integer, 1–100 |
| Metrics & Upgrade Suggestions | RAM Threshold (%) | `upgrade_ram_threshold` | `85` | required, integer, 1–100 |
| Metrics & Upgrade Suggestions | Disk Threshold (%) | `upgrade_disk_threshold` | `90` | required, integer, 1–100 |
| Metrics & Upgrade Suggestions | Evaluation Window (hours) | `upgrade_window_hours` | `72` | required, integer, 1–8760 |
| Metrics & Upgrade Suggestions | Suggestion Cooldown (hours) | `upgrade_cooldown_hours` | `168` | required, integer, 1–8760 |
| Metrics & Upgrade Suggestions | Suggestion Message | `upgrade_message` | see below | required, string, max 500 |
| Health & Instability Detection | Crash Loop Threshold (restarts) | `health_crash_threshold` | `5` | required, integer, 1–100 |
| Health & Instability Detection | Health Window (hours) | `health_window_hours` | `24` | required, integer, 1–168 |
| Health & Instability Detection | Health Data Retention (days) | `health_retention_days` | `30` | required, integer, 1–365 |
| Health & Instability Detection | Node Warn Pressure (%) | `node_pressure_warn_pct` | `75` | required, integer, 1–99 |
| Health & Instability Detection | Node Critical Pressure (%) | `node_pressure_crit_pct` | `90` | required, integer, 1–100 |
| Bulk Operations | Enable bulk server move | `bulk_move_enabled` | `false` (off) | required, boolean |

The default `upgrade_message` is:

```
Your server may benefit from a larger plan based on recent resource usage.
```

**Every key above has a settings-page UI.** The only runtime key *not* on this page is [`tags_visible_to_users`](#tags-visible-to-users), which is toggled from the Tags page instead.

---

### `naming_pattern`

- **Type:** string · **Default:** `{server_id} - {username}` · **UI:** Settings page

The auto-naming pattern applied when servers are created through Revamp's multi-server create flow (and anywhere else `NamingPatternEngine` is used). The pattern is resolved by `NamingPatternEngine::resolve()` at creation time.

**Supported tokens** (anything else is left in the name literally):

| Token | Resolves to | Example output |
|---|---|---|
| `{server_id}` | Sequential server id supplied by the caller | `42` |
| `{username}` | Owner's username (`admin` if unknown) | `steve` |
| `{ram}` | Memory limit — **includes the `MB` suffix** | `4096MB` |
| `{disk}` | Disk limit — **includes the `MB` suffix** | `10240MB` |
| `{cpu}` | CPU limit — **includes the `%` suffix** | `200%` |
| `{egg}` | Egg name (`unknown` if unset) | `Minecraft` |
| `{node}` | Node name (`unknown` if unset) | `node-01` |
| `{index}` | 1-based position within a batch create | `3` |

**When to change it:** when you want multi-created servers to sort or read consistently in the server list — e.g. `{egg} #{index} - {username}`.

**Common mistakes:**

- Adding your own unit suffixes: `{ram}MB` renders as `4096MBMB`, and `{cpu}%` renders as `200%%`. The units are already baked into the token.
- Expecting arbitrary characters to survive: after token replacement the engine strips everything outside `[\w\s\-_.:()\[\]#@]` and truncates to 191 characters, so emoji and most punctuation silently disappear.

---

### `allocation_page_size`

- **Type:** integer · **Default:** `50` · **Range:** 10–200 · **UI:** Settings page

How many allocations the allocation port picker loads per page when you browse a node's ports (`AllocationPickerService`).

**When to change it:** raise it on nodes with many free ports so admins scroll less; lower it if the picker feels slow on very large nodes.

**Common mistake:** setting it below 10 or above 200 — the form validation rejects anything outside that range.

---

### `metrics_retention_days`

- **Type:** integer · **Default:** `90` · **Range:** 7–3650 · **UI:** Settings page

How long raw metric samples are kept in `revamp_metric_samples`. Samples are collected every 5 minutes by the scheduled `revamp:sample-metrics` command (rolled up hourly by `revamp:rollup-metrics`), and `MetricSamplingService` prunes rows older than this window.

**When to change it:** lower it if the metrics table grows too large on busy panels; raise it if you need longer trend history in analytics.

**Common mistake:** cranking it to the maximum on a panel with hundreds of servers — raw samples accrue every 5 minutes per server, so retention directly multiplies table size. The hourly rollups are the long-term store; raw samples are the short-term one.

---

### `upgrade_cpu_threshold` / `upgrade_ram_threshold` / `upgrade_disk_threshold`

- **Type:** integer (percent) · **Defaults:** `85` / `85` / `90` · **Range:** 1–100 · **UI:** Settings page

Utilization percentages the `UpgradeRuleEngine` compares against a server's recent usage. When usage stays at or above a threshold across the evaluation window, an upgrade suggestion is generated for that server.

**When to change them:** lower them to surface suggestions earlier (more aggressive upsell), raise them to only flag genuinely saturated servers.

**Common mistake:** treating these as instantaneous triggers — a single spike does nothing; usage must stay high across `upgrade_window_hours`.

---

### `upgrade_window_hours`

- **Type:** integer (hours) · **Default:** `72` · **Range:** 1–8760 · **UI:** Settings page

The lookback window the `UpgradeRuleEngine` evaluates usage over before suggesting an upgrade.

**When to change it:** shorten it for faster reaction to sustained load; lengthen it to smooth out weekend spikes and only catch chronic pressure.

**Common mistake:** setting it shorter than your metric sampling cadence can cover — the scheduler samples every 5 minutes, so a 1-hour window gives the engine only ~12 samples to judge from.

---

### `upgrade_cooldown_hours`

- **Type:** integer (hours) · **Default:** `168` (7 days) · **Range:** 1–8760 · **UI:** Settings page

Minimum time before the same server can receive another upgrade suggestion.

**When to change it:** lower it if you want dismissed or ignored suggestions to reappear sooner; raise it to nag less.

**Common mistake:** setting it to `0`-like values to "re-test" suggestions — the form enforces a minimum of 1 hour.

---

### `upgrade_message`

- **Type:** string · **Default:** `Your server may benefit from a larger plan based on recent resource usage.` · **Limit:** 500 chars · **UI:** Settings page

The message text attached to generated upgrade suggestions.

**When to change it:** to match your panel's tone or to point users at your upgrade/ordering flow.

---

### `health_crash_threshold`

- **Type:** integer (restarts) · **Default:** `5` · **Range:** 1–100 · **UI:** Settings page

How many restarts inside the health window mark a server as a crash-looping / unstable server. Used by both `ServerHealthService` and `NodeHealthService` when the scheduled `revamp:compute-health` command (every 10 minutes) builds health snapshots.

**When to change it:** raise it for eggs that legitimately restart often (e.g. auto-restart-on-crash setups) so they stop flagging; lower it to catch instability earlier.

---

### `health_window_hours`

- **Type:** integer (hours) · **Default:** `24` · **Range:** 1–168 · **UI:** Settings page

The rolling window in which restarts are counted against `health_crash_threshold`.

**When to change it:** shorten it so only *recent* crash loops flag; lengthen it to catch slow-burn instability.

**Common mistake:** pairing a long window with a low threshold — that combination flags almost every server that restarts occasionally.

---

### `health_retention_days`

- **Type:** integer (days) · **Default:** `30` · **Range:** 1–365 · **UI:** Settings page

How long computed health snapshots are retained. `ComputeHealthJob` prunes snapshots older than this on each run.

**When to change it:** raise it if you use the health pages for longer-term node trend review; lower it to keep the `revamp_server_health_snapshots` and `revamp_node_health_snapshots` tables small.

---

### `node_pressure_warn_pct` / `node_pressure_crit_pct`

- **Type:** integer (percent) · **Defaults:** `75` / `90` · **Ranges:** 1–99 / 1–100 · **UI:** Settings page

The pressure percentages at which `NodeHealthService` grades a node as **warning** or **critical** on the health pages.

**When to change them:** align them with your real overcommit policy — e.g. if you deliberately overcommit RAM, the default warn level may flag healthy nodes.

**Common mistake:** setting warn **above** crit. The form validates each field independently (warn 1–99, crit 1–100) but does **not** check their ordering, so `warn=95, crit=90` saves fine and produces inverted grading. Keep warn below crit.

---

### `bulk_move_enabled`

- **Type:** boolean · **Default:** `false` (off) · **UI:** Settings page (danger-styled box)

Master switch for the **bulk move** bulk-operation type. `BulkMoveService` refuses to run while this is off.

::: danger Bulk move does not transfer server data
Enabling `bulk_move_enabled` only allows Revamp to **re-point the panel's database records** (node and allocation) for the selected servers. It does **not** transfer any server data through Wings. A "moved" server keeps its files on the old node and will be broken until a real data transfer happens separately. Only enable this if you have an external migration process that handles the bytes.
:::

**When to change it:** only while you are actively running a record-only re-point migration, then turn it back off.

**Common mistake:** enabling it and expecting a normal Pterodactyl server transfer — the stock transfer feature (which does move data via Wings) is a different mechanism entirely.

---

### `tags_visible_to_users`

- **Type:** boolean · **Default:** `false` (off) · **UI:** **Tags page** (`/admin/revamp/tags`), not the settings page

Controls whether server owners can see the tags assigned to their server. When off, the client API endpoint (`GET /api/client/servers/{server}/tags`, registered by the Blueprint client router) responds with `{"visible": false, "tags": []}` regardless of what tags exist. When on, it returns the server's tag list.

This key is set through its own route (`POST /admin/revamp/tags/settings`, validated as `nullable|boolean`) rather than the main settings form — it is the only runtime key without a field on the settings page.

**When to change it:** turn it on if you use tags as user-facing labels (e.g. plan tiers); leave it off when tags are internal ops metadata.

---

## `config/revamp.php`

A standard Laravel config file merged by `RevampServiceProvider` (`mergeConfigFrom`, namespace `revamp`). It ships with a single key:

```php
return [
    'admin_home_route' => 'admin.revamp.index',
];
```

### `revamp.admin_home_route`

- **Type:** string (route name) · **Default:** `admin.revamp.index`

Tells `RevampNav::homeRouteName()` which named route "Revamp home" links should point at. The resolver checks the configured route first, then falls back in order:

1. The configured route, if it exists and is non-empty.
2. `admin.revamp.index` (the Revamp dashboard at `/admin/revamp`).
3. `admin.extensions.pterodactylrevamp.index` (the Blueprint Extensions hub page).

The Blueprint installer rewrites this file during install so the admin home points at the Extensions hub on Blueprint-based panels.

**When to change it:** practically never — the fallback chain already covers both install paths. Only touch it if you have customized admin routing.

**Common mistake:** pointing it at a route that does not exist and expecting an error — there is none; the resolver silently falls back down the chain.

After editing, clear the config cache:

```bash
php artisan config:clear
```

---

## `REVAMP_BULK_SYNC`

- **Type:** boolean env var · **Default:** `false` (absent = async)

Read directly by `BulkOperationService` when a bulk operation is dispatched:

- **Unset / `false`** — the bulk job is dispatched onto the dedicated **`revamp` queue** and processed by your queue worker (`php artisan queue:work --queue=revamp,default`). This is the normal production mode.
- **`true`** — the job runs **synchronously inside the HTTP request** (`dispatch_sync`). No queue worker is needed.

```bash
# .env
REVAMP_BULK_SYNC=true
```

**When to change it:** local development, debugging a failing bulk job, or a tiny panel where you deliberately run no queue worker.

**Common mistakes:**

- Leaving it on in production — a bulk suspend/delete across dozens of servers blocks the web request until every item finishes, and the request will hit your web server's timeout first.
- Setting it in `.env` while running `php artisan config:cache`. The value is read via `env()` at runtime rather than through a config file, and Laravel does not load `.env` when the config is cached — so the setting is silently ignored. Either set it as a real environment variable or avoid config caching.

---

## Scheduler & queue interplay

Retention and threshold settings only take effect because the scheduler runs the commands that consume them. `RevampServiceProvider` registers these at boot (no `Kernel.php` edit needed), driven by the standard Pterodactyl cron entry:

| Command | Frequency | Overlap lock | Consumes |
|---|---|---|---|
| `revamp:sample-metrics` | every 5 minutes | 10 min | `metrics_retention_days` |
| `revamp:rollup-metrics` | hourly | 30 min | — |
| `revamp:compute-health` | every 10 minutes | 15 min | `health_*`, `node_pressure_*` |
| `revamp:evaluate-rules` | daily at 03:00 | 60 min | `upgrade_*` |

Commands dispatch their heavy work onto the `revamp` queue, so both the cron entry **and** a worker listening on `revamp` must be running — see [Post-Install Steps](/pterodactyl-revamp/getting-started/installation#post-install-steps).

---

## Blueprint manifest: `conf.yml`

`blueprint/pterodactylrevamp/conf.yml` is the **Blueprint extension manifest**. Blueprint reads it at install time only — editing it on an installed panel changes nothing. It is documented here for anyone rebuilding or forking the extension.

### `info`

```yaml
info:
  name: "Pterodactyl Revamp"
  identifier: "pterodactylrevamp"
  description: "Enterprise operations suite — bulk ops, tagging, templates, allocation UX, and audit logging."
  flags: ""
  version: "1.2.0"
  target: "beta-2026-06"
  author: "XDP.Network"
  website: ""
```

| Key | Value | Notes |
|---|---|---|
| `info.identifier` | `pterodactylrevamp` | Used for `blueprint -i/-remove` and the install-marker tags in patched files. Must stay unique. |
| `info.version` | `1.2.0` | Bump on every release; Blueprint shows it in the Extensions hub. |
| `info.target` | `beta-2026-06` | Blueprint version the extension targets. Installing on a different Blueprint target may warn or fail. |
| `info.flags` | *(empty)* | No install flags are used. |
| `info.website` | *(empty)* | Optional; not set for this extension. |

### `admin`

```yaml
admin:
  view: "view.blade.php"
  controller: "controller.php"
  css: ""
  wrapper: ""
```

Wires the extension's **Blueprint Extensions hub page**: `admin.view` and `admin.controller` are the hub view/controller pair. `admin.css` and `admin.wrapper` are empty — the hub page uses the panel's stock styling. This hub page is separate from the main Revamp admin UI at `/admin/revamp`, which is served by the PanelFiles merge.

### `dashboard`

```yaml
dashboard:
  css: ""
  wrapper: ""
  components: "components"
```

`dashboard.components` points at the `components/` folder containing `Components.yml` (see below) — Blueprint's mechanism for injecting React components into the client dashboard. `css` and `wrapper` are unused.

### `data`

```yaml
data:
  directory: "data"
  public: ""
  console: ""
```

- `data.directory: "data"` — the extension's `data/` folder, which contains the install/remove scripts (`install.sh`, `remove.sh`) Blueprint runs automatically.
- `data.public` — empty; no public assets are managed through this key. The admin UI islands (`public/ext/revamp/*.js` / `.css`) ship inside `PanelFiles/public/` and land on the panel through the normal file merge.
- `data.console` — empty; the addon needs no Blueprint console commands. Artisan commands load from `app/Console/Commands/**` automatically on Panel 1.12+.

### `requests`

```yaml
requests:
  views: ""
  app: ""
  routers:
    application: ""
    client: "routes/blueprint/client/revamp.php"
    web: "routes/web.php"
```

| Key | Value | What it does |
|---|---|---|
| `requests.routers.client` | `routes/blueprint/client/revamp.php` | Registers the client API route `GET /api/client/servers/{server}/tags` (behind `ServerSubject` + `AuthenticateServerAccess`) — the endpoint gated by `tags_visible_to_users`. |
| `requests.routers.web` | `routes/web.php` | Present but intentionally empty — the file contains only a comment. All real web routes are registered by `RevampServiceProvider` from `routes/admin-revamp.php` under the `/admin/revamp` prefix (`admin.revamp.*` names). |
| `requests.routers.application` | *(empty)* | Application API routes (`/api/application/revamp/*`) are likewise registered by the service provider from `routes/api-revamp.php`, not by Blueprint. |
| `requests.views` / `requests.app` | *(empty)* | Unused — views and app files land via the `PanelFiles/` merge. |

### `database`

```yaml
database:
  migrations: ""
```

Empty on purpose: migrations are loaded by `RevampServiceProvider` via `loadMigrationsFrom()` and run with the normal `php artisan migrate --force`, not through Blueprint's migration key.

::: warning Common manifest mistakes
- **Editing `conf.yml` on a live panel** — Blueprint only reads it during install/remove. Rebuild the `.blueprint` archive and reinstall for manifest changes to apply.
- **Filling in empty keys** (`data.console`, `database.migrations`, `requests.routers.application`) assuming they are needed — they are empty because the service provider handles those concerns; duplicating them causes double registration.
:::

---

## Blueprint component map: `Components.yml`

`blueprint/pterodactylrevamp/components/Components.yml` lists every React injection point Blueprint supports on the client dashboard. The extension uses exactly **one** of them:

```yaml
Server:
  Settings:
    BeforeContent: "revampServerDebugTags"
```

`Server → Settings → BeforeContent: revampServerDebugTags` injects the `revampServerDebugTags` component above the stock content of the client **Server → Settings** page — the client-side surface for server tags, which reads from the client API endpoint gated by `tags_visible_to_users`.

Every other injection point in the file (navigation, server rows, terminal, files, backups, network, startup, and the rest) is set to `""` — declared but unused.

**Common mistakes:**

- Assuming the empty entries do something — they are placeholders only.
- Editing `Components.yml` on an installed panel — like `conf.yml`, it is consumed at install time. Component changes require rebuilding the `.blueprint` file, removing, and reinstalling the extension.

---

## Related pages

- [Pterodactyl Revamp overview](/pterodactyl-revamp/) — feature tour
- [Installation](/pterodactyl-revamp/getting-started/installation) — install paths, queue worker, and cron setup
