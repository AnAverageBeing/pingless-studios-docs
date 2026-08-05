# Config Values in Plain Language

Everything lives in `/etc/openshield/openshield.yaml`. After editing, run:

```bash
sudo openshield reload
```

Most values apply instantly ("runtime-safe"). A few — marked 🔒 in the [full reference](/openshield-xdp/configuration/reference) — need `sudo openshield unload && sudo openshield load`.

You almost never need to edit most of this file. The preset you picked at install time already tuned the numbers. This page explains what each group does so you can make **one informed change** instead of guessing.

## Rate limits (`static.*_threshold`)

How much traffic a single IP may send before it starts gaining suspicion points. Defaults shown are the code defaults — your preset likely set different values.

| Key | Default | Plain meaning | When to touch it |
|-----|---------|---------------|------------------|
| `pps_threshold` | 850 | Total packets/s one IP may send | Almost never — presets cover this |
| `bps_threshold` | 8,912,896 | Bytes/s one IP may send (~8.5 MB/s) | Raise if legit single clients download faster than this |
| `tcp_pps_threshold` | 680 | TCP packets/s per IP | Rarely |
| `udp_pps_threshold` | 425 | UDP packets/s per IP | Raise slightly for UDP-heavy services (voice, some games) |
| `icmp_pps_threshold` | 85 | Ping packets/s per IP | Rarely — 85/s is already generous |
| `syn_pps_threshold` | 170 | New TCP connections/s per IP | Raise for legit high-connection services (busy APIs, proxies) |

::: tip Legit TCP clients are exempt
Since v2.0.0, an IP that completed a real TCP connection is exempt from `pps_threshold`, `bps_threshold`, and `tcp_pps_threshold` scoring (see `ct_established_exempt` below). These limits mostly matter for unproven sources now.
:::

## Scoring (`static.*_score`, `suspicion_*`)

When a limit above is exceeded, the IP gains points. At `suspicion_threshold` (default **100**) it's banned for `ban_duration` seconds (default **3600** = 1 hour).

| Key | Default | Plain meaning |
|-----|---------|---------------|
| `pps_score` / `bps_score` | 20 | Points per second spent over the PPS/BPS limit |
| `tcp_pps_score` / `udp_pps_score` | 15 | Points for TCP/UDP limit violations |
| `icmp_pps_score` | 25 | Points for ICMP violations |
| `syn_pps_score` | 30 | Points for SYN violations (floods are taken more seriously) |
| `suspicion_decay` | 0.5 | How much of the score is kept each second (0.5 = half fades away) |

**When to touch:** basically never by hand. If bans feel too slow or too eager, rerun `sudo openshield reconfigure` and pick a stricter or more relaxed preset instead — presets tune all scores together so they stay coherent. (v2.1.1 retuned preset scoring so single-source floods that were mathematically unbannable on Gaming/Hosting/Performance/CDN now get banned in seconds.)

Repeat offenders get escalating bans automatically (the "star system"): each re-offense multiplies `ban_duration` per `star_duration_multiplicators` (`[1,2,4,8,16,32]`).

## Connection tracking (`static.enable_connection_tracking`, `ct_*`)

OpenShield watches TCP handshakes so it can tell "real client" from "blind junk packets".

| Key | Default | Plain meaning | When to touch it |
|-----|---------|---------------|------------------|
| `enable_connection_tracking` | `true` | Drop blind SYN-ACK/RST packets (no prior SYN seen) | Turn off only on asymmetric routing |
| `ct_syn_timeout_sec` | 300 | How long a connection stays "proven" after its SYN | Keep ≥ your app's keepalive interval |
| `ct_server_port_max` | 32768 | Only connections to ports ≤ this are tracked | Keep default; `0` tracks all ports and breaks outbound traffic (apt, curl) |
| `ct_established_exempt` | `true` | **Sources with a proven TCP session are exempt from PPS/BPS/TCP scoring** | Leave on. This is the fix for "I get banned uploading files" |

The exemption is the important one. A source proves itself by sending a real data segment within `ct_syn_timeout_sec` of its SYN — something SFTP, backups, and every normal client do automatically, and spoofed floods can't. Exempt sources are still subject to SYN-rate, connection-rate, and UDP/ICMP scoring, and to the attack-mode caps. It works even if `enable_connection_tracking` is `false`.

## Port overrides (`static.port_thresholds`)

For a port (or range) that legitimately exceeds your global limits — think backup agents, media streaming, a busy game port — you can give it its own limits. **Max 8 entries.** These replace the global PPS/BPS limits for traffic to those ports, in peacetime *and* during attack mode.

```yaml
static:
  port_thresholds:
    - ports: "25565"          # single port
      pps_threshold: 5000
      bps_threshold: 52428800 # 50 MB/s
    - ports: "8000-9000"      # a range
      pps_threshold: 3000
      bps_threshold: 0        # 0 = inherit the global value
```

**When to touch:** only when you see legit traffic to a specific port getting scored/banned and the established-connection exemption doesn't cover it (e.g. pure-UDP services).

## Attack mode (`dynamic.*`)

Attack mode is declared when global traffic spikes far above your learned baseline (`spike_percentage`, default 200 = 3× baseline) for `attack_trigger_time` seconds (default 3), and clears after it settles.

