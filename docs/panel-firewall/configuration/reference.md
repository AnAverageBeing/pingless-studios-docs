---
title: Configuration Reference
description: Every Panel Firewall setting — panel admin settings and the daemon's /etc/panel-firewall/config.json — with types, defaults, and when to change them.
---

# Configuration Reference

Panel Firewall is configured in two places: the **admin UI** (stored in the panel DB, pushed to the daemon on apply) and the daemon's local **`/etc/panel-firewall/config.json`** (written once by the installer — rarely touched afterwards).

::: warning
Settings changed in the admin UI only reach the kernel after **Apply firewall**. The apply payload is the single source of truth — the daemon reloads it on every 5-second tick.
:::

---

## Panel settings (Admin → Panel Firewall → Settings / Firewall)

### Core

| Key | Type | Default | What it does |
|---|---|---|---|
| `daemon_url` | URL | `http://127.0.0.1:8475` | Where the panel reaches the daemon. Must be `http(s)://`, no credentials/query. Change only if the daemon listens elsewhere. |
| `http_port` | int 1–65535 | `80` | Panel HTTP port to protect (jump target for firewall chains). |
| `https_port` | int 1–65535 | `443` | Panel HTTPS port to protect. |
| `preset` | enum | `medium` | Traffic ceiling profile: `low`, `medium`, `high`, `veryHigh`, `underAttack`. See [Protection Layers](../architecture/protection-layers#presets). |
| `global_enabled` | bool | `false` | Master switch. When off, the daemon keeps chains empty (traffic untouched). |
| `smart_enabled` | bool | `false` | Enables the EWMA anomaly detector + L1–L3 auto-mitigation. |
| `smart.alpha` | float 0.001–1 | `0.1` | EWMA smoothing for the metric mean. Higher = reacts faster, noisier. |
| `smart.beta` | float 0.001–1 | `0.05` | EWMA smoothing for the variance estimate. |
| `smart.anomalyDeviation` | float 1–20 | `4` | Anomaly threshold in standard deviations above baseline. Raise if you get false positives. |

### Whitelist / blacklist (Lists page)

| List | Behavior |
|---|---|
| Whitelist (`adminWhitelist`) | CIDRs accepted **before any other rule** — these IPs can never be rate-limited or banned. Add your office/static IP here first. Strict CIDR validation (no `999.1.1.1`, no leading zeros). |
| Permanent blacklist (`permanentBlacklist`) | CIDRs dropped at the top of the chain, before rate limits. |
| Temporary bans | Created by admins, SMART, or the L7 sensor; expire automatically. |

### L7 HTTP flood protection (Settings page)

All keys emit into the apply payload's `l7` block; the daemon sensor reads the web server access log — **no nginx/apache config changes needed**.

| Key | Type | Default | What it does |
|---|---|---|---|
| `l7_enabled` | bool | `false` | Master switch for the access-log sensor. |
| `l7_log_paths` | text, one per line | *(empty)* | Log files to tail. Empty = autodetect: `/var/log/nginx/access.log`, `/var/log/apache2/access.log`, `/var/log/httpd/access_log`, `/var/log/caddy/access.log`. Max 16 paths × 256 chars. |
| `l7_rate_limit_rpm` | int 10–100000 | `600` | Per-IP requests-per-window ceiling. Exceeding it = offense. |
| `l7_window_sec` | int 5–3600 | `60` | Sliding window length in seconds. Offense = `count > rateLimitRpm × windowSec/60`. |
| `l7_ban_duration_sec` | int 60–86400 | `900` | Temp-ban lifetime (15 min default). |
| `l7_exclude_private` | bool | `true` | Never ban private/reserved IPs (10/8, 172.16/12, 192.168/16, loopback, link-local, CGNAT, IPv6 ULA). Keep on if admins use internal IPs. |
| `l7_max_bans_per_minute` | int 1–1000 | `20` | Budget cap so a log flood can't churn the ban ipset. Overflow is counted, not banned. |

### Webhooks

| Field | Notes |
|---|---|
| `url` | **HTTPS only, public IPs only** — DNS is fully resolved and the validated IP is pinned for the request (SSRF/DNS-rebinding protection). Private/loopback/metadata addresses are rejected. |
| `events` | Subset of the event list (see [Webhooks](../user-guide/webhooks)). |
| `secret` | Optional HMAC secret signing webhook payloads. Never exported — export bundles show `[REDACTED]`. |

---

## Daemon config — `/etc/panel-firewall/config.json`

Written by the installer. Re-runs **preserve** it (`PFW_FORCE_CONFIG=1` regenerates). Restart the service after edits: `systemctl restart panel-firewall`.

| Key | Type | Default | What it does / when to change |
|---|---|---|---|
| `listenAddress` | IP/`localhost` | `127.0.0.1` | Bind address. Keep loopback unless the panel is on another host. Must be a valid IP — anything else refuses to start. |
| `listenPort` | int | `8475` | API port. Change if 8475 collides; then update `daemon_url` in the panel. |
| `allowedIps` | CIDR[] | `["127.0.0.1"]` | IP allowlist (layer 1 of auth). Empty + non-loopback bind **refuses to start** unless `allowEmptyAllowlist: true`. |
| `allowEmptyAllowlist` | bool | `false` | Explicit opt-in to run with no IP allowlist. Avoid. |
| `trustProxy` | bool | `false` | Trust `X-Forwarded-For` for `request.ip`. Only enable behind a real reverse proxy — otherwise the allowlist is spoofable. |
| `protectedPorts` | object | `{http: 80, https: 443}` | Ports the firewall chains hook. |
| `confirm.confirmWindowSec` | int 15–300 | `60` | Auto-rollback window after each apply. |
| `confirm.confirmDelaySec` | int 0–60 | `10` | Delay before the confirm button unlocks (gives you time to notice breakage). |
| `security.timestampDriftSec` | int 10–300 | `60` | Max clock skew accepted for HMAC timestamps. |
| `preset` | enum | `medium` | Startup preset (panel apply overrides). |
| `smart` | object | `{enabled:false, alpha:0.1, beta:0.05, anomalyDeviation:4}` | Startup SMART defaults (panel apply overrides). |
| `l7` | object | `{enabled:false, logPaths:[], rateLimitRpm:600, windowSec:60, banDurationSec:900, excludePrivate:true, maxBansPerMinute:20}` | Startup L7 defaults (panel apply overrides). |
| `reconcile` | object | `{enabled:true, intervalSec:60, autoRepair:true}` | Kernel-vs-desired drift checker. |
| `logLevel` | enum | `info` | `debug`/`info`/`warn`/`error`/`fatal`. |
| `devMode.skipIptables` | bool | `false` | Test mode: no kernel mutation. Never use in production. |

## Environment variables

| Var | Purpose |
|---|---|
| `PFW_CONFIG` | Config file path (default `/etc/panel-firewall/config.json`) |
| `PFW_TOKEN` | Token file path (default `/etc/panel-firewall/token`) |
| `PFW_STATE_DIR` | SQLite + checkpoints dir (default `/var/lib/panel-firewall`) |
| `PFW_SKIP_IPTABLES=1` | Dev mode without touching config |
| `PFW_SKIP_EXT_CHECK=1` | Skip the installer's PHP-extension preflight |
| `PFW_SKIP_DAEMON_UNINSTALL=1` | `remove.sh` keeps the daemon installed |

---

## Common mistakes

- **Forgetting Apply after changing settings** — the panel DB is not live state; only an apply pushes config to the kernel.
- **Whitelisting nothing, then tuning aggressively** — add your own IP to the whitelist *before* switching to `high`/`underAttack`.
- **Setting `l7_rate_limit_rpm` too low** — admin panel traffic is bursty (asset loads, websockets). Start at 600+, watch the analytics graph, then tighten.
- **Pointing `daemon_url` at a public interface** — keep the daemon on loopback; its only real barrier on a public bind is the bearer token.
