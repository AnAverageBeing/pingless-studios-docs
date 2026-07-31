---
title: FAQ
description: Frequently asked questions about Firewall-Plus for Pterodactyl — panel vs node responsibilities, SMART detection, applies, and common gotchas.
---

# Frequently Asked Questions

## General

### What's the difference between the panel extension and the node service?

The **panel extension** (Blueprint addon or standalone) owns all state: rules, lists, presets, grants, audit logs, SMART events, and the UI. The **node service** is a small Fastify daemon on each Wings host (default port `8472`) that receives apply payloads and turns them into atomic iptables/ipset changes, runs drift verification, and executes the SMART detection loop. They are versioned and upgraded independently — reinstalling the panel extension never touches your nodes.

### Blueprint or standalone — which should I use?

Blueprint if you already run (or can run) the Blueprint framework — installs, updates, and removals are one command. Standalone if you want zero framework dependencies; the `install.sh`/`uninstall.sh` scripts merge the same files manually. Feature set is identical. See the [comparison table](../index#blueprint-vs-standalone).

### Does Firewall-Plus touch rules it didn't create?

No. It manages only its own chains (`FWP-*`) and ipsets (`fwp-*`), and every rule it inserts is comment-tagged for idempotency. Unmanaged rules are never modified or deleted.

### What firewall backends are supported?

iptables and ipset. On modern Debian/Ubuntu hosts the daemon auto-detects and prefers the nft-backed binaries (`iptables-nft`, `iptables-nft-restore`). You can force binaries with `FWP_IPTABLES_BIN` and friends — see the [Configuration Reference](../configuration/reference#node-environment-variables).

## Rules & Applies

### I clicked Apply and nothing happened.

The apply is a queued job. Check, in order: (1) the queue worker is running (`systemctl status pteroq` or `php artisan queue:work`), (2) the node is ONLINE in Admin → Firewall → Nodes, (3) `storage/logs/laravel.log` for the real exception if the UI shows a generic error, (4) `journalctl -u firewall-plus` on the node.

### Why is `connection_timeout` missing from the rule picker?

It's a legacy type: the API still accepts it for old rows, but the node intentionally emits no rules for it, and the panel UI no longer offers it. Existing rows are harmless no-ops.

### Why does `geo_filter` fail or get rejected?

`geo_filter` requires a MaxMind GeoLite2 database (`.mmdb`) on the node. Set `geoipDbPath` in `/etc/firewall-plus/config.json` and place the file there yourself — GeoLite2 is licensed and is **not** redistributed with Firewall-Plus. Enabling a geo rule without a DB is rejected rather than silently ignored. Admin → Nodes shows GeoIP availability from the last health check.

### How do whitelist/blacklist changes get to the node?

List mutations automatically queue an apply job; the node syncs the `fwp-wl-<server>` / `fwp-bl-<server>` ipsets as part of the same atomic apply.

## SMART Detection

### SMART tab is visible but the toggle won't stay on.

SMART requires an admin grant. Admin → **Firewall → Servers** → grant SMART mode for that server, then the owner can enable it in the SMART tab and re-apply.

### Who gets notified on an attack, and how?

The server owner gets a **Discord webhook** message (if they configured one in the SMART tab) and an **email alert** (if the admin enabled `smart_owner_email_enabled` in settings). The admin Discord webhook (settings → `webhook_url`) receives events too. Events also land in the attack event log and can be acknowledged from the client UI or the admin Activity page; the admin Servers index shows an "under mitigation" badge while a mitigation is active.

### Can I clear a mitigation manually?

Yes — on the node: `DELETE /api/v1/smart/mitigation/{serverId}` with the node bearer token. See the [API Reference](../user-guide/api#smart-endpoints).

## Operations

### What cron/queue setup is required?

Two things, both standard Pterodactyl: the scheduler cron (`* * * * * php /var/www/pterodactyl/artisan schedule:run`) and a queue worker. The scheduler drives `firewall-plus:sync-nodes` (every minute), `reconcile` (15 min), `cleanup-orphans` (30 min), SMART event sync (2 min), and daily audit-log pruning.

### How do I stop everything in an emergency?

Admin → **Firewall → Emergency**: enable Emergency mode (blocks all user mutations) and trigger a fleet flush — or from the CLI: `php artisan firewall-plus:emergency-flush --all-nodes --confirm`. You can also disable specific rule types fleet-wide from the same page.

### Is the node daemon safe to expose?

It binds to `127.0.0.1` by default, requires a 64-hex bearer token, enforces an IP whitelist, and rate-limits every route. Keep it on loopback or an internal interface, keep `/etc/firewall-plus/token` at chmod `600`, and terminate TLS at a reverse proxy if you need it — the daemon is intentionally HTTP-only. A public bind with an empty IP whitelist refuses to start unless you explicitly opt out.
