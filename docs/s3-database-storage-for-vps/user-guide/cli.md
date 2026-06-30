---
title: CLI Reference
description: Every s3dbbackup command with syntax, example output, and when to use it.
---

# CLI Reference

All commands are run as **root** (they read `/etc/s3dbbackup/config.json` and may
write systemd units and local backups).

```
s3dbbackup <command>
```

| Command | What it does |
|---|---|
| [`setup`](#setup) | Interactive first-time setup wizard |
| [`backup`](#backup) | Run a backup now (also called by the systemd timer) |
| [`extract`](#extract) | Browse S3 backups and download one |
| [`status`](#status) | Show config, last run, and next scheduled run |
| [`version`](#version) | Print the version |

## `setup`

Runs the interactive wizard: S3 connection, folder, connection test, database
selection, local copy, frequency, retention, Discord alerts, then installs the
systemd timer.

```bash
sudo s3dbbackup setup
```

Use it the first time, or any time you want to change what is backed up, how
often, retention, or notifications.

## `backup`

Runs one full backup cycle immediately: dumps each configured database, uploads
to S3, keeps a local copy, enforces retention, and sends notifications. This is
exactly what the systemd timer invokes.

```bash
sudo s3dbbackup backup
```

Example output:

```
[*] Backup started for 2 database(s) at 2026-06-30_18-00-01
  - Dumping postgresql/app_production ...
    Uploading to s3://.../s3dbbackup/postgresql/app_production/2026-06-30_18-00-01.sql.gz (12.84 MiB)
    Retention removed s3://.../s3dbbackup/postgresql/app_production/2026-06-23_18-00-01.sql.gz
    [OK] app_production
  - Dumping mysql/wordpress ...
    Uploading to s3://.../s3dbbackup/mysql/wordpress/2026-06-30_18-00-02.sql.gz (3.21 MiB)
    [OK] wordpress
[*] Backup finished. 2 ok, 0 failed.
```

Exit code is `0` when every database succeeded, `1` if any failed.

## `extract`

Opens the interactive extractor — connect to S3, browse a tree of every stored
backup, pick one, and download it (optionally decompressing). See
[The Extractor](/s3-database-storage-for-vps/user-guide/extractor) for a full
walkthrough.

```bash
sudo s3dbbackup extract
```

## `status`

Prints your configuration, the last run result, and the next scheduled run.

```bash
sudo s3dbbackup status
```

Example output:

```
╭──────────── S3 DB Backup — Configuration ────────────╮
│ Endpoint         https://<id>.r2.cloudflarestorage.com │
│ Bucket / folder  my-vps-backups/s3dbbackup             │
│ Region           auto                                  │
│ Databases        postgresql:app_production, mysql:wordpress │
│ Schedule         Every day (midnight)                  │
│ Max copies       7                                     │
│ Local copy       /var/backups/s3dbbackup               │
│ Notifications    on: trigger,success,failure,error     │
╰────────────────────────────────────────────────────────╯
Last run: 2026-06-30T18:00:03  (failures: 0)
```

## `version`

```bash
s3dbbackup version
# s3dbbackup 1.0.0
```

## Running on a schedule

The wizard installs a systemd timer, but you can manage it directly:

```bash
systemctl list-timers s3dbbackup.timer      # when does it run next?
systemctl status s3dbbackup.timer           # is it active?
journalctl -u s3dbbackup.service --no-pager # run logs
sudo systemctl start s3dbbackup.service     # trigger a run via systemd
```
