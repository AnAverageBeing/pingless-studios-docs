---
title: Console Command
description: The p:trashbin:purge artisan command — how Trash Bin Pro's hourly retention purge works, how it is scheduled, and when to run it manually.
---

# Console Command

Trash Bin Pro ships exactly one artisan command: the retention purge that permanently deletes trashed files whose retention window has expired.

```bash
php artisan p:trashbin:purge
```

| | |
|---|---|
| Signature | `p:trashbin:purge` |
| Class | `Pterodactyl\Console\Commands\TrashBinPro\PurgeTrashCommand` |
| Options | None |
| Exit code | Always `0` (success) — see [Exit behavior](#exit-behavior) |

---

## What it does

Each run walks the `trashbin_files` table and deletes everything past its retention window:

1. **Bail out early if not migrated.** If the `trashbin_files` table does not exist yet, the command prints `Trash Bin Pro tables are not migrated yet — nothing to purge.` and exits successfully.
2. **Chunk the table.** Rows are read with `chunkById` in batches of `purge_batch_size` (global setting, default `200`, floored at `50`), so large trash backlogs never load into memory at once.
3. **Evaluate retention per row.** Each row is checked against the *effective* retention for its server — server override, then egg override, then the global `retention_hours`. A row is expired when `created_at + retention` is in the past. The timestamp math is non-mutating (`CarbonImmutable`), so evaluation never touches the stored `created_at`.
4. **Drop orphans.** Rows whose server no longer exists (deleted server) have no files on any node — their DB records are deleted directly, no Wings call.
5. **One Wings call per server.** Expired IDs are grouped per server and deleted with a single `deleteFiles('/.trash', [ids...])` call to that server's node. The DB rows are removed only after Wings confirms the delete.

### Example output

```text
$ php artisan p:trashbin:purge
Purged 12 expired file(s).
```

When one or more nodes could not be reached, the command adds a warning line but still succeeds:

```text
$ php artisan p:trashbin:purge
Purged 4 expired file(s).
2 server(s) could not be reached and will be retried next run.
```

### Exit behavior

The command **always returns exit code 0**, even when some servers fail. A per-server failure (node offline, Wings timeout, server suspended) is caught, logged, and skipped — the failed rows are left in the database and retried automatically on the next hourly run. One dead node never blocks purging for every other server.

Failures land in `storage/logs/laravel.log`:

```text
[TrashBinPro] Failed to purge trash for server 17: <wings error message>
```

::: tip Monitoring
Do not alert on the exit code — alert on the log line above, or on the `N server(s) could not be reached` warning. A node that is down for days will keep its trash until it comes back, which is the intended behavior.
:::

---

## Scheduling

You do **not** add a cron entry for this command. `TrashBinProServiceProvider` registers it with Laravel's scheduler at boot:

```php
$schedule->command('p:trashbin:purge')->hourly()->withoutOverlapping();
```

- **Hourly** — runs at the top of every hour.
- **`withoutOverlapping()`** — a slow run (many servers, large backlog) can never stack on top of itself.
- Registered by the service provider, **not** by editing `app/Console/Kernel.php` — so panel updates cannot clobber it.

::: warning The panel's scheduler cron must exist
This only works if Pterodactyl's standard scheduler cron is installed — the same one every panel already needs:

```bash
* * * * * cd /var/www/pterodactyl && php artisan schedule:run >> /dev/null 2>&1
```

If `schedule:run` never fires, nothing is ever purged and trash grows until it hits the per-server cap.
:::

Verify the command is registered:

```bash
php artisan list p:trashbin
```

---

## Running it manually

The hourly schedule covers normal operation. Run it by hand when:

- **You lowered retention** (globally, per egg, or per server) and want the shorter window applied to existing trash now instead of waiting for the next hour.
- **Before a big cleanup or migration** — e.g. freeing disk on a node before maintenance.
- **Testing the install** — trash a file on a test server, set retention to `1` hour, backdate nothing, and confirm the flow end to end. For an immediate check, use **Admin → Trash Bin Pro → Purge now**, which runs the same purge on demand.

From the admin panel there is also a **Purge now** button (`POST /admin/trashbinpro/purge-now`) that triggers the same purge without SSH access.

---

## Installing (Blueprint)

For completeness — the extension itself is installed with Blueprint:

```bash
cd /var/www/pterodactyl
blueprint -install pterodactyltrashbinpro-v1.0.2.blueprint
php artisan migrate --force
```

The standalone installer (`standalone/data/install.sh`) registers the same command and schedule. See [Installation](../getting-started/installation).
