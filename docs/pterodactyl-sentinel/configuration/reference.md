---
title: Configuration Reference
description: Every Sentinel configuration value — the panel-managed node config tree (general, all 12 detectors, whitelist, rules, intel, limits), alert channels, per-node overrides, and the node-local config.yaml.
---

# Configuration Reference

Sentinel has three layers of configuration:

1. **Panel-managed node config** — the tree documented below. Edited once in **Sentinel → Settings**, versioned, and pushed to every node. This is where all detection behavior lives.
2. **Panel-side settings** — alert channels (Discord/webhook/SMTP) and per-node overrides. These live only in the panel database and are **never** sent to nodes.
3. **Node-local `/etc/sentinel/config.yaml`** — written once by `install.sh`; holds only connectivity settings (panel URL, token file, API listen, paths).

::: warning
Do not hand-edit detection settings on the node. The agent persists the last panel-pushed config under `/var/lib/sentinel` and re-applies it on boot; local edits to detection knobs are overwritten on the next config sync. Make changes in the panel.
:::

How values reach a node: on every save the panel increments `config_version` and pushes the full tree (`POST /api/v1/config`); a node whose heartbeat reports a stale version pulls `GET /api/sentinel/node/config`. Apply is atomic — the node validates the whole tree, writes a temp file, renames it into place, and reloads. A config that fails validation is rejected entirely; the last-known-good config keeps running.

---

## general

Top-level engine behavior.

| YAML path | Type | Default | What it does |
| --- | --- | --- | --- |
| `general.scan_interval_seconds` | int | `5` | Seconds between detection ticks. Each tick takes one shared system snapshot (processes, per-netns connections) that all fast detectors consume. Range 1–3600. |
| `general.cooldown_seconds` | int | `300` | Per-event dedup window. An identical detection (same detector + target) is suppressed for this long so one miner does not produce an event every tick. `0` disables dedup. |
| `general.dry_run` | bool | `true` | Global safe mode. Detections are logged and reported to the panel, but no local action runs; events carry `dry_run: true` and empty `actions_taken`. Panel-side suspension is also suppressed. |
| `general.log_level` | string | `info` | Agent log verbosity: `debug`, `info`, `warn`, `error`. |

**When to change.** Lower `scan_interval_seconds` only if you need faster reaction — 5 s is already aggressive and each tick is cheap. Raise `cooldown_seconds` on noisy nodes; lower it while testing so repeat detections re-fire quickly.

**Common mistakes.** Disabling dry-run before reviewing what the rules would do; setting `log_level: debug` in production and filling the journal with per-tick detail; setting `cooldown_seconds: 0` and drowning the panel in duplicate events (the `limits.max_events_per_minute` cap will then drop events).

---

## detectors

Each detector has an `enabled` switch plus its own knobs. Defaults below come from the agent's built-in defaults (`internal/config/defaults.go`); the panel settings form exposes the same tree, and any knob the panel does not render keeps its built-in value via deep-merge.

### detectors.miner

Cryptominer detection via process signatures, CPU heuristics and pool connections. Category: `miner`.

| YAML path | Type | Default | What it does |
| --- | --- | --- | --- |
| `detectors.miner.enabled` | bool | `true` | Master switch. |
| `detectors.miner.cpu_threshold` | int | `85` | CPU percent (single-core scale; up to `100 * 64`) a process must sustain to be flagged by the heuristic. |
| `detectors.miner.sustained_seconds` | int | `45` | How long CPU must stay above the threshold before the heuristic fires. |
| `detectors.miner.known_processes` | list | 23 names | Known mining binaries: `xmrig`, `minerd`, `cpuminer`, `cpuminer-avx2`, `ccminer`, `ethminer`, `cgminer`, `bfgminer`, `nbminer`, `t-rex`, `trex`, `phoenixminer`, `lolminer`, `gminer`, `nanominer`, `xmr-stak`, `teamredminer`, `srbminer`, `wildrig`, `verusminer`, `kawpowminer`, `miniz`, `rigel`. Match → high severity. |
| `detectors.miner.pool_ports` | int list | `3333 4444 5555 7777 8888 9999 14433 14444 20580 45560 45700` | TCP ports commonly used by mining pools. An outbound connection to one → high-severity "connection to mining pool port". |
| `detectors.miner.whitelist_processes` | list | game-server binaries | Processes exempt from CPU/connection heuristics (signatures still apply): `java`, `bedrock_server`, `srcds_linux`, `srcds_run`, `hlds_linux`, `hlds_run`, `arma3server`, `arma3server_x64`, `rustdedicated`, `factorio`, `terraria-server`, `tshock`, `fivem`, `altv-server`, `samp03svr`, `mta-server`, `ragemp`, `ragemp-server`, `unturned`, `unturned_headless`, `vrising-server`, `valheim_server`, `valheim_server.x86_64`, `cs2`, `csgo`, `dota2`, `tf2`, `gmod`. |

