---
title: FAQ
description: Frequently asked questions about Trash Bin Pro for Pterodactyl — quotas, retention, restores, purge behavior, sub-user permissions, and compatibility.
---

# Frequently Asked Questions

## Quotas & Disk Usage

### Does the Trash Bin count against the server's disk quota?

Yes. Trashed files are real files living in `/.trash` on the game server's filesystem — they keep consuming the container's disk allocation until they are restored, purged, or the Trash is emptied. Use the capacity limits in the admin panel (global default, per-egg, or per-server override) to keep trash usage bounded; the default is `0` (unlimited), so set a cap if disk abuse is a concern.

### What happens when the Trash Bin is full?

The move-to-trash is refused: the API returns HTTP `409` with a `TrashBinFull` error, and the file manager shows a "Trash Bin is full — empty it and retry" banner. The delete is blocked entirely — the file is **not** hard-deleted as a fallback and stays where it is until the Trash is emptied or enough of it expires.

### What if a single file is bigger than the Trash capacity?

The user gets a **Delete Permanently** dialog instead: the file manager explains the file exceeds the Trash Bin capacity and offers a permanent delete guarded by a required acknowledgement checkbox (the danger button stays disabled until it is ticked). Confirming sends the delete with `permanent: true`, bypassing the Trash Bin entirely. Cancelling leaves the file untouched.

## Retention & Purging

### What do "0" and the retention limits actually mean?

Capacity and retention have different zero semantics:

- **Capacity (`max_bytes`)**: `0` means **unlimited** — the Trash Bin can grow without bound (still bounded by the server's real disk).
- **Retention (`retention_hours`)**: minimum is **1 hour**, maximum `8760` (one year). There is no "keep forever" — everything in the Trash is eventually purged. The global default is 24 hours.

Effective values resolve per server as: server override → egg override → global default.

### Does Empty Trash bypass the retention window?

Yes. **Empty Trash** permanently deletes everything immediately, regardless of how recently it was trashed. It is a hard delete through Wings — the files are not recoverable afterwards.

### What if Wings is down when the hourly purge runs?

The purge is fault-tolerant and per-server. If a Wings node is unreachable, that server's rows are **left in the database** and retried on the next hourly run — one failed server never blocks the others. A warning is logged (`storage/logs/laravel.log`) and the command reports how many servers will be retried. Note the inverse is also safe: if files were already deleted on Wings but the DB rows survived, the restore/permanent-delete paths clean up those ghost rows instead of erroring.

### What happens if the server itself is deleted?

Two layers handle it. The `server_id` foreign key cascades, so trash rows are normally removed with the server. Any row that outlives its server is picked up as an orphan by the next purge run and its DB record is dropped — no Wings call is attempted for a server that no longer exists.

## Restores

### What happens if a file with the same name already exists at the restore location?

Restores are collision-safe. If the original path is taken, the file is restored as `name (restored)`; if that is taken too, `name (restored 2)`, and so on. The original file at that path is never overwritten.

### Can sub-users use the Trash Bin?

Yes, if they have the **trashbinpro.access** permission (granted on the sub-user management page). It governs viewing the Trash, restoring, deleting from Trash, and Empty Trash, and is enforced server-side on every endpoint — the restore request class authorizes `trashbinpro.access` independently. The regular `file.delete` permission still controls whether they can delete (and therefore trash) files in the first place. Sub-users without `trashbinpro.access` get a `403` on the Trash view.

## Operation & Compatibility

### Can I disable Trash Bin Pro without uninstalling it?

Yes — set **enabled** to off in **Admin → Trash Bin Pro**. When disabled, deletes fall back to the stock panel behavior (immediate permanent delete) and the Trash UI no longer intercepts anything. Files already in the Trash are untouched and the hourly purge keeps running, so existing trash still expires on schedule.

### Where is trash activity logged?

In Pterodactyl's built-in activity log, visible on the server's Activity page. Every operation writes an event: `server:trashbinpro.trash`, `server:trashbinpro.restore`, `server:trashbinpro.purge` (permanent delete from Trash), and `server:trashbinpro.empty`. Logging can be turned off with the `logging_enabled` setting in the admin panel.

### Does it work with themes and modified panels?

It is built for them. The PHP and SPA patchers are marker-guarded and idempotent (safe to re-run, zero-diff no-ops when already applied), and the frontend import patches are **anchor-free** — they merge into existing import statements instead of searching for exact stock code lines, which is what broke on theme-modified panels in v1.0.0 (`faTrash is not defined`). If a patch genuinely cannot find its place, the patcher fails loudly and exits non-zero rather than leaving a half-patched file — see the [troubleshooting table](./installation#troubleshooting).

### Which Pterodactyl and Blueprint versions are supported?

Pterodactyl Panel **v1.11.x / v1.12.x** (Laravel 11, PHP 8.2+), and Blueprint `beta-2026-05` for the Blueprint package. The standalone installer has no Blueprint dependency. See [Installation](./installation) for the full prerequisite list.
