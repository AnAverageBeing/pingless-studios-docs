---
title: Configuration Reference
description: Every Firewall-Plus configuration value — node config.json, FWP_* environment variables, and panel admin settings.
---

# Configuration Reference

Firewall-Plus is configured in three places:

- **Node `config.json`** — `/etc/firewall-plus/config.json` on each Wings host
- **Node environment variables** — `FWP_*`, set in the systemd unit
- **Panel admin settings** — **Admin → Firewall → Settings** (stored in the panel database)

---

## Node `config.json`

Path: `/etc/firewall-plus/config.json` (override with `FWP_CONFIG`). Validated with a strict schema at startup — the service refuses to boot on invalid values.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `panelUrl` | string (URL) | — | URL of your Pterodactyl panel. Informational/identification use by the daemon. |
| `apiEndpoint` | string | — | **Legacy alias** for `panelUrl`. Use `panelUrl` going forward. |
| `listenAddress` | string | `127.0.0.1` | Bind address. Keep loopback or an internal interface in production — never `0.0.0.0` without a populated `allowedIps`. |
| `listenPort` | int 1024–65535 | `8472` | Bind port for the REST API. |
| `allowedIps` | string[] | `[]` | IP/CIDR whitelist (IPv4 and IPv6) allowed to call protected routes. Your panel's egress IP must be in here when binding beyond loopback. |
| `trustProxy` | bool | `false` | Set `true` **only** behind a trusted reverse proxy (nginx/caddy). When `false`, the direct peer IP is used, so the whitelist can't be bypassed with a spoofed `X-Forwarded-For`. |
| `allowEmptyWhitelist` | bool | `false` | Escape hatch for a non-loopback bind with an empty `allowedIps`. Without it, that combination **refuses to start** — any reachable host could otherwise drive iptables. |
| `logLevel` | `debug`/`info`/`warn`/`error` | `info` | Log verbosity (journald via systemd). |
| `version` | string | `1.0.0` | Reported in health `meta.version`. Managed by the installer — don't hand-edit. |
| `geoipDbPath` | string | — | Path to a MaxMind GeoLite2 Country/City `.mmdb`. When set and the file exists, the node reports GeoIP available and `geo_filter` rules become usable. The DB is licensed and not shipped — download it yourself per MaxMind's terms. |

Example:

```json
{
  "panelUrl": "https://panel.example.com",
  "listenAddress": "127.0.0.1",
  "listenPort": 8472,
  "allowedIps": ["10.0.0.5/32"],
  "trustProxy": false,
  "logLevel": "info",
  "geoipDbPath": "/etc/firewall-plus/GeoLite2-Country.mmdb"
}
```

The bearer token is **not** in this file — it lives at `/etc/firewall-plus/token` (64 hex chars, chmod `600`; path overridable with `FWP_TOKEN`).

::: info TLS
The daemon is intentionally **HTTP-only**. If you need encryption between panel and node, terminate TLS at a reverse proxy on the node and set `trustProxy: true`. Do not point the panel at `https://` port 8472 directly — that's the "OpenSSL wrong version number" failure.
:::

---

## Node Environment Variables

Set in `/etc/systemd/system/firewall-plus.service` (`Environment=` lines), then `systemctl daemon-reload && systemctl restart firewall-plus`.