Severity escalation: sustained high CPU → medium; known miner binary or deleted-binary masked process → high; mining argument flags in the cmdline (stratum URLs, `--donate-level`, `--coin`, `--randomx`, `--algo`, `--nicehash`) → critical.

**When to change.** Add new miner names or pool ports as you encounter them. Do not lower `cpu_threshold` below ~70 — busy game servers will false-positive (they are whitelisted, but custom eggs may not be).

### detectors.portscan

Outbound network scanning from host or containers. Category: `portscan`.

| YAML path | Type | Default | What it does |
| --- | --- | --- | --- |
| `detectors.portscan.enabled` | bool | `true` | Master switch. |
| `detectors.portscan.distinct_ports` | int | `100` | Distinct destination ports within the window that indicate a scan. |
| `detectors.portscan.distinct_hosts` | int | `50` | Distinct destination hosts within the window that indicate a scan. |
| `detectors.portscan.window_seconds` | int | `15` | Sliding window for the distinct-port/host counts. |
| `detectors.portscan.known_scanners` | list | `nmap masscan zmap unicornscan hping3 naabu rustscan` | Process names that are flagged immediately regardless of counts. |

Severity: medium at threshold, high when well past it. The default rule is alert-only — port scanning is reconnaissance, not damage.

### detectors.ddos

Outbound flood/stress activity. Category: `ddos`.

| YAML path | Type | Default | What it does |
| --- | --- | --- | --- |
| `detectors.ddos.enabled` | bool | `true` | Master switch. |
| `detectors.ddos.pps_threshold` | int | `60000` | Packets-per-second from one container that indicate a flood. |
| `detectors.ddos.bps_threshold` | int | `125000000` | Bits-per-second (~1 Gbit/s) from one container that indicate a flood. |
| `detectors.ddos.conn_threshold` | int | `1500` | Concurrent outbound connections from one container that indicate a connection flood. |
| `detectors.ddos.known_tools` | list | 15 names | Stress-tool binaries, matched on word boundaries: `hping3`, `t50`, `mhddos`, `ufonet`, `slowloris`, `goldeneye`, `torshammer`, `xerxes`, `ipstresser`, `raven-storm`, `pyflood`, `hoic`, `loic`, `xoic`, `hulkattack`. |
| `detectors.ddos.whitelist_processes` | list | game-server binaries | Same game-server list as the miner detector — legit game traffic is exempt from rate heuristics. |

All flood detections are high severity. The default rule pauses the container and suspends the server.

**Common mistakes.** Dropping `pps_threshold` to catch small floods — game servers (especially Rust, FiveM, Minecraft proxies) can burst hard; tune down gradually with dry-run on.

### detectors.zipbomb

Archive bombs being uploaded or extracted in server volumes. Category: `zipbomb`.

| YAML path | Type | Default | What it does |
| --- | --- | --- | --- |
| `detectors.zipbomb.enabled` | bool | `true` | Master switch. |
| `detectors.zipbomb.scan_paths` | list | `/var/lib/pterodactyl/volumes` | Roots swept for suspicious archives. |
| `detectors.zipbomb.ratio_threshold` | int | `150` | Uncompressed:compressed size ratio that flags an archive. |
| `detectors.zipbomb.max_uncompressed_mb` | int | `51200` | Absolute uncompressed size (50 GiB) that flags an archive regardless of ratio. |
| `detectors.zipbomb.full_scan_interval_minutes` | int | `30` | Minutes between full volume sweeps. |
| `detectors.zipbomb.sweep_max_seconds` | int | `300` | Time budget for one sweep. |
| `detectors.zipbomb.inspect_timeout_seconds` | int | `5` | Per-archive inspection timeout. |
| `detectors.zipbomb.workers` | int | `4` | Parallel archive inspectors. |
| `detectors.zipbomb.hot_trigger` | bool | `true` | Enable the reactive trigger: a container writing hot gets its new archives inspected immediately. |
| `detectors.zipbomb.hot_cpu_percent` | int | `80` | CPU percent component of the hot trigger. |
| `detectors.zipbomb.hot_write_mbps` | int | `25` | Disk write MB/s component of the hot trigger. |

