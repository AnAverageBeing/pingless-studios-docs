---
title: CLI & Artisan Commands
description: Every artisan command Pterodactyl Revamp ships — metric sampling, rollups, health scoring, and rule evaluation — plus the queue worker, cron, cache, and Blueprint commands used to operate the addon.
---

# CLI & Artisan Commands

Pterodactyl Revamp ships **four artisan commands**. None of them do heavy work in-process — each one is a thin entrypoint that dispatches a job onto the dedicated `revamp` queue, so the real work always runs through your queue worker.

All commands below are run from the panel root (usually `/var/www/pterodactyl`).

---

## Addon Commands

| Command | Schedule | What it dispatches |
| ------- | -------- | ------------------ |
| `revamp:sample-metrics` | Every 5 minutes | `SampleServerMetricsJob` (chunked) |
| `revamp:rollup-metrics` | Hourly | `RollupHourlyMetricsJob` |
| `revamp:compute-health` | Every 10 minutes | `ComputeHealthJob` |
| `revamp:evaluate-rules` | Daily at 03:00 | `EvaluateUpgradeRulesJob` |

The schedule is registered in `RevampServiceProvider` at boot time, so it applies identically whether the framework is serving HTTP or running under the CLI. Every scheduled run uses `withoutOverlapping()` (10 / 30 / 15 / 60 minutes respectively) to prevent a slow run from stacking on top of the previous one.

::: warning The scheduler only *dispatches*
These commands put jobs on the `revamp` queue and exit immediately with **no console output**. If no queue worker is consuming the `revamp` queue, the commands appear to succeed but nothing is ever sampled, rolled up, or computed. See [Queue Worker](#queue-worker).
:::

### `revamp:sample-metrics`

```bash
php artisan revamp:sample-metrics
```

Samples resource utilisation for all active servers. It selects every server with a non-null `installed_at`, walks them ordered by id, and dispatches one `SampleServerMetricsJob` per **chunk of 50 servers** onto the `revamp` queue. Each job persists raw samples to `revamp_metric_samples` via the `MetricSamplingService`.

The chunking exists to keep memory pressure flat on panels with thousands of servers.

**Run manually when:** you just installed the addon and want the first samples in the database before the next 5-minute tick, or the queue was down and you want to catch up.

### `revamp:rollup-metrics`

```bash
php artisan revamp:rollup-metrics
```

Aggregates raw metric samples into hourly rollups. The dispatched `RollupHourlyMetricsJob` rolls up the **last 3 hours** (to catch stragglers from late-running sample jobs) and then purges raw samples older than the `metrics_retention_days` setting.

**Run manually when:** you changed `metrics_retention_days` and want the purge to apply now, or analytics charts look empty because the queue was stalled.

### `revamp:compute-health`

```bash
php artisan revamp:compute-health
```

Computes node and server health snapshots. The dispatched `ComputeHealthJob` runs the `NodeHealthService` and `ServerHealthService`, writing snapshots used by the Health page, node pressure scores, and crash-loop / OOM detection (governed by the `health_crash_threshold` and `health_window_hours` settings).

**Run manually when:** the Health page shows stale "last snapshot" timestamps after a queue outage.

### `revamp:evaluate-rules`

```bash
php artisan revamp:evaluate-rules
```

Evaluates upgrade recommendation rules against the rollup data. The dispatched `EvaluateUpgradeRulesJob` runs the `UpgradeRuleEngine`, which produces the per-server recommendations shown by the analytics endpoints (thresholds, window, cooldown, and message text come from the `upgrade_*` settings).

**Run manually when:** you changed `upgrade_cpu_threshold` / `upgrade_ram_threshold` / `upgrade_disk_threshold` and want recommendations regenerated before the next 03:00 run.

---

## Operational Commands

These are stock Pterodactyl/Laravel commands, but the addon depends on them being wired up correctly.

### Queue Worker

The `revamp` queue carries all metric, health, bulk-operation, and rule-evaluation jobs:

```bash
php artisan queue:work --queue=revamp,default
```

For production, run it under systemd (or Supervisor) with explicit retry and timeout limits:

```bash
php artisan queue:work --queue=revamp,default --tries=3 --timeout=120
```

::: danger A stopped worker silently breaks the addon
Bulk operations, metrics, health scores, and recommendations **all** flow through this queue. If the worker is down, the UI still accepts bulk operations — they just never process. Check the worker first when anything looks stuck.
:::

### Cron (Scheduler)

The four schedules above only fire if Laravel's scheduler runs every minute:

```cron
* * * * * php /var/www/pterodactyl/artisan schedule:run >> /dev/null 2>&1
```

Verify the addon's schedules are registered:

```bash
php artisan schedule:list | grep revamp
```

Expected: four entries — `revamp:sample-metrics`, `revamp:rollup-metrics`, `revamp:compute-health`, `revamp:evaluate-rules`.

### Migrations

Run after every install or upgrade (creates/updates the `revamp_*` tables):

```bash
php artisan migrate --force
```

### Cache Clearing

After reinstalling, merging updated `PanelFiles/`, or when views look stale:

```bash
php artisan view:clear
php artisan config:clear
```

`view:clear` recompiles the addon's patched admin blades (tag pickers on server forms, the port picker, the naming pattern field); `config:clear` picks up changes to `config/revamp.php`. Hard-refresh your browser afterwards — the admin UI is blade-rendered.

---

## Blueprint Commands

When installed as a Blueprint extension (identifier `pterodactylrevamp`):

```bash
cd /var/www/pterodactyl

# Install (runs data/install.sh: merges PanelFiles, registers the
# provider, patches admin blades, runs migrations)
blueprint -install pterodactylrevamp
php artisan migrate --force

# Remove (runs data/remove.sh: undoes core file edits and blade patches)
blueprint -remove pterodactylrevamp

# Release Blueprint's lock if an install was interrupted mid-run
blueprint -unlock
```

::: warning Never stack installs
Do not run `-install` twice or layer patches onto a broken install. Remove first, then install fresh:

```bash
blueprint -remove pterodactylrevamp
blueprint -install pterodactylrevamp
php artisan migrate --force
php artisan view:clear
```
:::

::: tip Development loop
While developing on the addon itself, the cycle is always `-remove` → `-install` → `migrate --force` → `view:clear`, then a hard browser refresh.
:::

---

## What's Next?

- **[API Reference →](/pterodactyl-revamp/user-guide/api)** — every admin, application, and client API endpoint the addon exposes.
- **[Installation →](/pterodactyl-revamp/getting-started/installation)** — full install walkthrough for both Blueprint and standalone paths.
