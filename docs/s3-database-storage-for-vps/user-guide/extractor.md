---
title: The Extractor
description: Browse backups stored in S3 and download any one to your machine, with optional decompression and restore commands.
---

# The Extractor

The extractor is how you get a backup back. It logs in to S3, shows a tree of
every stored backup grouped by database, and downloads the one you choose.

```bash
sudo s3dbbackup extract
```

## How it works

### 1. Connect

It asks whether to use the **saved connection** from this server's config, or to
enter fresh credentials (handy when restoring on a different machine, or pulling
from a bucket this server didn't create).

```
Use the saved S3 connection from this server's config? [Y/n]
```

If you choose fresh credentials it prompts for endpoint, region, access key,
secret, bucket, folder/prefix, and path-style — then tests the connection.

### 2. Browse

It prints a tree of every backup, grouped by database type and name, each line
numbered:

```
Available backups
├── mysql
│   └── wordpress (3)
│       ├── #1 2026-06-30_18-00-02.sql.gz   3.21 MiB · 2026-06-30 18:00:02
│       ├── #2 2026-06-29_18-00-02.sql.gz   3.19 MiB · 2026-06-29 18:00:02
│       └── #3 2026-06-28_18-00-02.sql.gz   3.18 MiB · 2026-06-28 18:00:02
└── postgresql
    └── app_production (2)
        ├── #4 2026-06-30_18-00-01.sql.gz  12.84 MiB · 2026-06-30 18:00:01
        └── #5 2026-06-29_18-00-01.sql.gz  12.71 MiB · 2026-06-29 18:00:01
```

### 3. Choose

Type the **`#number`**, or paste a full key or filename:

```
Which backup do you want to extract? #4
```

### 4. Download

Choose a target directory (defaults to the current directory). The file is
downloaded there:

```
Extract to which directory? /root/restores
[*] Downloading s3dbbackup/postgresql/app_production/2026-06-30_18-00-01.sql.gz → /root/restores/2026-06-30_18-00-01.sql.gz
✓ Saved to /root/restores/2026-06-30_18-00-01.sql.gz
```

### 5. Decompress (optional)

It can gunzip the `.sql.gz` for you and prints the exact restore command:

```
Decompress the .gz now? [y/N] y
✓ Decompressed to /root/restores/2026-06-30_18-00-01.sql
Restore example (PostgreSQL): psql -U postgres dbname < /root/restores/2026-06-30_18-00-01.sql
Restore example (MySQL):      mysql -u root dbname < /root/restores/2026-06-30_18-00-01.sql
```

## Restoring into a database

After extracting and decompressing:

```bash
# PostgreSQL — create the target DB first if needed
createdb -U postgres app_production_restored
psql -U postgres app_production_restored < 2026-06-30_18-00-01.sql

# MySQL / MariaDB
mysql -u root -e "CREATE DATABASE wordpress_restored;"
mysql -u root wordpress_restored < 2026-06-30_18-00-02.sql
```

::: tip
You can also restore straight from the gzip without decompressing to disk:
```bash
gunzip -c 2026-06-30_18-00-02.sql.gz | mysql -u root wordpress_restored
```
:::

::: warning
Restoring over a live database overwrites data. Restore into a fresh database
name first and verify before switching your application over.
:::
