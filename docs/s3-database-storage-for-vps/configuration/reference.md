---
title: Configuration Reference
description: Every value in /etc/s3dbbackup/config.json explained — what it does, defaults, and when to change it.
---

# Configuration Reference

Configuration lives in **`/etc/s3dbbackup/config.json`** (created by the setup
wizard, mode `600`). You normally never edit it by hand — re-run
`sudo s3dbbackup setup` to change anything — but every field is documented here.

## Full example

```json
{
  "version": 1,
  "s3": {
    "endpoint": "https://<account>.r2.cloudflarestorage.com",
    "access_key_id": "AKIA...",
    "secret_access_key": "********",
    "bucket": "my-vps-backups",
    "region": "auto",
    "prefix": "s3dbbackup",
    "use_path_style": true
  },
  "databases": [
    { "type": "postgresql", "name": "app_production" },
    { "type": "mysql", "name": "wordpress", "host": "localhost", "port": 3306, "user": "root", "password": "********" }
  ],
  "schedule": { "frequency_label": "Every day (midnight)", "oncalendar": "daily" },
  "retention": { "max_copies": 7 },
  "local": { "enabled": true, "path": "/var/backups/s3dbbackup" },
  "notifications": {
    "enabled": true,
    "webhook_url": "https://discord.com/api/webhooks/...",
    "events": ["trigger", "success", "failure", "error"]
  }
}
```

## `s3` — storage connection

| Key | Type | Default | What it does | When to change |
|---|---|---|---|---|
| `endpoint` | string | `""` | S3 API endpoint URL. Empty = AWS S3. | Set for R2/MinIO/Spaces/B2/Wasabi. |
| `access_key_id` | string | — | Access key. | When rotating keys. |
| `secret_access_key` | string | — | Secret key (stored locally, never sent anywhere but S3). | When rotating keys. |
| `bucket` | string | — | Bucket that holds the backups. | If you move buckets. |
| `region` | string | `us-east-1` | Signing region. R2 = `auto`; Spaces = datacenter (e.g. `sgp1`). | Match your provider. |
| `prefix` | string | `s3dbbackup` | Folder all objects live under. Keeps backups separate from other data. | To share a bucket with other data. |
| `use_path_style` | bool | `true` | Path-style addressing (`endpoint/bucket/key`). | **On** for non-AWS; off for AWS. |

::: warning Common mistake
For Cloudflare R2, MinIO, DigitalOcean Spaces and most non-AWS providers,
`use_path_style` must be **`true`**. Leaving it off is the most common cause of
connection or upload errors.
:::

## `databases` — what to back up

An array of objects. Minimum fields are `type` and `name`; credential fields are
optional and only used when the dump can't authenticate via the local socket.

| Key | Type | Default | What it does |
|---|---|---|---|
| `type` | string | — | `postgresql` or `mysql` (MariaDB uses `mysql`). |
| `name` | string | — | The database name. |
| `host` | string | `localhost` | DB host. |
| `port` | int | `5432` / `3306` | DB port. |
| `user` | string | `postgres` / `root` | DB user used for the dump. |
| `password` | string | `""` | DB password. Omit to use peer/socket auth. |

::: tip
For PostgreSQL with peer auth, leaving credentials empty lets the tool dump via
the local `postgres` user. For MySQL/MariaDB, an empty password uses local
socket auth as the configured user.
:::

## `schedule` — how often it runs

| Key | Type | Default | What it does |
|---|---|---|---|
| `frequency_label` | string | `daily` | Human label shown in `status`. |
| `oncalendar` | string | `daily` | The systemd `OnCalendar=` expression that drives the timer. |

Common `oncalendar` values:

| Frequency | `oncalendar` |
|---|---|
| Hourly | `hourly` |
| Every 6 hours | `*-*-* 00/6:00:00` |
| Every 12 hours | `*-*-* 00/12:00:00` |
| Daily (midnight) | `daily` |
| Weekly (Sunday) | `weekly` |

## `retention` — how many copies to keep

| Key | Type | Default | What it does |
|---|---|---|---|
| `max_copies` | int | `7` | Keep the newest N backups **per database**. On the N+1th backup the oldest is deleted from S3 and from the local copy. `0` = keep everything. |

## `local` — on-node copies

| Key | Type | Default | What it does |
|---|---|---|---|
| `enabled` | bool | `true` | Also store a copy on the server. |
| `path` | string | `/var/backups/s3dbbackup` | Where local copies live (organised as `path/<type>/<name>/`). |

## `notifications` — Discord alerts

| Key | Type | Default | What it does |
|---|---|---|---|
| `enabled` | bool | `false` | Master switch. |
| `webhook_url` | string | `""` | Discord-compatible webhook URL. |
| `events` | array | `["failure","error"]` | Which events to send: `trigger`, `success`, `failure`, `error`. |

See [Discord Webhooks](/s3-database-storage-for-vps/user-guide/webhooks) for what
each event looks like.

## Files & locations

| Path | Purpose |
|---|---|
| `/etc/s3dbbackup/config.json` | This configuration (mode `600`). |
| `/etc/s3dbbackup/state.json` | Last-run timestamp and failure count. |
| `/opt/s3dbbackup/` | Program + virtualenv. |
| `/usr/local/bin/s3dbbackup` | The command. |
| `/etc/systemd/system/s3dbbackup.{service,timer}` | The schedule. |
| `/var/backups/s3dbbackup/` | On-node copies (configurable). |
| `/tmp/s3dbbackup/` | Temporary dump files (deleted after each run). |