Severity: medium at the ratio threshold, high for extreme ratios/sizes. Default rule quarantines the file from medium up.

### detectors.exploit

Privilege escalation, container escapes and reverse shells. Category: `exploit`.

| YAML path | Type | Default | What it does |
| --- | --- | --- | --- |
| `detectors.exploit.enabled` | bool | `true` | Master switch. |
| `detectors.exploit.watch_paths` | list | `/tmp /dev/shm /var/tmp` | World-writable scratch dirs watched for executions and setuid drops. |
| `detectors.exploit.suspicious_procs` | list | `dirtycow dirtypipe pwnkit linpeas linenum les.sh unix-privesc-check exploit nsenter deepce` | Privesc/escape tools and enumeration scripts. `runc` is deliberately absent — it spawns every container; escape attempts are caught by the `nsenter --target 1` cmdline pattern instead. |
| `detectors.exploit.flag_reverse_shell` | bool | `true` | Flag shell processes whose stdio is attached to a socket. |
| `detectors.exploit.flag_privesc` | bool | `true` | Flag privilege-boundary crossings (unexpected uid/capability gains). |
| `detectors.exploit.max_setuid_walk_size` | int | `200000` | Byte budget for the setuid walk in watched paths. |

Severity: privesc tools and reverse shells → high; container-escape patterns (`nsenter --target 1`) → critical; execution from a scratch dir → medium.

### detectors.abuse

Hosting-abuse services: tor, proxies, VPNs, tunnels, mailers, IRC. Category: `abuse`.

| YAML path | Type | Default | What it does |
| --- | --- | --- | --- |
| `detectors.abuse.enabled` | bool | `true` | Master switch. |
| `detectors.abuse.known_processes` | list | 31 names | `tor`, `torrc`, `openvpn`, `wireguard`, `softether`, `shadowsocks`, `ss-server`, `ss-local`, `v2ray`, `xray`, `trojan`, `trojan-go`, `hysteria`, `hysteria2`, `sing-box`, `cloudflared`, `frpc`, `frps`, `ngrok`, `localtunnel`, `pagekite`, `pyload`, `sendmail`, `postfix`, `exim4`, `exim`, `dovecot`, `rspamd`, `amavis`, `iredapd`, `znc`, `eggdrop`. |
| `detectors.abuse.known_cmd_patterns` | list | 16 fragments | Cmdline fragments: `--torrc-file`, `--socksport`, `--orport`, `--dirport`, `--socks-port`, `--or-port`, `--dir-port`, `ss-server`, `ss-local`, `-c /etc/tor`, `-f /etc/tor`, `/etc/openvpn`, `/etc/wireguard`, `--protocol trojan`, `--protocol vmess`, `--protocol vless`, `inbound:`, `outbound:`, `listen=0.0.0.0`. |
| `detectors.abuse.abusive_ports` | int list | 24 ports | Listening ports associated with tor (`9001 9030 9050 9051 9150 9151`), socks (`1080 1081 1090`), HTTP proxies (`3128 8118`), proxy panels (`7890 7891 8000 8001 8008 8082`), shadowsocks (`8388 8389`), trojan/xray fallbacks (`4433 8443`), hysteria/sing-box defaults (`10086 12345 54321`), IRC (`6667 6697`). |
| `detectors.abuse.watch_upload_paths` | list | `/var/lib/pterodactyl/volumes /var/lib/pterodactyl/mounts /tmp /var/tmp /dev/shm` | Customer-writable roots; executing from one is itself a medium-severity signal. |
| `detectors.abuse.whitelist_processes` | list | game-server binaries | Same game-server exemption list. |

Severity: known abuse process or listener on an abusive port → high; execution from an upload directory → medium.