| Key | Default | Plain meaning | When to touch it |
|-----|---------|---------------|------------------|
| `attack_threshold_multiplier` | 0.5 | During an attack, all per-IP thresholds are multiplied by this (0.5 = halved) | Raise toward 0.7–0.75 if legit users get banned mid-attack on busy nodes |
| `attack_per_ip_pps` | 1000 | Hard per-source PPS cap while an attack is active (0 = off) | Rarely — preset tunes it |
| `attack_port_pps` | 10000 | **Aggregate PPS cap per destination port during attacks** (0 = off) | Set above your busiest legit port's normal rate |
| `attack_min_pps` / `attack_min_bps` | 1000 / 1 MB/s | Absolute floors so a busy-but-normal server never enters attack mode | Raise if your normal load trips attack mode |
| `attack_trigger_time` | 3 | Consecutive spike seconds before attack mode declares | Rarely |
| `attack_max_duration` | 300 | Hard cap on attack-mode seconds (0 = no cap) | Rarely |
| `new_source_limit` | 100 | New unique IPs/s before new-source flood handling engages | Lower on small servers, raise on CDN-like nodes |
| `new_source_ban_duration` | 30 | **Each excess new source is temp-banned for this many seconds** | Raise (300–600) if rotation floods keep cycling back |

::: warning v2.0 change: new sources get banned, not just dropped
Before v2.0, exceeding `new_source_limit` dropped a single packet per new source — useless against rotating floods. Now each excess new source is **temp-banned** for `new_source_ban_duration` seconds, so a rotating flood burns through its IP pool instead of walking through.
:::

The per-port cap deserves emphasis: a spoofed flood can rotate source IPs but **not the port it attacks**. Capping the port's total rate throttles the flood no matter how many fake IPs it uses. Legit traffic on that port is throttled (not banned) until the attack clears.

## Behavior engine (`behavior.*`)

| Key | Default | Plain meaning | When to touch it |
|-----|---------|---------------|------------------|
| `behavior.enabled` | `true` | Master switch: learns per-port baselines, flags lookalike bot clusters | Leave on |
| `behavior.auto_block` | `true` (since v2.1.0) | Auto-ban cluster members for 1h at ≥85% confidence | Set `false` for report-only mode while you build trust |

Review clusters in the TUI behavior tab or with `sudo openshield behavior`. Note the engine **freezes learning while an attack is declared** — it mainly catches slow-burn botnets between floods. If you're planning a big legitimate traffic event (launch day), you can pre-emptively pause it:

```bash
sudo openshield schedule suppress auto-block 6h
sudo openshield schedule clear all
```

## Metrics API (`metrics.*`)

Off by default. Serves everything the TUI shows as JSON for your own dashboards.

| Key | Default | Plain meaning |
|-----|---------|---------------|
| `metrics.enabled` | `false` | Turn the HTTP endpoint on |
| `metrics.listen` | `127.0.0.1:9100` | Bind address — keep localhost unless you need remote dashboards |
| `metrics.api_key` | random per install | Bearer token; manage with `openshield key` / `key set` / `key regen` |
| `metrics.rate_limit_per_sec` | 10 | Requests/s per client IP (0 = unlimited) |
| `metrics.whitelist` | `[]` | IP/CIDR allowlist (empty = any IP with the key) |

Full guide: [Metrics API](/openshield-xdp/user-guide/metrics-api).

## Alerts (`alerter.*`)

Discord/Slack webhook notifications for attacks, bans, and floods.

| Key | Default | Plain meaning |
|-----|---------|---------------|
| `alerter.enabled` | `false` | Turn alerts on |
| `alerter.webhook_url` | `""` | Your Discord/Slack webhook URL |
| `alerter.events` | `[]` | Event types to send (empty = all) |
| `alerter.graph_enabled` | `true` | Attach a traffic graph to attack-end alerts |
| `alerter.attack_updates` | `true` | Progress embeds while an attack is ongoing |
| `alerter.show_banned_ips` | `false` | Include banned IPs inline in ban alerts |
| `alerter.geo_breakdown` | `true` | Continent/country split of banned IPs (needs GeoIP db) |

Test with `sudo openshield alert test`. Full format reference: [Alerter](/openshield-xdp/configuration/alerter).

## Whitelist & blacklist (`whitelist.*`, CLI)

```yaml
whitelist:
  enabled: true
  ips: ["203.0.113.10", "198.51.100.0/24"]
```

Whitelisted IPs skip **all** mitigation — rate limits, validation, detection. Whitelist your office IP, monitoring, and upstream proxies. Manage live with the CLI; since v2.0 the commands **persist to the YAML config**, so entries survive loader restarts:

```bash
sudo openshield whitelist add 203.0.113.10     # or: openshield wl add ...
sudo openshield whitelist remove 203.0.113.10
sudo openshield blacklist add 5.6.7.8 3600     # manual ban, seconds
```

::: warning Whitelisting is total
A whitelisted IP can flood you unchecked. Only whitelist infrastructure you control — never player/customer ranges.
:::

## The rest

`validation.*` (malformed-packet filters), `maps.*` (BPF map sizes), `telemetry.*` (TUI polling), `pcap.*` (attack forensics capture), `geoip.*` (country blocking), `reports.*` (daily reports), and `license.*` are covered key-by-key in the [full Configuration Reference](/openshield-xdp/configuration/reference). The defaults are right for almost everyone.
