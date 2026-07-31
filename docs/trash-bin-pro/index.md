---
title: Trash Bin Pro
description: Soft-delete trash bin for the Pterodactyl file manager with restorable files, per-server and per-egg quotas, retention windows, and a full admin panel.
---

# Trash Bin Pro

**Recoverable file deletion for Pterodactyl Panel** — a soft-delete trash bin for the client file manager, available as a Blueprint extension or a standalone panel installer. Deleted files are moved to a hidden `/.trash` folder on the game server instead of being destroyed, tracked in MySQL, and can be restored with collision-safe naming until a configurable retention window expires — at which point an hourly purge removes them for good.

Trash Bin Pro gives game-server owners the safety net every desktop OS has had for decades, without giving up disk control: hosting-grade quotas per server, per egg, or globally, a dedicated `trashbinpro.access` sub-user permission, and full activity logging so every trash, restore, and purge is auditable.

<div class="tip custom-block" style="margin-top: 1.5rem;">

**Built for PingLess Studios by [AnAverageBeing](https://github.com/AnAverageBeing)**
[GitHub Repo](https://github.com/AnAverageBeing/pterodactyl-trash-bin-pro) · [Studio](https://studio.pingless.org)

</div>

---

## Architecture

```mermaid
graph TD
    subgraph Panel[Pterodactyl Panel]
        SPA[Client SPA File Manager] --> FC[FileController - patched]
        FC --> TS[TrashService]
        TS --> SETTINGS[TrashBinSettingsRepository - 5 min cache]
        TS --> ACT[TrashActivityLogger]
        SETTINGS --> DB[(trashbin_* tables)]
        TS --> DB
        SCHED[Hourly Scheduler] --> PURGE[PurgeTrashCommand]
        PURGE --> DB
        ADMIN[Admin Panel /admin/trashbinpro] --> SETTINGS
    end
    subgraph Node[Wings Node]
        TS -->|HTTPS + Bearer| WINGS[Wings DaemonFileRepository]
        PURGE -->|delete expired batch| WINGS
        WINGS --> TRASHDIR[/.trash folder in container]
    end
```

The **panel** owns all state: which files are trashed, where they originally lived, who deleted them, and when the retention window expires. The **game server** holds the actual bytes — files live in a hidden `/.trash` directory inside the container, moved there through the same Wings `DaemonFileRepository` the stock file manager uses. No node-side daemon, no extra ports, no cron edits: the hourly purge is scheduled by the service provider.

---

## Key Features

- **Soft delete** — deleted files are moved to a hidden `/.trash` folder on the server instead of being destroyed; the stock hard delete stays one click away via a permanent-delete flow.
- **Restore with collision-safe naming** — files return to their original path; if something already occupies that name, the restore becomes `name (restored)`, `name (restored 2)`, and so on.
- **Disk quotas** — cap trash usage per server, per egg, or globally (0 = unlimited). A single file larger than the cap, or a bin that would overflow, is rejected with a structured HTTP 409 and the UI offers a guarded **Delete Permanently** alternative.
- **Retention windows** — per-server, per-egg, or global retention in hours (1–8760). Expired entries are removed by the hourly `p:trashbin:purge` run.
- **Fault-tolerant hourly purge** — chunked `chunkById` batches, one Wings call per server, per-server try/catch so one unreachable node never blocks the rest, and failed servers are retried on the next run.
- **Sub-user permission** — `trashbinpro.access` controls who can view, restore from, and empty the trash bin; enforced server-side on every client route.
- **Activity logging** — every trash, restore, purge, and empty event is written to Pterodactyl's built-in activity log (`server:trashbinpro.*`).
- **Full admin panel** — `/admin/trashbinpro`: global settings, per-egg overrides, top servers by trash usage, and a manual **Purge Now** button.
- **Idempotent installer** — every PHP and React/TypeScript patch is marker-guarded and check-before-insert per block; reinstalling is a zero-diff no-op.
- **Trash Bin protects itself** — server-side guards refuse to trash the `/.trash` directory itself, and ghost rows (files already gone from disk) are cleaned up instead of erroring.

---

## Stock Pterodactyl vs Trash Bin Pro

| | Stock Pterodactyl | Trash Bin Pro |
|---|---|---|
| Delete behavior | Hard delete — file is gone immediately | Move to `/.trash`, tracked in MySQL |
| Recovery window | None | Configurable retention (hours), per server / egg / global |
| Restore | Not possible | One click, collision-safe naming |
| Quotas | None — N/A, nothing is kept | Per-server, per-egg, and global byte caps |
| Permissions | `file.delete` only | Adds `trashbinpro.access` for view/restore/empty |
| Audit trail | Delete event only | Trash, restore, purge, and empty all logged |
| Permanent delete | The only option | Explicit guarded flow with confirmation checkbox |

---

## Quick Install

**Blueprint (recommended):**

```bash
cd /var/www/pterodactyl
blueprint -i pterodactyltrashbinpro-v1.0.2
```

**Standalone (no Blueprint):** copy `standalone/PanelFiles` into the panel, then run `standalone/data/install.sh` with `PTERODACTYL_DIRECTORY` set. Either way, rebuild the client SPA afterwards:

```bash
cd /var/www/pterodactyl
yarn build:production
```

::: tip Scheduler requirement
The hourly purge runs through Laravel's scheduler, registered by the service provider — no `Kernel.php` edit needed. You only need the standard Pterodactyl cron entry (`* * * * * php /var/www/pterodactyl/artisan schedule:run`) already in place.
:::

---

## How It Works

1. **Delete** — the user deletes files in the file manager. The patched `FileController::delete()` intercepts the request and calls `TrashService::trashFiles()`, which validates quotas and refuses the trash directory itself.
2. **Move + record** — a `trashbin_files` row is created per file (original path, size, mode, who deleted it), then Wings renames each file into `/.trash/{id}` — the row id doubles as the on-disk name, so the bin never has name collisions.
3. **Restore or manage** — from the Trash view (toolbar button in the file manager), users with `trashbinpro.access` can restore files to their original path, delete individual entries permanently, or empty the bin. Name collisions on restore are resolved automatically.
4. **Hourly purge** — `p:trashbin:purge` runs every hour via the scheduler, walks `trashbin_files` in chunks, applies each server's effective retention window, and deletes expired files from Wings and the database in one call per server.

---

## Compatibility

| Component | Target |
|---|---|
| Pterodactyl Panel | v1.11.x / v1.12.x |
| Laravel / PHP | Laravel 11, PHP 8.2+ |
| Blueprint | `beta-2026-05` |
| Version | `1.0.2` |

::: warning Trash counts against real disk
Files in `/.trash` still occupy the server's disk allocation. Set capacity limits in **Admin → Trash Bin Pro** so a busy trash bin cannot starve a server of working space.
:::
