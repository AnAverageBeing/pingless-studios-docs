---
title: Installation
description: Install Pterodactyl Revamp as a Blueprint extension or as a standalone panel merge — prerequisites, both install paths, post-install steps, verification, and uninstall.
---

# Installation

Pterodactyl Revamp ships with **two install paths**: a Blueprint extension (recommended) and a standalone panel merge for panels without Blueprint. Both paths install the same code — the difference is only how the files land on your panel.

**Repository:** [github.com/PingLess/pterodactyl-revamp](https://github.com/PingLess/pterodactyl-revamp) · **Version:** `1.2.0`

---

## Prerequisites

| Component | Requirement |
|---|---|
| Pterodactyl Panel | `1.12.x` – `1.14.x` |
| PHP | `8.2` or `8.3` |
| Database | MySQL / MariaDB `10.4+` |
| Queue worker | Running with the `revamp` queue |
| Cron | `artisan schedule:run` every minute |
| Blueprint (Path A only) | Target `beta-2026-06` |

::: warning Back up first
Back up your panel database and files before installing. Both paths run migrations that create new `revamp_*` tables, and the standalone path edits core panel files (`config/app.php`, `resources/views/layouts/admin.blade.php`).
:::

The queue worker and cron are not optional — bulk operations, metric sampling, and health snapshots all run through them. You will set them up in [Post-Install Steps](#post-install-steps) if they are not already running.

---

## Path A — Blueprint (Recommended)

Blueprint handles the file merge, provider registration, and Blade patching automatically through the bundled `data/install.sh`.

### 1. Build the `.blueprint` file

If you downloaded a release archive you can skip this step. To build from the repository, zip the extension directory with the files at the zip root (no wrapping folder — `-r` is required):

```bash
cd pterodactylrevamp
zip -r ../pterodactylrevamp.blueprint . -x '*__pycache__*'
```

### 2. Copy it to the panel and install

```bash
cp pterodactylrevamp.blueprint /var/www/pterodactyl/
cd /var/www/pterodactyl
sudo blueprint -i pterodactylrevamp
```

::: tip Why sudo?
`/var/www/pterodactyl` is owned by `www-data`, so the install needs elevated privileges to merge files, patch Blade templates, and run migrations.
:::

During install, `data/install.sh` runs automatically and:

- Merges `PanelFiles/` into the panel root.
- Registers `RevampServiceProvider` in `config/app.php` (tagged with a `// pterodactylrevamp` marker so removal can undo it).
- Writes `config/revamp.php` pointing the admin home at the Extensions hub.
- Patches the admin Blade templates for the Revamp UI islands (allocation port picker, bulk tools).
- Copies `public/ext/revamp/allocation-picker.js` and clears route/config/view caches.
- Runs the database migrations.

::: info No sidebar link on Blueprint installs
The Blueprint install intentionally does **not** add a core admin sidebar link. Revamp lives under the **Blueprint Extensions hub** and at `/admin/revamp`. The standalone path adds a sidebar link instead.
:::

### 3. Run migrations

```bash
php artisan migrate --force
```

Then continue to [Post-Install Steps](#post-install-steps).

### Upgrading or reinstalling

Do **not** layer a new install on top of a broken or outdated one — stale Blade patches will conflict. Always remove first, then install fresh:

```bash
cd /var/www/pterodactyl
sudo blueprint -remove pterodactylrevamp
sudo blueprint -install pterodactylrevamp
php artisan migrate --force
php artisan view:clear
```

`blueprint -remove` runs `data/remove.sh`, which undoes the provider registration and Blade patches via the `pterodactylrevamp` markers, giving the reinstall a clean base. Hard-refresh your browser afterwards.

---

## Path B — Standalone (No Blueprint)

Use this path when your panel does not run Blueprint. The `standalone/` folder mirrors the same files; you merge them yourself.

### 1. Merge PanelFiles into the panel root

Copy every file under `standalone/PanelFiles/` into your panel, preserving the directory structure. Paths inside `PanelFiles/` are relative to the panel root:

```
standalone/PanelFiles/app/Providers/RevampServiceProvider.php
  → /var/www/pterodactyl/app/Providers/RevampServiceProvider.php
```

Merge — do not delete or overwrite unrelated panel files.

### 2. Register the addon

Choose one of the two options:

**Option A — Helper script (recommended).** The same script Blueprint uses; it merges files (if not already done), registers `RevampServiceProvider`, patches the admin Blades, and runs migrations. It is idempotent:

```bash
export PTERODACTYL_DIRECTORY=/var/www/pterodactyl   # your panel root
bash /path/to/standalone/data/install.sh
```

**Option B — Manual edits.** Open `standalone/PanelEdit.txt` (also shipped as `PanelFiles/PanelEdit.txt`) and apply each listed change:

1. `config/app.php` — insert `Pterodactyl\Providers\RevampServiceProvider::class,` after `Pterodactyl\Providers\ActivityLogServiceProvider::class,`.
2. `resources/views/layouts/admin.blade.php` — insert the Revamp sidebar block (between the `pterodactylrevamp-block-start` / `pterodactylrevamp-block-end` markers) before the `<li class="header">SERVICE MANAGEMENT</li>` line.

::: tip No Kernel.php edit needed
On Pterodactyl 1.12+, Laravel auto-loads `app/Console/Commands/**`, so the Revamp commands are picked up without touching `app/Console/Kernel.php`.
:::

### 3. Migrate and clear caches

From the panel root:

```bash
cd /var/www/pterodactyl
php artisan migrate --force
php artisan config:clear
php artisan cache:clear
php artisan view:clear
```

Then continue to [Post-Install Steps](#post-install-steps).

---

## Post-Install Steps

These apply to **both** install paths.

### 1. Start the queue worker

Bulk operations and other Revamp jobs are dispatched to a dedicated `revamp` queue. Run a worker that listens on it (in addition to `default`):

```bash
php artisan queue:work --queue=revamp,default --tries=3 --timeout=120
```

For production, supervise this with systemd the same way you supervise the stock Pterodactyl worker — just add `revamp` to the `--queue` list.

### 2. Verify cron

The scheduler drives metric sampling and health snapshots. Make sure the standard Pterodactyl cron entry is in place:

```bash
* * * * * php /var/www/pterodactyl/artisan schedule:run >> /dev/null 2>&1
```

### 3. Clear caches (Blueprint path)

The Blueprint installer clears route/config/view caches itself, but it does not hurt to be thorough after an upgrade:

```bash
php artisan config:clear
php artisan cache:clear
php artisan view:clear
```

### 4. Hard-refresh your browser

Revamp patches admin Blade templates and ships a prebuilt `allocation-picker.js`. A hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`) clears stale cached assets so the new UI islands load.

---

## Verification

After installing, confirm the following:

- **Blueprint Extensions hub** lists Pterodactyl Revamp (Path A), or the **admin sidebar** shows the Revamp section (Path B).
- Navigating to **`/admin/revamp`** loads the Revamp dashboard without a 404 or 500.
- The `revamp_*` tables exist in your database (`revamp_settings`, `revamp_tags`, `revamp_templates`, `revamp_bulk_jobs`, `revamp_metric_samples`, `revamp_health_snapshots`, `revamp_admin_audit_logs`, and the rest — ten migrations ship with v1.2.0).
- The queue worker is processing the `revamp` queue — dispatch a small bulk action and watch it complete instead of sitting pending.

Once verified, head to the [Pterodactyl Revamp overview](/pterodactyl-revamp/) for a tour of the features.

---

## Troubleshooting

**Migrations failed during install.**
The installer prints `Warning: migrations failed` if `php artisan migrate --force` errors. Fix the underlying database issue (permissions, connectivity), then run it manually from the panel root:

```bash
php artisan migrate --force
```

**Broken or duplicated admin UI after an upgrade.**
Stale Blade patches from a previous version. Remove and reinstall instead of stacking installs:

```bash
sudo blueprint -remove pterodactylrevamp
sudo blueprint -install pterodactylrevamp
php artisan view:clear
```

**500 errors on bulk-operation routes.**
You are running an old version of the addon against newer panel code (or vice versa). Reinstall the current release (`1.2.0`) using the remove-then-install flow above.

**Queue jobs never process.**
No worker is listening on the `revamp` queue. Start one:

```bash
php artisan queue:work --queue=revamp,default --tries=3 --timeout=120
```

If jobs still stall, confirm the cron entry for `artisan schedule:run` is running every minute.

---

## Uninstall

**Blueprint:**

```bash
cd /var/www/pterodactyl
sudo blueprint -remove pterodactylrevamp
```

This runs `data/remove.sh`, which removes the `RevampServiceProvider` line from `config/app.php` and the sidebar block from `admin.blade.php` via the install markers, then clears the config and view caches.

**Standalone:**

```bash
export PTERODACTYL_DIRECTORY=/var/www/pterodactyl
bash standalone/data/remove.sh
```

The standalone `remove.sh` undoes the provider and sidebar markers only. Afterwards, delete the merged Revamp files (`app/Providers/RevampServiceProvider.php`, `app/Http/Controllers/Admin/Revamp/`, `app/Services/Revamp/`, and the other files listed under `standalone/PanelFiles/`) and clear caches.

::: danger Dropping revamp_* tables is destructive
Removal scripts leave the database tables in place so your tags, templates, audit logs, and metrics survive a reinstall. If you are uninstalling permanently and want them gone, back up first, then drop the `revamp_*` tables manually. This cannot be undone.
:::
