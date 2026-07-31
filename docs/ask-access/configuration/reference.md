---
title: Configuration Reference
description: Every Ask Access setting — config file values, environment variables, admin panel policy, and permission presets.
---

# Configuration Reference

Ask Access is configured in two places: the **admin settings page** (stored in the database, no restart needed) and the **`config/askaccess.php`** file (overridable via environment variables).

---

## Admin panel settings

Found at **Admin → Extensions → Ask Access** (Blueprint installs). Stored in the `askaccess_admin_settings` table and applied immediately.

| Setting | Type | Default | What it does |
|---|---|---|---|
| Access mode | `everyone` · `allowlist` · `blacklist` | `everyone` | Who may use Ask Access at all. Root admins always bypass this. |
| Allowlist | list of emails | empty | When mode is `allowlist`, only these emails can use the feature. |
| Blacklist | list of emails | empty | When mode is `blacklist`, these emails are excluded. |
| Request decay (hours) | integer, 1–8760 | `24` | How long a pending request stays valid before it is auto-expired by the scheduler. |
| Block rate limit | integer, 1–1000 | `10` | Max "block user" actions a single account may perform per minute. |

**When to change:**

- Set mode to `allowlist` on hosts where only paying customers should share servers.
- Raise **request decay** if your users are slow to respond (e.g. `168` = one week).
- Emails in lists are normalized (lower-cased, validated, de-duplicated) — paste them one per line or comma-separated.

::: info Common mistake
Switching to `allowlist` with an empty list disables the feature for **everyone except root admins**. Add emails first, then switch the mode.
:::

---

## Environment / config file

`config/askaccess.php` — every value can be set via `.env` without touching the file.

| Env variable | Config key | Type | Default | What it does |
|---|---|---|---|---|
| `ASKACCESS_MAX_PENDING` | `max_pending_per_user` | int | `25` | Maximum pending outgoing requests one user may have open at once. Anti-spam cap. |
| `ASKACCESS_CREATE_RATE_LIMIT` | `create_rate_limit` | int | `15` | Max requests a user may **create** within the rolling window below. |
| `ASKACCESS_CREATE_RATE_WINDOW` | `create_rate_window_minutes` | int | `60` | Window (minutes) for the creation rate limit. |
| `ASKACCESS_MAX_SERVERS_PER_GRANT` | `max_servers_per_grant` | int | `250` | Safety cap on how many servers a single "all servers of this user" approval can touch. |
| `ASKACCESS_REQUEST_TTL_DAYS` | `request_ttl_days` | int | `14` | **Unused** — kept for backward compatibility. Request expiry is controlled by the admin **request decay (hours)** setting instead. |

After changing any of these, clear the config cache:

```bash
cd /var/www/pterodactyl
php artisan config:clear
```

---

## Permission presets

Defined under `presets` in `config/askaccess.php`. The `full` preset is **not** a static list — it expands at runtime to every permission registered in the panel. Every preset automatically includes `websocket.connect` so grantees can actually load the server console.

| Preset | UI label | Includes |
|---|---|---|
| `read` | Read-only | Console view, file read, backup/allocation/startup/database/schedule/activity read. Nothing that changes state. |
| `standard` | Standard | Everything in `read`, plus start/stop/restart, file create/update/archive, backup create/download, startup edit. |
| `full` | Full access | Every registered panel permission, including `accessmanager.manage`. |

**When to change:** edit the `presets` arrays if your panel has custom permissions from other addons you want included in (or excluded from) `read`/`standard`. Unknown permission strings are stripped at runtime, so a typo can't grant anything.

::: warning `full` implies delegation
Because `full` contains `accessmanager.manage`, anyone granted Full access can grant and revoke access for that server themselves. If you don't want that, remove `accessmanager` from the permission list or avoid offering the preset.
:::

---

## The `accessmanager.manage` permission

The installer adds a custom permission group to `app/Models/Permission.php`:

| Permission | Granted by | Effect |
|---|---|---|
| `accessmanager.manage` | Owner via the Active tab / subuser editor | The subuser can manage access **for that server** from their own Server Access page: add/remove users, edit permissions, set expiry. |

- Scoped per server — a manager on server A has no power over server B.
- Managers cannot remove the owner and cannot escalate their own permissions beyond what exists on the panel.
- Uninstalling the addon removes this permission group cleanly.