| Variable | Default | Description |
|----------|---------|-------------|
| `FWP_CONFIG` | `/etc/firewall-plus/config.json` | Config file path. |
| `FWP_TOKEN` | `/etc/firewall-plus/token` | Bearer token file path. Must contain exactly 64 hex characters. |
| `FWP_STATE_DIR` | `/var/lib/firewall-plus` | State directory (server configs, snapshots, queue state). |
| `FWP_LOG_LEVEL` | from config | Overrides `logLevel`. |
| `FWP_SKIP_IPTABLES` | unset | Dev mode: when `1`, skips all snapshot/restore/iptables work — config is still written to disk and the queue flows normally. Used by the test scripts. |
| `FWP_IPTABLES_BIN` | auto-detect | Force the iptables binary, e.g. `/usr/sbin/iptables-nft`. The daemon auto-prefers the nft-backed binaries when present. |
| `FWP_IPTABLES_SAVE_BIN` | auto-detect | Force the save binary, e.g. `/usr/sbin/iptables-nft-save`. |
| `FWP_IPTABLES_RESTORE_BIN` | auto-detect | Force the restore binary, e.g. `/usr/sbin/iptables-nft-restore`. |
| `FWP_IPTABLES_RESTORE_TIMEOUT_MS` | `120000` | Max wait for a single `iptables-restore`, clamped to 10s–600s. Raise only to ride out netfilter contention (e.g. Docker on the same host) — it doesn't remove the contention. |
| `FWP_IPSET_BIN` | auto-detect | Force the ipset binary. |
| `FWP_CHAIN_RE` | built-in | Override the regex used to recognize Firewall-Plus chains (`FWP-*`). Drift checker and inspector. Almost never needed. |
| `FWP_CONNTRACK_PATH` | auto-detect | Path to conntrack data for SMART metrics. Only touch on exotic kernels. |
| `FWP_METRICS_TICK_MS` | built-in | Metrics collection tick interval. Lower = finer charts, more CPU. |
| `FWP_TEST_TOKEN` | — | Test scripts only: token used by `load-test-apply.mjs` / `test-queue.mjs`. |

---

## Panel Admin Settings

**Admin → Firewall → Settings.** Stored in `firewall_admin_settings`; changes take effect immediately.

### Limits

| Setting | Description |
|---------|-------------|
| `max_rules_per_server` | Maximum firewall rules a single server may have. Enforced by the LimitChecker on create. |
| `max_whitelist_entries` | Maximum whitelist entries per server. |
| `max_blacklist_entries` | Maximum blacklist entries per server. |
| `max_abusedb_saved_lookups` | Maximum saved AbuseIPDB lookups retained per server. |

### Nodes

| Setting | Description |
|---------|-------------|
| `node_ping_interval_seconds` | How often the panel health-checks each node. |
| `node_offline_fail_threshold` | Failed health checks before a node is marked OFFLINE (default **2**). When a node returns ONLINE, a reconcile is dispatched automatically. |
| `node_offline_webhook_max` | Maximum offline notifications sent per node incident — prevents webhook spam during flapping. |

### Notifications & AbuseIPDB

| Setting | Description |
|---------|-------------|
| `webhook_url` | Admin Discord webhook for firewall events (applies, node incidents, SMART attacks). See [Webhooks & Alerts](../user-guide/webhooks). |
| `abusedb_enabled` | Master switch for the AbuseIPDB client tab and API. |
| `audit_retention_days` | Days of audit history kept; pruned daily by `firewall-plus:prune-audit-logs` (default 90). |
| `tos_text` | Terms-of-Service text users must accept before any firewall mutation. Supports markdown. |
| `log_level` | Panel-side firewall log verbosity. |

### SMART detection

| Setting | Description |
|---------|-------------|
| `smart_alpha` | EWMA smoothing factor (0–1). Higher reacts faster, noisier. |
| `smart_anomaly_multiplier` | How many multiples over the EWMA baseline counts as an anomaly. Lower = more sensitive. |
| `smart_warmup_samples` | Samples collected before detection arms — avoids false positives on fresh servers. |
| `smart_rate_limit` | Rate cap applied by SMART mitigations. |
| `smart_owner_email_enabled` | When on, server **owners receive email alerts** for SMART attack events (panel mailable), in addition to their per-server Discord webhook. Off = Discord-only. |

### Global toggles

The settings page also carries the **global enable switch** (master off switch for the whole addon) and the **fleet access** toggle; the **Emergency** page holds `emergency_mode` (blocks all user mutations) and per-rule-type fleet disables. See the runbook-style procedures on the [CLI page](../user-guide/cli#emergency-operations).

::: warning Common mistakes
- Changing `listenPort`/`listenAddress` on the node without updating the node's FQDN/port in **Admin → Firewall → Nodes** — health checks start failing silently.
- Setting `trustProxy: true` without an actual proxy — the IP whitelist becomes spoofable.
- Copying the Wings daemon URL scheme (HTTPS) onto the Firewall-Plus node FQDN — the daemon speaks plain HTTP.
:::
