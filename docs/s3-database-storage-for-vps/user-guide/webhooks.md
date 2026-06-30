---
title: Discord Webhooks
description: Set up Discord notifications for backup trigger, success, failure, and error events.
---

# Discord Webhooks

The tool can post a rich embed to a **Discord-compatible webhook** whenever
something happens. It's optional and configured in the setup wizard (Step 8).

## Setting it up

During `sudo s3dbbackup setup`:

```
Send alerts to a Discord webhook? [y/N] y
Discord webhook URL: https://discord.com/api/webhooks/123.../abc...
  Notify on 'trigger'? [y/N] y
  Notify on 'success'? [y/N] n
  Notify on 'failure'? [Y/n] y
  Notify on 'error'?   [Y/n] y
```

To get a webhook URL: in Discord, open **Server Settings → Integrations →
Webhooks → New Webhook**, pick a channel, and **Copy Webhook URL**.

## Events

| Event | When it fires | Suggested |
|---|---|---|
| `trigger` | A backup cycle starts (lists the databases). | Optional |
| `success` | A database was backed up and uploaded. One per database. | Off on busy servers |
| `failure` | A specific database's dump or upload failed. | **On** |
| `error` | An unexpected error (e.g. S3 client couldn't initialise). | **On** |

::: tip Recommended
Enable **`failure`** and **`error`** so you only hear from it when something is
wrong. Add `success`/`trigger` if you want a heartbeat that backups are running.
:::

## What the messages look like

Each notification is a colored embed titled `S3 DB Backup — <event>`:

- **Trigger** (blue) — "Starting backup for *N* database(s)" with the list.
- **Success** (green) — database name, type, size, and the S3 key.
- **Failure** (red) — the database name and the error reason.
- **Error** (orange) — the operation and a trimmed traceback.

## Reliability

Notifications never block or break a backup. If Discord is unreachable or the
webhook is invalid, the failure is ignored silently and the backup continues.

## Changing it later

Re-run the wizard and adjust Step 8:

```bash
sudo s3dbbackup setup
```

Or edit the `notifications` block in
[`/etc/s3dbbackup/config.json`](/s3-database-storage-for-vps/configuration/reference#notifications-discord-alerts)
directly.
