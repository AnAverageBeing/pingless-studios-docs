---
title: CLI Reference
description: Firewall-Plus artisan commands (firewall-plus:*) and node-service scripts.
---

# CLI Reference

## Artisan Commands (panel)

Run from the panel directory (`cd /var/www/pterodactyl`). All commands are registered by the Firewall-Plus service provider.

### `firewall-plus:sync-nodes`

```bash
php artisan firewall-plus:sync-nodes
```

Health-checks every registered node (ONLINE/OFFLINE badge, reported version, GeoIP availability). **Runs every minute via the scheduler.** When a node returns to ONLINE, a reconcile is dispatched automatically.

### `firewall-plus:reconcile`

```bash
php artisan firewall-plus:reconcile
php artisan firewall-plus:reconcile --node=3
```

Compares desired state (panel DB) against node state and repairs drift. Runs every 15 minutes scheduled; use `--node=` to reconcile a single node after manual intervention.

### `firewall-plus:cleanup-orphans`

```bash
php artisan firewall-plus:cleanup-orphans
```

Removes orphaned profiles/rules — servers deleted or transferred while their node was offline. Runs every 30 minutes scheduled.

### `firewall-plus:sync-integrity`

```bash
php artisan firewall-plus:sync-integrity
```

Verifies sync-state integrity across profiles (`pending → syncing → synced / failed / orphaned`) and repairs inconsistent rows.

### `firewall-plus:process-cleanups`

```bash
php artisan firewall-plus:process-cleanups
```

Processes pending cleanup tasks queued by lifecycle events (server deletion, node transfer, allocation changes). Visible in **Admin → Firewall → Operations**.

### `firewall-plus:emergency-flush`

```bash
php artisan firewall-plus:emergency-flush --all-nodes --confirm
```

Flushes **all** Firewall-Plus chains and ipsets on all online nodes. Requires `--confirm`. This is the big red button — pair it with Emergency mode (below) so users don't immediately re-queue applies.

### `firewall-plus:prune-audit-logs`

```bash
php artisan firewall-plus:prune-audit-logs
php artisan firewall-plus:prune-audit-logs --days=60
```

Deletes audit log entries older than the retention window (default 90 days, configurable via the `audit_retention_days` admin setting). Runs daily at 03:15 scheduled.

### `firewall-plus:prune-queue`

```bash
php artisan firewall-plus:prune-queue
php artisan firewall-plus:prune-queue --days=14
```

Deletes firewall queue entries older than N days (default 7) — keeps `firewall_queue_entries` from growing unbounded on busy panels. Stuck entries are also reset automatically by the `ResetStuckFirewallQueueJob`.

---

## Scheduler Overview

Requires the standard panel cron: `* * * * * php /var/www/pterodactyl/artisan schedule:run`.

| Interval | Job / Command |
|----------|---------------|
| Every minute | `firewall-plus:sync-nodes` |
| Every 2 minutes | `SyncSmartEventsJob` (node SMART events → panel) |
| Every 15 minutes | `firewall-plus:reconcile` |
| Every 30 minutes | `firewall-plus:cleanup-orphans` |
| Daily 03:15 | `firewall-plus:prune-audit-logs` |

Applies themselves are queue jobs (`ApplyFirewallRulesJob`) — you also need a queue worker (`pteroq` service or `php artisan queue:work`).

---

## Emergency Operations

The full incident procedure, available from **Admin → Firewall → Emergency** or the CLI:

1. **Freeze user changes** — enable **Emergency mode** (admin UI, or set `firewall_admin_settings.emergency_mode = 1`). All client mutations and queued applies are blocked while it's on.
2. **Flush everything** — emergency flush button or `php artisan firewall-plus:emergency-flush --all-nodes --confirm`.
3. **Surgical option** — disable specific rule types fleet-wide from the Emergency page instead of a full flush.
4. **Fleet lockdown (optional)** — disable Firewall fleet access to block API mutations until re-enabled.

Verify nodes are clean afterward:

```bash
iptables-nft -L -n 2>/dev/null | grep FWP || iptables -L -n | grep FWP || echo "no FWP chains"
ipset list | grep fwp || echo "no fwp ipsets"
```

---

## Node Scripts

Shipped in `node-service/scripts/` — run on the Wings host.

### `diagnose-fwp.sh`

```bash
sudo bash /opt/firewall-plus/scripts/diagnose-fwp.sh
```

Collects a diagnostic bundle: service status, recent journal, detected iptables binaries, FWP chain/ipset presence, config sanity. First thing to run (and attach) when applies misbehave.

### `test-queue.mjs`

```bash
export FWP_SKIP_IPTABLES=1 FWP_TEST_TOKEN=<64-hex>
node scripts/test-queue.mjs
```

Smoke-tests the node apply queue end-to-end without touching iptables.

### `load-test-apply.mjs`

```bash
export FWP_SKIP_IPTABLES=1 FWP_TEST_TOKEN=<64-hex>
node scripts/load-test-apply.mjs --concurrency 100
```

Hammers the apply endpoint with concurrent requests — validates queue backpressure and rate limiting. Target: the queue accepts all applies without errors.

### `soak-monitor.mjs`

```bash
node scripts/soak-monitor.mjs --hours 1 --interval 60
```

Watches daemon memory/health over time. Target: RSS stable under 100 MB over a 72h soak.

---

## Useful One-Liners

```bash
# Trace a single apply across the node by correlation ID
journalctl -u firewall-plus | grep '<correlation-uuid>'

# Live rules for one server
iptables -L FWP-<serverId> -n -v

# Which iptables backend the daemon would use
which iptables-nft iptables-nft-restore

# Node version + jump style (detect version skew)
curl -s http://127.0.0.1:8472/api/v1/health | jq '{version: .meta.version, input_jump_style: .data.input_jump_style}'
```