::: warning
`cloudflared`, `frpc`/`frps` and `ngrok` are flagged by default. If you legitimately sell tunneling or use cloudflared for panel access on the same host, whitelist those paths or mute the affected servers — do not disable the whole detector.
:::

### detectors.onaccess

Real-time malware scanning of files as they appear in volumes. Category: `malware`.

| YAML path | Type | Default | What it does |
| --- | --- | --- | --- |
| `detectors.onaccess.enabled` | bool | `true` | Master switch. |
| `detectors.onaccess.watch_paths` | list | `/var/lib/pterodactyl/volumes` | fsnotify roots — every file create/write/move under these is scanned. |
| `detectors.onaccess.hash_check` | bool | `true` | SHA-256 every new file and check it against the blocklist (local + panel-distributed confirmed hashes). |
| `detectors.onaccess.yara_check` | bool | `true` | Scan new files with the active YARA rule bundle. |
| `detectors.onaccess.settle_ms` | int | `500` | Milliseconds to wait after the last write before scanning, so a file still being uploaded is not scanned half-written. |

Severity: blocklist hash hit → critical; YARA match → high. Default rule quarantines the file. Interesting files are hashed and submitted to the panel intel DB.

**Common mistakes.** Setting `settle_ms` too low (scans partial uploads, misses the final hash) or disabling `hash_check` and losing the fleet-wide intel benefit.

### detectors.yara

Scheduled YARA sweep across volume trees, complementing the on-access scanner. Category: `malware`. Disabled by default — the on-access path already covers new files; enable the sweep to catch files written before deployment.

| YAML path | Type | Default | What it does |
| --- | --- | --- | --- |
| `detectors.yara.enabled` | bool | `false` | Master switch. |
| `detectors.yara.scan_paths` | list | `/var/lib/pterodactyl/volumes` | Roots for the scheduled sweep. |
| `detectors.yara.interval_minutes` | int | `10` | Minutes between sweeps. |

YARA hits are high severity, category `malware` — consistent with on-access, so one rule covers both. Rules are edited in the panel (**Settings → Detectors** bundle editor) and hot-reloaded on every node.

### detectors.fim

File-integrity monitoring. Category: `fim`. Disabled by default; the shipped default watches the agent's own config.

| YAML path | Type | Default | What it does |
| --- | --- | --- | --- |
| `detectors.fim.enabled` | bool | `false` | Master switch. |
| `detectors.fim.paths` | list | `/etc/sentinel/config.yaml` | Files/directories to baseline (SHA-256) and watch. |
| `detectors.fim.interval_minutes` | int | `5` | Minutes between integrity checks. |

Every change to a protected file raises one high-severity event. Useful for watching Wings config, host SSH keys, or critical panel mounts — not for game volumes (they change constantly; that is what on-access is for).

### detectors.trivy

Container image CVE scanning via the external `trivy` binary. Category: `vuln`. Disabled by default; requires `trivy` installed on the node.

| YAML path | Type | Default | What it does |
| --- | --- | --- | --- |
| `detectors.trivy.enabled` | bool | `false` | Master switch. |
| `detectors.trivy.interval_minutes` | int | `60` | Minutes between image scans. |

Scans each running container's image for HIGH and CRITICAL CVEs; critical CVEs produce high-severity events, the rest medium.

### detectors.containerscan

Periodic per-container inspection: processes, log tails, npm dependencies and volume artifacts. Category: `scan` (critical hash-confirmed hits are reported as `malware`).

