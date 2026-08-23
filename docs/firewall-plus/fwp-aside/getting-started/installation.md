---
title: Installation
description: Install Firewall-Plus on a Pterodactyl panel via Blueprint or the standalone installer, then deploy the node daemon to every Wings host.
---

# Installation

Firewall-Plus has two install halves:

1. **Panel extension** — Blueprint addon (recommended) or standalone installer.
2. **Node daemon** — the `firewall-plus` Fastify service on **every** Wings host.

Both halves must be installed and on compatible versions for applies to work.

---

## Prerequisites

**Panel:**

- Pterodactyl Panel 1.x with PHP 8.2+ and the standard panel extensions
- [Blueprint](https://blueprint.zip) framework (Blueprint path only)
- Working **scheduler cron**: `* * * * * php /var/www/pterodactyl/artisan schedule:run`
- Working **queue worker** (`pteroq` systemd service or `php artisan queue:work`) — applies are queued jobs; without a worker nothing reaches the node

**Each Wings node:**

- Linux host with `iptables` and `ipset` installed (nft-backed `iptables-nft` is auto-detected and preferred)
- Node.js 18+ (installed by the node installer if missing)
- Root/systemd for the `firewall-plus` service (needs `CAP_NET_ADMIN`)

---

## Panel: Blueprint Install (recommended)

```bash
cd /var/www/pterodactyl
blueprint -install pterodactylfirewallplus-v1.2.6.blueprint
php artisan migrate --force
```

Verify the extension is registered:

```bash
php artisan list firewall-plus
```

You should see the `firewall-plus:*` commands. The admin sidebar gains a **Firewall** section, and each server's settings gain a **Firewall** tab.

## Panel: Standalone Install (no Blueprint)

Download the release and use the `standalone/` folder:

```bash
cd pterodactyl-firewall-plus/standalone
sudo bash install.sh
php artisan migrate --force    # from /var/www/pterodactyl
```

To remove it later:

```bash
sudo bash uninstall.sh
```

::: warning PHP extensions under Blueprint's sanitized environment
Blueprint runs its install steps in a sanitized shell. If your panel's PHP CLI relies on extensions loaded via per-user ini paths (common with `php-fpm` + custom pools), the install can fail with missing-extension errors even though `php -m` looks fine in your normal shell. Run the install as the same user and environment Blueprint uses, and check `php -m` under `sudo -u www-data` (or your web user) if something is reported missing.
:::

---

## Node Installation

Run on **every** Wings host:

```bash
curl -fsSL https://fw-install.xdp.network/node/install.sh | sudo bash
```

The installer:

- Drops the service into `/opt/firewall-plus`
- Writes `/etc/firewall-plus/config.json` and generates a 64-hex bearer token at `/etc/firewall-plus/token` (chmod `600`)
- Installs and starts the hardened `firewall-plus` systemd unit
- Prints the token once — you paste it into the panel when adding the node

Verify locally on the node:

```bash
systemctl status firewall-plus
curl -s http://127.0.0.1:8472/api/v1/health
```

Healthy output includes `meta.version` and `data.input_jump_style` (`per-port-dport-v2` on current builds):

```json
{ "success": true, "data": { "input_jump_style": "per-port-dport-v2", ... }, "meta": { "version": "1.0.4" } }
```

Then in the panel: **Admin → Firewall → Nodes → Add Node** — pick the Wings node, set the FQDN (plain HTTP, not HTTPS — see troubleshooting), and paste the bearer token. The panel stores only a bcrypt hash plus the encrypted token.

### Upgrading the node daemon

The node daemon is **not** updated by panel/Blueprint reinstalls. On each Wings host:

```bash
curl -fsSL https://fw-install.xdp.network/node/install.sh | sudo bash   # re-run = upgrade
sudo systemctl restart firewall-plus
curl -s http://127.0.0.1:8472/api/v1/health | jq '{version: .meta.version, input_jump_style: .data.input_jump_style}'
```

The service logs `nodeServiceVersion` at startup, and **Admin → Firewall → Nodes** shows each node's reported version and health.

---

## Post-Install Verification

1. **Scheduler + queue:** confirm `php artisan schedule:run` runs every minute via cron and `systemctl status pteroq` (or your queue worker) is active.
2. **Node online:** Admin → Firewall → Nodes shows the node **ONLINE** (a node is marked offline after 2 failed health checks by default).
3. **Enable on a test server:** Server → Settings → Firewall → enable **Firewall-Plus for this server**, accept the ToS, add a rule, and click **Apply firewall**.
4. **Check the node:** `iptables -L FWP-<serverId> -n -v` and `ipset list fwp-wl-<serverId>` should show your rules.

```bash
# Watch the apply job land on the node
journalctl -u firewall-plus -f
```

---

## Troubleshooting

### "An unexpected error was encountered…" when applying

Pterodactyl's API handler hides real exceptions when `APP_DEBUG=false`. Check `storage/logs/laravel.log` at the same timestamp (search `firewall_plus.apply`). Typical causes: **migrations not run** (`php artisan migrate --force`), a **queue worker not running** (apply returns `202` and sits queued), or a non-JSON-encodable rule value.

### Service provider not registered

If routes 404 or `php artisan list firewall-plus` shows nothing, `FirewallPlusServiceProvider` was not registered. On Blueprint, reinstall the extension; on standalone, re-run `install.sh` and confirm the provider line survived in `config/app.php` (or the panel's provider bootstrap), then `php artisan config:clear`.

### Node version skew — `multiport needs -p tcp`

This error means the **Wings host is running an old node daemon**, not a panel bug. Upgrade the node (see above) and restart `firewall-plus`. Confirm `input_jump_style` reports `per-port-dport-v2`.

### OpenSSL "wrong version number" on node health

The panel is speaking **HTTPS** to the daemon, which serves **plain HTTP** on `:8472`. Wings' daemon URL scheme must not be copied to Firewall-Plus. Fix: **Admin → Firewall → Nodes → Edit FQDN** → answer **Cancel** on "Use HTTPS?", or set `FIREWALL_PLUS_NODE_USE_SSL=false` in `.env` for newly added nodes. Existing node rows keep their stored `use_ssl` flag until edited.

### Applies time out with empty stderr (Docker on the same host)

If `docker info` reports `Firewall Backend: iptables`, Docker and Firewall-Plus contend for the same `iptables-nft-restore` serialization. Symptoms: `FWP iptables-restore starting` then silence until `ERR_COMMAND_FAILED` (~120s), and a stuck `iptables-nft-restore -w 5 --noflush --table filter` in `ps`. Mitigations, in order of safety:

1. Avoid mass `docker compose up` / image pulls during applies; retry when the host is quiet.
2. Raise the restore timeout in the systemd unit: `Environment=FWP_IPTABLES_RESTORE_TIMEOUT_MS=300000` (clamped 10s–600s). Symptom relief only.
3. Prove it: stop Docker briefly in a maintenance window and run one apply.
4. Last resort (expert): Docker daemon `"iptables": false` — breaks default bridge NAT unless you replace it. Do not do this in production without a networking plan.

Use `iptables-nft-save -t filter | grep FWP` to inspect rules when legacy `iptables` prints *Incompatible with this kernel*.

### Node refuses to start with an empty whitelist

By design: a daemon bound to a non-loopback address with an empty `allowedIps` refuses to start — any reachable host could otherwise drive your iptables. Either bind to `127.0.0.1`, add your panel's IP/CIDR to `allowedIps`, or set `allowEmptyWhitelist: true` only if you know exactly why.

---

## Uninstall

Follow the full rollback runbook — in short:

```bash
# 1. Flush all managed chains on online nodes
php artisan firewall-plus:emergency-flush --all-nodes --confirm

# 2. On each node
sudo bash /opt/firewall-plus/uninstall.sh    # or node-service/uninstall.sh from the repo

# 3. Panel
blueprint -remove pterodactylfirewallplus    # Blueprint
# or: sudo bash standalone/uninstall.sh      # standalone
```

Verify nodes are clean: `iptables -L -n | grep FWP` and `ipset list | grep fwp` should return nothing. Dropping the firewall tables is a separate, destructive step — see the project's `docs/ROLLBACK.md`.
