---
title: FAQ
description: Frequently asked questions about Pterodactyl Revamp — install paths, supported versions, the queue worker, bulk move, blade patches, and uninstall.
---

# Frequently Asked Questions

## General

### Do I need Blueprint to use Revamp?

No. Blueprint is the recommended install path, but the addon ships a **standalone** flavor too: merge `standalone/PanelFiles/` into your panel root and run `standalone/data/install.sh` (or apply `PanelEdit.txt` by hand). The feature set is identical either way — only the delivery mechanism differs. See [Installation](/pterodactyl-revamp/getting-started/installation).

### Which Pterodactyl and PHP versions are supported?

Pterodactyl Panel **1.12.x – 1.14.x**, PHP **8.2 / 8.3**, and MySQL/MariaDB **10.4+**. The Blueprint package targets Blueprint `beta-2026-06`.

### Does Revamp work on Pterodactyl 1.14?

Yes. The blade patcher tries multiple anchors per injection point so it matches the blade layouts across the 1.12.x – 1.14.x range, and every injection is marker-wrapped so it can be removed cleanly. If an anchor isn't found on a heavily modified panel, the installer prints a `WARN: anchor not found` line instead of corrupting the template.

### Does Revamp replace core panel files?

No. Revamp adds its own files under `app/`, `routes/`, `resources/`, and `database/migrations/`, and patches a small number of core blades by **injecting marker-wrapped blocks** (`<!-- pterodactylrevamp-...-start/end -->`). Removal scripts strip exactly those blocks and restore the original markup, so the changes are fully reversible.

## Admin UI

### Where does Revamp appear in the admin panel?

The admin area lives at **`/admin/revamp`**, and on Blueprint installs it also gets a page in the **Extensions hub**. The installer deliberately does **not** inject a core admin sidebar link — if you want one on a standalone install, `PanelEdit.txt` documents the optional sidebar block for `resources/views/layouts/admin.blade.php`. Several features also surface as injected islands on existing pages, such as the port picker in **Allocation Management → Default Allocation** on the Create Server page.

### My admin pages show duplicated content after reinstalling — why?

Older versions of the blade patcher could stack duplicate injection blocks on repeat installs. The current patcher is idempotent (it reports `already present` on repeat runs) and strips orphaned markers before injecting. If you're seeing duplicates from an old install, heal the panel with a remove-then-install cycle:

```bash
cd /var/www/pterodactyl
blueprint -remove pterodactylrevamp
blueprint -install pterodactylrevamp
php artisan view:clear
```

Hard-refresh your browser afterwards to drop cached pages.

## Bulk Operations

### Why do bulk actions say "Job is queued but not running"?

Bulk jobs are dispatched to the `revamp` queue, so this message means nothing is consuming that queue. Start a worker that listens to it:

```bash
php artisan queue:work --queue=revamp,default
```

For small panels you can instead set `REVAMP_BULK_SYNC=true` in the panel `.env` to run bulk jobs synchronously in the web request — handy for testing, not recommended for large batches.

### Why is bulk move disabled by default, and how do I enable it?

Bulk move only **re-points panel database records** to another node — it does not transfer the server's data through Wings, so a naive move would leave servers broken on their old node. Because of that, the action is gated behind the `bulk_move_enabled` setting, which defaults to off.

::: warning No data is transferred
Enable **Admin → Revamp → Settings → bulk move** only if you understand that the actual files stay on the source node. Use it for lab/testing setups or when you handle the Wings-side transfer yourself.
:::

## Operations

### What queue worker and cron do I need?

Two standard Pterodactyl pieces: a queue worker consuming the `revamp` queue (`php artisan queue:work --queue=revamp,default`) and the scheduler running every minute via cron (`* * * * * php /var/www/pterodactyl/artisan schedule:run`). The queue drives bulk jobs; the scheduler drives metrics rollups and health snapshots.

### Can regular users see server tags?

Only if you turn it on. The `tags_visible_to_users` setting (Admin → Revamp → Tags, default off) controls whether tags are exposed to server owners through the client API endpoint `GET /api/client/servers/{server}/tags`. With the setting off, tags are an admin-only organizational tool.

### How do I fully uninstall Revamp, including the database tables?

1. Blueprint: `blueprint -remove pterodactylrevamp`. Standalone: run `standalone/data/remove.sh` (or revert `PanelEdit.txt` manually) and delete the merged Revamp files.
2. Roll back the addon's migrations — every Revamp migration has a `down()` method that drops its tables — or drop the `revamp_*` tables manually.

::: danger Take a database backup first
Dropping the `revamp_*` tables permanently deletes settings, tags, templates, audit logs, metrics, and health history. The remove scripts intentionally leave the tables in place so an accidental removal doesn't destroy data.
:::