| YAML path | Type | Default | What it does |
| --- | --- | --- | --- |
| `detectors.containerscan.enabled` | bool | `true` | Master switch. |
| `detectors.containerscan.interval_minutes` | int | `3` | Minutes between container scan passes. |
| `detectors.containerscan.log_tail_lines` | int | `1000` | Lines of each container's log tail inspected for indicators. |
| `detectors.containerscan.log_indicators` | map | whatsapp / nezha / miner sets | Label → substrings matched in log tails: WhatsApp bots (`whatsapp-web.js`, `baileys`, `yowsup`, `wa-automate`, …), nezha agents (`nezha`, `App is running!`), miners (`xmrig`, `cryptonight`, `stratum+tcp`, `minexmr`, `nanopool`, `minergate`, …). |
| `detectors.containerscan.suspicious_words` | list | 11 fragments | Log-tail abuse markers: `new job from`, `noVNC`, `Downloading fresh proxies...`, `FAILED TO APPLY MSR MOD`, `Tor server's identity key`, `Stratum - Connected`, `eth.2miners.com:2020`, `whatsapp`, `wa-automate`, `whatsapp-web.js`, `baileys`. |
| `detectors.containerscan.suspicious_processes` | list | `xmrig earnfm mcstorm.jar proot destine hashvault` | Process names flagged when seen inside a container. |
| `detectors.containerscan.cache_artifacts` | list | `cpuminer cpuminer-avx2 xmrig` | Miner artifacts dropped in cache directories. |
| `detectors.containerscan.whatsapp_deps` | list | `whatsapp-web.js whatsapp-web-js webwhatsapi yowsup wa-automate baileys` | npm dependencies in `package.json` that indicate a WhatsApp bot. |
| `detectors.containerscan.concurrency` | int | `5` | Containers scanned in parallel. |
| `detectors.containerscan.min_server_jar_bytes` | int | `5242880` | A `server.jar` smaller than 5 MiB is flagged — real Minecraft jars are never that small; droppers are. |
| `detectors.containerscan.small_volume_mb` | float | `3.5` | Combined with high CPU: a near-empty volume burning CPU is mining. |
| `detectors.containerscan.high_cpu_percent` | int | `96` | CPU component of the tiny-volume heuristic. |
| `detectors.containerscan.high_network_mb` | int | `4096` | Network transfer (MB) component of the high-usage heuristic. |

Severity: suspicious process → high; labeled log indicators → medium or high depending on label; high CPU with tiny volume → high; suspicious log content / high network → medium.

### detectors.volumescan

Full filesystem walk of server volumes with sonar-style pattern lists. Category: `scan`. Also runs on demand from the panel (Scans tab).

| YAML path | Type | Default | What it does |
| --- | --- | --- | --- |
| `detectors.volumescan.enabled` | bool | `true` | Master switch. |
| `detectors.volumescan.interval_minutes` | int | `15` | Minutes between scheduled sweeps. |
| `detectors.volumescan.suspicious_names` | list | `mine.sh working_proxies.txt proxies.txt whatsapp.js wa_bot.js proxy.txt` | File names that indicate abuse. |
| `detectors.volumescan.suspicious_extensions` | list | `.sh` | Extensions that warrant a closer look. |
| `detectors.volumescan.mining_patterns` | list | 10 substrings | File-content markers: `stratum`, `cryptonight`, `proxies...`, `minexmr.com`, `herominers`, `hashvault`, `xmrig`, `nanopool.org`, `ethpool.org`, `2miners.com`. |
| `detectors.volumescan.ignored_files` | list | 12 names | Benign files skipped: `velocity.toml`, `server.jar.old`, `latest.log`, `debug.log`, `error.log`, `access.log`, `server.log`, `usermap.bin`, `forbidden-players.txt`, `help.yml`, `commands.yml`, `permissions.yml`. |
| `detectors.volumescan.ignored_paths` | list | 16 prefixes | Relative path prefixes skipped: `proxy.log.0`, `proxy.log`, `plugins/.paper-remapped`, `plugins/CoreProtect/database.db`, `plugins/PlaceholderAPI/javascripts/example.js`, `plugins/Geyser-Spigot/locales`, `plugins/Geyser-Velocity/locales`, `plugins/Essentials`, `plugins/ViaVersion/cache`, `cache`, `logs`, `crash-reports`, `world/playerdata`, `world/stats`, `world/advancements`, `world/region`. |
| `detectors.volumescan.ignored_extensions` | list | 19 extensions | Skipped on content scans: `.jar`, `.phar`, `.rar`, `.zip`, `.tar.gz`, `.7z`, `.gz`, `.xz`, `.bz2`, `.log`, `.logs`, `.txt`, `.yml`, `.yaml`, `.json`, `.properties`, `.db`, `.toml`, `.mca`. |
| `detectors.volumescan.max_jar_size_mb` | int | `5` | Jars above this are treated as real server jars and skipped by undersized-jar checks. |
| `detectors.volumescan.max_file_size_mb` | int | `64` | Files larger than this are not content-scanned (names/extensions still apply). |
| `detectors.volumescan.max_scan_seconds` | int | `600` | Time budget per sweep. |

