---
title: Installation
description: Install the Sentinel panel addon (Blueprint or standalone) and the Go node agent on each Wings node, with post-install verification, troubleshooting and uninstall steps.
---

# Installation

Sentinel has two halves, installed separately: the **panel addon** (once, on the Pterodactyl panel host) and the **node agent** (once per Wings node). Install the panel first — the node installer asks for a token that only exists after the addon is installed.

---

## Prerequisites

### Panel host

- Pterodactyl Panel 1.x with PHP 8.2+, working migrations, and admin access.
- Either [Blueprint](https://blueprint.zip) installed (for the `.blueprint` distribution) or plain SSH/root access (for the standalone distribution).
- The panel must be reachable from every Wings node over HTTP(S).

### Each Wings node

- Linux x86_64 (amd64) or aarch64 (arm64).
- Root access and systemd (`systemctl` must exist).
- Docker running with the socket at `/var/run/docker.sock` (standard on Wings nodes).
- Either the Go 1.22+ toolchain (the installer builds from source) or the prebuilt `sentinel` binary placed next to `install.sh`.
- Outbound HTTPS from the node to the panel URL.

::: warning
The agent runs as root and needs real root: it walks `/proc` (including other users' processes), talks to the docker socket, and enforces containment (kill, pause, stop, quarantine). The systemd unit intentionally uses light sandboxing.
:::

---

## Part 1 — Panel addon

Choose **one** of the two distributions. Both install the same code; the Blueprint package is managed by Blueprint, the standalone installer merges the same PanelFiles tree directly.

### Option A: Blueprint

1. Download `Sentinel-vX.Y.Z.zip` from the [Releases page](https://github.com/AnAverageBeing/pterodactyl-sentinel/releases) and extract it.
2. Copy the `.blueprint` file to your panel directory:

   ```bash
   cp pterodactylsentinel-vX.Y.Z.blueprint /var/www/pterodactyl/
   cd /var/www/pterodactyl
   ```

3. Install:

   ```bash
   blueprint -i pterodactylsentinel-vX.Y.Z
   ```

### Option B: Standalone

1. Extract the release zip and enter the standalone directory:

   ```bash
   cd standalone/sentinel-standalone
   ```

2. Run the installer as root, pointing it at your panel:

   ```bash
   sudo PTERODACTYL_DIRECTORY=/var/www/pterodactyl bash install.sh
   ```

   The installer is idempotent (safe to re-run), serializes itself against concurrent addon installs with `flock /tmp/panel-install.lock`, copies the PanelFiles tree into the panel, registers the addon's routes and sidebar entry, and runs the database migrations. Pass `--skip-migrations` if you want to run `php artisan migrate` yourself afterwards.

### What the panel install does

- Creates all `sentinel_*` tables (tokens, events, hashes, flagged servers, scans, quarantines, settings) and seeds default settings.
- Registers `routes/api-sentinel.php` — the node-facing API at `/api/sentinel/node/*` with token auth, JSON validation and a 120 req/min throttle.
- Adds the Sentinel section to the admin sidebar with all eight tabs.
- Registers the `sentinel:housekeeping` artisan command.

::: tip
After installing, schedule housekeeping so stale nodes flip offline and old events are pruned. Add it to the panel's cron entry (the same crontab that runs `schedule:run`):

```bash
* * * * * php /var/www/pterodactyl/artisan schedule:run >> /dev/null 2>&1
```

The command is registered with the scheduler by the addon; you can also run it manually at any time (see [CLI Reference](../user-guide/cli.md#sentinelhousekeeping)).
:::

---

## Part 2 — Node agent (per Wings node)

### 1. Create the pairing token

In the panel admin area, open **Sentinel → Nodes**. Every Pterodactyl node has a card there; click **Create token** (or **View token** if one exists) and copy the 64-hex token.

::: info
The panel stores a bcrypt hash for verification plus an encrypted copy so you can re-view the token later. Resetting a token invalidates the old one immediately — the node goes offline until re-paired with the new token.
:::

### 2. Run the installer on the node

Copy the `node-module` directory to the Wings node, then as root:

```bash
sudo bash node-module/install.sh
```

The installer is interactive (safe for `curl | bash` — prompts are read from `/dev/tty`) and asks for:

| Prompt | Default | Notes |
| --- | --- | --- |
| Panel URL | — | e.g. `https://panel.example.com`. Trailing slash is stripped. Plain `http://` prints a cleartext warning. |
| Node token | — | Exactly 64 hex characters, from Sentinel → Nodes. Case-normalized to lowercase. |
| Listen address | `0.0.0.0` | Address the agent's API binds to. |
| Listen port | `8481` | Port the panel uses to call back into the node. |

It then:

1. Installs the binary to `/usr/local/bin/sentinel` — built from source if Go is available, otherwise the prebuilt `./sentinel` (or `./build/sentinel-linux-<arch>`) next to the script.
2. Writes `/etc/sentinel/config.yaml` and `/etc/sentinel/token`, both mode `0600`. Detection settings are **not** in this file — they are panel-managed and pushed to the node; the file only holds node-local settings (API listen, panel URL, token file, state dir, docker socket, log level).
3. Installs and starts `sentinel-node.service` (enabled at boot, `Restart=always`, 512 MiB memory cap, 100% CPU quota).
4. Waits up to 90 seconds for the agent to register with the panel and prints the result.

::: tip
The installer is idempotent — re-running it rewrites the config/token and restarts the service. That is the supported way to re-pair a node after a token reset.
:::

### 3. Firewall note

The panel calls back into the node's API (`POST /api/v1/config`, scan triggers, containment actions, live stats). Allow inbound TCP from the panel host to the agent's listen port (default **8481**):

```bash
# ufw example — restrict to the panel's IP
sudo ufw allow from <panel-ip> to any port 8481 proto tcp
```

If you bound the agent to `127.0.0.1`, config push and panel-initiated actions cannot reach it — heartbeats and event uploads still work, but use a reachable address in production.

---

## Post-install verification

### 1. Node health (on the node)

```bash
curl -s http://127.0.0.1:8481/api/v1/health | jq
```

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "containers": 12,
    "uptime_seconds": 3600,
    "config_version": 5,
    "dry_run": true,
    "detectors": ["miner", "portscan", "ddos", "..."]
  },
  "error": null,
  "meta": { "version": "1.0.0" }
}
```

`/api/v1/health` is public and cheap — safe for load-balancer or monitoring probes.

### 2. Registration (on the node)

```bash
journalctl -u sentinel-node.service --since today | grep "registered as node"
sentinel status
```

`sentinel status` prints the config file, state dir, panel URL, API listen address, current config version, dry-run state and docker connectivity.

### 3. Panel side

Open **Sentinel → Nodes**: the node card should show **online**, the agent version, a recent last-seen time, and the current config version with push status. **Sentinel → Dashboard** should count the node under online nodes.

### 4. Test event

Run a one-off local scan (no enforcement, nothing shipped):

```bash
sentinel scan
```

Then confirm the live pipeline works end-to-end by watching the log while a detection fires, and check **Sentinel → Detections** for the event.

---

## Troubleshooting

### Admin pages return 404

The addon's routes were not registered — usually stale Laravel caches after install. From the panel directory:

```bash
php artisan route:clear
php artisan config:clear
php artisan cache:clear
```

If the sidebar link is missing but routes exist, the sidebar patcher did not apply; re-run the installer (it is idempotent).

### Node shows offline

Check in order:

1. `systemctl status sentinel-node` and `journalctl -u sentinel-node.service -n 100` on the node.
2. Panel URL reachable from the node: `curl -sS https://panel.example.com/api/sentinel/node/register` (expect a 401/405 JSON error — connectivity is what you are testing, not auth).
3. Token correctness: re-view it in **Sentinel → Nodes**. If it was reset, re-run `install.sh` with the new token.
4. Time skew: both hosts should run NTP; the panel marks nodes offline after 120 s without a heartbeat (`sentinel.offline_after_seconds`).

The agent retries registration with backoff forever — once the panel is reachable and the token is valid, the node comes online by itself.

### Migrations fail with errno 150 (foreign key)

`errno: 150 "Foreign key constraint is incorrectly formed"` means the parent table column types do not match. Sentinel's FK columns are `unsignedInteger` to match Pterodactyl's `nodes.id` / `servers.id`. This error almost always means the migrations ran against a panel whose core tables use a different engine/collation, or an older partial migration exists. Fix:

1. Ensure all core Pterodactyl tables are InnoDB with the panel's default collation (`utf8mb4_unicode_ci`).
2. Drop any half-created `sentinel_*` tables, then re-run `php artisan migrate --force`.

### Settings changes do not appear / stale views (opcache)

PHP opcache can serve the old compiled views and config after an install or settings change:

```bash
php artisan view:clear
php artisan config:clear
# then reload PHP-FPM (or apache) to drop opcache:
sudo systemctl reload php8.2-fpm   # adjust to your PHP version/SAPI
```

### Node installed but no detections ever appear

- Confirm `dry_run` is expected — in dry-run, events are still reported, so this is not the cause.
- Check the node log for detector errors: `journalctl -u sentinel-node.service -f`.
- Run `sentinel scan` manually; it prints every finding as JSON. If that finds nothing on a node you believe is dirty, the detectors are working and the node is simply clean.

---

## Uninstall

### Node agent

```bash
sudo bash node-module/uninstall.sh
```

Stops and disables `sentinel-node.service` and removes the binary and `/etc/sentinel`. State under `/var/lib/sentinel` (spool, quarantine, intel, persisted panel config) is kept unless you pass `--purge`; pass `--keep-config` to keep `/etc/sentinel`:

```bash
sudo bash node-module/uninstall.sh --purge          # full removal
sudo bash node-module/uninstall.sh --keep-config    # keep config + token for reinstall
```

Then delete the node's token card in **Sentinel → Nodes** (or leave it — a reset token can never be used again).

### Panel addon

- **Blueprint:** `blueprint -r pterodactylsentinel`
- **Standalone:** `sudo PTERODACTYL_DIRECTORY=/var/www/pterodactyl bash standalone/remove.sh`

Both remove the addon's files, routes and sidebar entry. The `sentinel_*` tables are left in place by default so your event history survives a reinstall; drop them manually if you want a clean slate.
