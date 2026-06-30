---
title: Installation
description: Install S3 Database Storage for VPS, run the setup wizard, verify the schedule, and uninstall.
---

# Installation

## Prerequisites

- A Linux VPS (Debian/Ubuntu, RHEL/Fedora, etc.) with **root/sudo**.
- **Python 3.8+**.
- Client tools for whatever you back up (the installer tries to install these for you):
  - PostgreSQL: `pg_dump` / `psql` — package `postgresql-client`
  - MySQL/MariaDB: `mysqldump` / `mysql` — package `default-mysql-client` or `mariadb-client`
- An **S3-compatible bucket** and an access key / secret key.

## 1. Install

```bash
git clone https://github.com/AnAverageBeing/s3-database-storage-for-vps.git
cd s3-database-storage-for-vps
sudo bash install.sh
```

The installer:

1. Installs system dependencies (`python3`, `pip`, `gzip`, database client tools).
2. Copies the program to `/opt/s3dbbackup` and creates an isolated Python virtualenv there.
3. Creates the `s3dbbackup` command at `/usr/local/bin/s3dbbackup`.

## 2. Run the setup wizard

```bash
sudo s3dbbackup setup
```

The wizard walks you through nine short steps:

1. **S3 storage** — endpoint, region, access key, secret key, bucket, path-style toggle.
2. **Folder** — a prefix everything is stored under.
3. **Connection test** — it won't continue until S3 responds.
4. **Pick databases** — choose from an auto-detected, numbered list (`1,3,4` or `all`).
5. **Local copy** — optionally keep a copy on the node.
6. **Frequency** — hourly / 6h / 12h / daily / weekly / custom.
7. **Retention** — how many copies to keep per database.
8. **Discord alerts** — optional webhook + event selection.
9. **Schedule** — it writes and enables the systemd timer, then offers to run a backup now.

::: tip Recommended values
- **Cloudflare R2**: Region `auto`, path-style **on**.
- **DigitalOcean Spaces**: Region = datacenter (e.g. `sgp1`), path-style **on**.
- **AWS S3**: leave Endpoint blank, set the region, path-style **off**.
- **Frequency**: `daily` for most servers; `every 6 hours` for busy databases.
- **Max copies**: `7` (a week of dailies).
:::

## 3. Verify

```bash
# Show config, last run, and next scheduled run
sudo s3dbbackup status

# Confirm the timer is active and see the next trigger time
systemctl list-timers s3dbbackup.timer

# Run a backup on demand
sudo s3dbbackup backup
```

After a run, check your bucket — objects appear under:

```
<bucket>/<folder>/<db-type>/<db-name>/<timestamp>.sql.gz
```

## Troubleshooting

::: details No databases were detected
The wizard scans using local/peer authentication. If your databases require a
password, choose **Add databases manually** (or answer "yes" when asked whether
the dumps need explicit credentials) and provide host/port/user/password.
:::

::: details `pg_dump`/`mysqldump` not found
Install the client tools:
```bash
# Debian/Ubuntu
sudo apt-get install -y postgresql-client default-mysql-client
# RHEL/Fedora
sudo dnf install -y postgresql mysql
```
:::

::: details S3 connection fails
Double-check the **endpoint**, **region**, and **path-style** setting for your
provider. Most non-AWS providers (R2, MinIO, Spaces, B2) require path-style
**on**. The wizard lets you edit and retry without restarting.
:::

::: details The timer isn't running
```bash
sudo systemctl enable --now s3dbbackup.timer
systemctl status s3dbbackup.timer
journalctl -u s3dbbackup.service --no-pager   # see backup run logs
```
:::

## Uninstall

```bash
# Removes the timer, command, and /opt/s3dbbackup — keeps your config
sudo bash uninstall.sh

# Also remove /etc/s3dbbackup (config)
sudo bash uninstall.sh --purge
```

Local backup files under `/var/backups/s3dbbackup` (or your chosen path) and any
objects already in S3 are left untouched.