---

## whitelist

Suppression lists applied before rules run.

| YAML path | Type | Default | What it does |
| --- | --- | --- | --- |
| `whitelist.paths` | list | `[]` | Path prefixes exempt from file-based detection and actions. Matching is prefix-based (`/a/b` covers `/a/b/c`). |
| `whitelist.servers` | list | `[]` | Muted server UUIDs. Local actions AND alerts are suppressed for these servers, but events are still recorded with `evidence.muted: true`. |

**When to change.** Mute a server while you investigate a false positive, or whitelist a path that legitimately contains miner-like content (e.g., a security-research egg). Prefer muting one server over disabling a detector fleet-wide.

---

## rules

The enforcement policy: an ordered list mapping (categories, minimum severity) to actions. First match wins; the built-in list ends with a `* / low / alert` catch-all so every event is at least alerted.

```yaml
rules:
  - name: miners-high
    categories: [miner]
    min_severity: high
    actions: [alert, kill_process]
  - name: miners-critical
    categories: [miner]
    min_severity: critical
    actions: [alert, stop_container, suspend_server]
  # ...
```

- **Categories:** `miner`, `portscan`, `ddos`, `zipbomb`, `exploit`, `abuse`, `malware`, `fim`, `vuln`, `scan`, or `*` for all.
- **Severities:** `low`, `medium`, `high`, `critical` (`min_severity` is inclusive — `high` matches high and critical).
- **Actions:** `alert`, `quarantine_file`, `delete_file`, `kill_process`, `pause_container`, `stop_container`, `suspend_server` (the node also accepts `log_only` and `unpause_container`).

The built-in policy (from `DefaultRules()`):

| Rule | Categories | Min severity | Actions |
| --- | --- | --- | --- |
| miners-high | miner | high | alert, kill_process |
| miners-critical | miner | critical | alert, stop_container, suspend_server |
| abuse-high | abuse | high | alert, kill_process |
| abuse-critical | abuse | critical | alert, stop_container, suspend_server |
| ddos | ddos | high | alert, pause_container, suspend_server |
| malware | malware | high | alert, quarantine_file |
| exploits | exploit | high | alert, kill_process |
| exploits-critical | exploit | critical | alert, stop_container, suspend_server |
| zipbombs | zipbomb | medium | alert, quarantine_file |
| portscans | portscan | medium | alert |
| catch-all | * | low | alert |

::: warning
`suspend_server` is **not** executed by the node. The node reports the event; the panel suspends via Pterodactyl's `SuspensionService` when the event arrives. This is deliberate: suspension is panel-authoritative, idempotent, and works even if the node's local actions fail. With `dry_run: true`, no rule action runs on either side.
:::

**Common mistakes.** Putting a broad rule (e.g. `* / low`) above specific ones — first match wins, so the specific rules never fire. Using `delete_file` where `quarantine_file` would do — quarantine keeps the file restorable from the Quarantine tab.

---

## intel

Central threat-intel behavior.

| YAML path | Type | Default | What it does |
| --- | --- | --- | --- |
| `intel.confirm_threshold` | int | `3` | Distinct nodes that must report the same SHA-256 before it flips to `confirmed` and is distributed fleet-wide. Range 1–50. |
| `intel.external_hashlist_url` | string | `""` (empty) | Optional external SHA-256 blocklist feed, pulled on the update interval and merged into the node blocklists. Empty disables. |
| `intel.update_interval_hours` | int | `24` | Hours between external feed pulls and intel bundle refreshes. Range 1–720. |

**When to change.** On a small fleet (2–3 nodes), set `confirm_threshold: 1` or `2` so intel actually propagates; on large fleets, keep 3+ so one compromised node cannot poison the blocklist. Admin-confirmed and bulk-imported hashes bypass the threshold entirely.

---

## limits

Backpressure guards.

| YAML path | Type | Default | What it does |
| --- | --- | --- | --- |
| `limits.max_events_per_minute` | int | `60` | Per-node event rate cap; excess events are dropped (and counted) to protect the panel from a detection storm. Range 1–10000. |
| `limits.spool_max_events` | int | `10000` | Bound on the on-disk event spool used while the panel is unreachable. Oldest events are dropped past the cap. Range 100–1000000. |

---

## Panel-side settings (never sent to nodes)

### Alert channels — Settings → Alert Channels

Secrets live only in the panel DB. Each channel has `enabled`, a destination, and `min_severity` (the channel only fires for events at or above it).

| Setting | Type | Default | What it does |
| --- | --- | --- | --- |
| `alerts.discord.enabled` | bool | `false` | Enable Discord embed alerts. |
| `alerts.discord.webhook_url` | string | `""` | Discord webhook URL; validated to match `https://(canary.|ptb.)?discord(app)?.com/api/webhooks/…`. |
| `alerts.discord.min_severity` | enum | `high` | Minimum severity posted to Discord. |
| `alerts.webhook.enabled` | bool | `false` | Enable the generic JSON webhook. |
| `alerts.webhook.url` | string | `""` | Any `http(s)://` endpoint receiving the event payload as JSON. |
| `alerts.webhook.min_severity` | enum | `high` | Minimum severity posted to the webhook. |
| `alerts.smtp.enabled` | bool | `false` | Enable email alerts via the panel's configured mailer. |
| `alerts.smtp.recipients` | string | `""` | Space/comma-separated recipient addresses; each is email-validated. |
| `alerts.smtp.min_severity` | enum | `critical` | Minimum severity emailed. Defaults to critical to keep inboxes quiet. |

Alert dispatch is subject to per-channel cooldown and the global rate limit — see [Webhooks & Alerts](../user-guide/webhooks.md).

### Per-node overrides — Settings → Node Overrides

A JSON tree stored per node as `node_config_override_<node_id>`, deep-merged **over** the global tree when the panel builds that node's effective config. Scalars and lists are replaced wholesale; associative maps merge recursively. Saving an override bumps `config_version` and pushes to that node like any other change.

```json
{
  "detectors": {
    "miner": { "cpu_threshold": 95 },
    "trivy": { "enabled": true }
  },
  "general": { "log_level": "debug" }
}
```

Use overrides for one noisy node (raise thresholds), one beefy node (enable trivy/yara sweeps), or debugging a single agent — not as your primary config mechanism. Deleting the override reverts the node to the global tree on the next push.

### Other panel settings

| Setting | Where | What it does |
| --- | --- | --- |
| `config_version` | internal | Monotonic counter, bumped on every config/intel save; how nodes learn they must re-apply. |
| `yara_rules` | Settings → Detectors | The YARA rule bundle text (max 200 KB), distributed to nodes with `yara_version`. |
| `sentinel.offline_after_seconds` | `config/sentinel.php` | Seconds without a heartbeat before housekeeping marks a node offline. Default `120`. |
| `sentinel.event_retention_days` | `config/sentinel.php` | Days of events kept before `sentinel:housekeeping` prunes them. Default `30`. |

---

## Node-local `/etc/sentinel/config.yaml`

Written by `install.sh`; mode `0600`. This is the **only** file you edit by hand, and only for connectivity changes.

```yaml
api:
  listen: 0.0.0.0     # bind address for the agent API
  port: 8481          # bind port (panel calls back here)
panel:
  url: https://panel.example.com   # panel base URL
  token_file: /etc/sentinel/token  # 64-hex pairing token (0600)
state_dir: /var/lib/sentinel       # spool, quarantine, intel, persisted config
docker_socket: /var/run/docker.sock
log_level: info
```

| Key | What it does | When to change |
| --- | --- | --- |
| `api.listen` / `api.port` | Where the agent's HTTP API binds. | Port conflicts; binding to a specific interface. Must stay reachable from the panel for config push. |
| `panel.url` | Panel base URL the agent registers/heartbeats to. | Panel domain change. Trailing slash is stripped by the installer. |
| `panel.token_file` | Path to the pairing token. | Never — re-run `install.sh` to re-pair instead. |
| `state_dir` | Runtime state root. | Moving state to a bigger disk. |
| `docker_socket` | Docker socket path. | Non-standard docker setups. |
| `log_level` | Local bootstrap log level (the pushed config's `general.log_level` takes over once applied). | Early-boot debugging. |

After editing, restart the agent: `systemctl restart sentinel-node`.
