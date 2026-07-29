---
title: Configuration Reference
description: Every Protection configuration value documented — path, type, default, purpose, when to change it, and common mistakes.
---

# Configuration Reference

> **The exhaustive reference for every Protection Plus v1.0.0 configuration value.**
> Defaults on this page are verified against `applyDefaults()` in
> `internal/config/config.go` — not against comments in the example file.

Protection reads a single YAML file, by default `/etc/protection/config.yaml`. Generate a documented starter with:

```bash
protection config init /etc/protection/config.yaml
```

Validate any config without running the daemon:

```bash
protection config check /etc/protection/config.yaml
```

::: info HOW DEFAULTS ACTUALLY WORK
Every value you omit falls back to a built-in default — **except `enabled` flags and `dry_run`**, which are plain booleans whose zero value is `false`. A near-empty config therefore starts Protection with **no detectors, no alert channels, and no action backends** (and armed — see the `dry_run` warning below). The generated starter config is what turns the core feature set on; treat it as the real baseline, not as decoration.
:::

The file has eight top-level sections:

```yaml
general:    # daemon-wide settings
detectors:  # per-detector tuning
intel:      # threat-intel (YARA rules + hash blocklist) management
alerts:     # notification channels
actions:    # enforcement backends
whitelist:  # trusted paths/containers, exempt from everything
limits:     # optional resource-safety limits (all opt-in)
rules:      # threat → action policy
```

::: warning LIST VALUES REPLACE, NOT EXTEND
For every built-in signature list (`known_processes`, `pool_ports`, `whitelist_processes`, `known_tools`, …) the daemon uses the built-in default **only when your list is empty**. The moment you set one item in YAML, your list **replaces** the built-in list entirely. To extend a list, copy the defaults (shown below) and add yours. This bites hardest on `whitelist_processes`: setting it drops the built-in game-server exemptions, and legitimate game servers start tripping the CPU/connection heuristics.
:::

---

## `general`

Daemon-wide settings.

```yaml
general:
  name: "node-fra-01"
  mode: both
  scan_interval: 5s
  cooldown: 5m
  log_level: info
  log_file: /var/log/protection.log
  dry_run: true
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `general.name` | string | hostname → primary IP → `Protection` | Human label for this installation, shown in **every** alert (Discord author/footer, email subject, webhook payload). Set it to something that tells you *which* node is paging you at 3am. |
| `general.mode` | enum | `both` | What to protect: `server` (host processes only), `docker` (containerised threats only), or `both`. Anything else is rejected at startup. See [Modes](#modes). |
| `general.scan_interval` | duration | `5s` | How often detectors run; also the CPU/disk sampling cadence. Lower = faster detection, more CPU. `10s` is fine on small nodes; do not go below `2s`. |
| `general.cooldown` | duration | `5m` | Suppresses duplicate alerts/actions for the same threat on the same target within this window. Raise it against alert fatigue; lower it for faster re-alerts on persistent threats. |
| `general.log_level` | enum | `info` | `debug` (noisy, troubleshooting only), `info`, `warn`, or `error`. |
| `general.log_file` | string | *(empty — stderr/journald only)* | If set, logs are tee'd to this file as well. Size-based rotation is available under [`limits`](#limits); leave `limits.log_max_size_mb: 0` if you prefer logrotate. |
| `general.dry_run` | bool | **`false` — no code default** | When `true`, destructive actions are logged but **not** executed; alerts still fire. See the warning below. |
| `general.hostname` | string | auto (`os.Hostname()`) | Overrides the detected hostname. Rarely needed. |

::: danger UNSET `dry_run` MEANS ARMED
`dry_run` has **no default in code** — it is a plain boolean, so if you omit it you get `false`, and `false` means Protection **will** kill processes/containers, quarantine files, and suspend servers the moment a rule matches. The starter config sets `dry_run: true` explicitly; if you hand-write a minimal config you do *not* get that safety. Always set `dry_run` deliberately. Run dry for a few days on a new node, review the alerts, then set `false` and `systemctl restart protection`.
:::

### Modes

| `mode` | Events kept |
| --- | --- |
| `server` | Host/VPS only — events **without** a container or Pterodactyl server |
| `docker` | Container-related events only |
| `both` | Everything (default) |

::: details Common mistake — events silently dropped
If you set `mode: docker` on a bare VPS, host-process threats are filtered out and you'll see "no threats" even when a host miner is running. Use `both` if unsure.
:::

---

## `detectors`

Each detector is independent and toggled with its own `enabled` flag. **Every `enabled` defaults to `false`** — the starter config turns on miner, portscan, ddos, zipbomb, exploit, abuse, fim and onaccess; yara and trivy stay opt-in.

### `detectors.miner`

Cryptocurrency-miner detection: signature matching, mining-pool connections, and a sustained-CPU heuristic for unknown miners.

```yaml
detectors:
  miner:
    enabled: true
    cpu_threshold: 85
    sustained_seconds: 45
    known_processes: []   # replaces the built-in list if set
    pool_ports: []        # replaces the built-in list if set
    pool_domains: []      # parsed, currently unused (see warning)
    whitelist_processes: []  # replaces the built-in game-server list if set
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `miner.enabled` | bool | `false` (starter sets `true`) | Enable miner detection. |
| `miner.cpu_threshold` | float | `85` | Per-core CPU percent that counts as "high". Game servers legitimately sit at 90%+, which is what `whitelist_processes` is for. Recommended range 80–90. |
| `miner.sustained_seconds` | int | `45` | How long CPU must stay above the threshold before flagging. Miners are constant; game servers spike and dip — 45s separates them well. Raise to `120` on noisy nodes instead of disabling the detector. |
| `miner.known_processes` | list | built-in (xmrig, minerd, t-rex, nbminer, xmr-stak, … 23 names) | Miner binary names flagged on sight. **Replaces** the built-in list when set. |
| `miner.pool_ports` | list&lt;int&gt; | built-in (3333, 4444, 5555, 7777, 8888, 9999, 14433, 14444, 45560, 45700, 20580) | Mining-pool ports. Only **public** remote IPs are checked, so local services on these ports are safe. Replaces the built-in list when set. |
| `miner.pool_domains` | list | built-in (15 pool domains) | **Parsed and defaulted but currently unused** — reserved for forward compatibility. Setting it has no effect in v1.0.0. |
| `miner.whitelist_processes` | list | built-in game servers (java, bedrock_server, srcds, RustDedicated, fivem, valheim, cs2, gmod, …) | Processes skipped by the CPU heuristic. Known-miner signatures and pool connections **still** apply to them. Replaces the built-in list when set — set it carelessly and every game server trips the CPU heuristic. |

::: warning `pool_domains` DOES NOTHING YET
`miner.pool_domains` is parsed into the config (and defaulted) but no detector reads it in v1.0.0. Don't rely on it for detection — pool connections are caught by `pool_ports` and known-process signatures.
:::

::: details Common mistake — too many CPU alerts
A busy game server can legitimately peg a core. Raise `sustained_seconds` (e.g. `120`) and/or `cpu_threshold` rather than disabling the detector — signature and pool-connection detection still work regardless of CPU.
:::

### `detectors.portscan`

Flags processes fanning out half-open (SYN_SENT) connections — the signature of `nmap`/`masscan`-style scanning from your node.

```yaml
detectors:
  portscan:
    enabled: true
    distinct_ports: 100
    distinct_hosts: 50
    window: 15s
    known_scanner_processes: []
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `portscan.enabled` | bool | `false` (starter sets `true`) | Enable port-scan detection. |
| `portscan.distinct_ports` | int | `100` | Distinct destination ports within `window` that flag a scan. Lower = more sensitive, more false positives from peer-to-peer software. |
| `portscan.distinct_hosts` | int | `50` | Distinct destination hosts within `window` that flag a scan. |
| `portscan.window` | duration | `15s` | Sliding window over which half-open connections are counted. |
| `portscan.known_scanner_processes` | list | built-in (nmap, masscan, zmap, unicornscan, hping3, naabu, rustscan) | Scanner binary names flagged on sight. Replaces the built-in list when set. |

### `detectors.ddos`

**Outbound** flood detection — your customers attacking *other* people. This does not mitigate inbound attacks (use your XDP/firewall layer for that).

```yaml
detectors:
  ddos:
    enabled: true
    pps_threshold: 60000
    bps_threshold: 125000000
    conn_threshold: 1500
    known_tools: []
    whitelist_processes: []
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `ddos.enabled` | bool | `false` (starter sets `true`) | Enable outbound-flood detection. |
| `ddos.pps_threshold` | int | `60000` | Outbound packets/sec **per container** (via Docker stats) that flags a flood. Game servers rarely exceed 10–20k pps; lower to e.g. `20000` on small hosts for earlier warnings. |
| `ddos.bps_threshold` | int | `125000000` | Outbound bytes/sec per container (~1 Gbit/s). Set to ~80% of your node's uplink so a single container can't saturate you. |
| `ddos.conn_threshold` | int | `1500` | Simultaneous outbound connections (or active UDP sockets) from one process that flags a connection flood. Tor exits and floods hold thousands; game servers hold dozens per player. `500` is aggressive. |
| `ddos.known_tools` | list | built-in (hping3, t50, mhddos, slowloris, goldeneye, xerxes, loic, … 15 names) | Stress-tool signatures, word-boundary matched to avoid false positives. Replaces the built-in list when set. |
| `ddos.whitelist_processes` | list | built-in game-server list | Skipped by the connection-flood heuristic; docker-stats rates and tool signatures **still** apply. Replaces the built-in list when set. |

::: tip
Container egress thresholds (`pps`/`bps`) only apply when Docker is reachable. Tool-signature and connection-flood detection work without Docker.
:::

### `detectors.zipbomb`

Decompression-bomb detection. Archives are inspected from their **metadata** (never extracted), so scanning is safe and cheap.

```yaml
detectors:
  zipbomb:
    enabled: true
    scan_paths:
      - /var/lib/pterodactyl/volumes
    ratio_threshold: 150
    max_uncompressed: 53687091200   # 50 GiB
    hot_trigger: true
    hot_cpu_percent: 80
    hot_write_mbps: 25
    full_scan_interval: 30m
    full_scan_max_duration: 5m
    min_compressed_size: 10240
    inspect_timeout: 5s
    max_concurrent_inspects: 4
    probe_compressed_limit: 1048576
    probe_uncompressed_limit: 10485760
    max_nesting: 3                  # parsed, currently unused
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `zipbomb.enabled` | bool | `false` (starter sets `true`) | Enable zip-bomb detection. |
| `zipbomb.scan_paths` | list | `[/var/lib/pterodactyl/volumes]` | Directories walked for archives. Point at your real panel volumes and anywhere users can upload. `protection config init --scan-paths` fills this in (`ALL` = all user-writable dirs). |
| `zipbomb.ratio_threshold` | float | `150` | Uncompressed÷compressed ratio that flags a bomb. Real bombs are >1000:1; media archives ~1:1; text logs ~10:1 — 150 is safe. |
| `zipbomb.max_uncompressed` | int (bytes) | `53687091200` (50 GiB) | Absolute uncompressed-size ceiling regardless of ratio. Lower it on small disks (e.g. 10 GiB). |
| `zipbomb.hot_trigger` | bool | `true` | Event-driven path: a process spiking CPU + disk writes (measured per **process group**, so `tar`+`gzip` pipelines are caught) has its open archives inspected immediately instead of waiting for the next sweep. Keep this on. |
| `zipbomb.hot_cpu_percent` | float | `80` | Per-core CPU that, with high disk writes, signals an active extraction. |
| `zipbomb.hot_write_mbps` | float | `25` | Disk write rate (MB/s) that, with high CPU, signals an active extraction. |
| `zipbomb.full_scan_interval` | duration | `30m` | Slow backstop sweep of `scan_paths` — catches bombs uploaded but not yet extracted. |
| `zipbomb.full_scan_max_duration` | duration | `5m` | A sweep stops after this and resumes on the next tick from the cached cleared-file list. Bounds I/O on huge volumes. |
| `zipbomb.min_compressed_size` | int (bytes) | `10240` (10 KiB) | Archives smaller than this are skipped — they can't hurt you. |
| `zipbomb.inspect_timeout` | duration | `5s` | Hard cap per archive inspection. |
| `zipbomb.max_concurrent_inspects` | int | `4` | Worker-pool size for sweeps. Raise on fast NVMe nodes, lower on spinning disks. |
| `zipbomb.probe_compressed_limit` | int (bytes) | `1048576` (1 MiB) | Bounded probe: at most this many compressed bytes are read… |
| `zipbomb.probe_uncompressed_limit` | int (bytes) | `10485760` (10 MiB) | …and at most this many bytes are decompressed during a probe. Inspection can never be turned against you as a bomb itself. |
| `zipbomb.max_nesting` | int | `3` | **Parsed and defaulted but currently unused** — reserved for nested-archive inspection depth (forward compatibility). Setting it has no effect in v1.0.0. |

::: details Common mistake — scanning the wrong path
On a custom Pterodactyl/Wings layout, point `scan_paths` at your real volumes directory. And don't add `/` "just in case" — sweeping the whole filesystem every 30 minutes is pure I/O waste; the hot trigger already covers live extractions.
:::

### `detectors.exploit`

Exploit and container-escape detection: reverse shells, privilege escalation, setuid droppers in world-writable dirs.

```yaml
detectors:
  exploit:
    enabled: true
    flag_reverse_shell: true
    flag_privilege_escalation: true
    watch_paths: [/tmp, /dev/shm, /var/tmp]
    suspicious_processes: []
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `exploit.enabled` | bool | `false` (starter sets `true`) | Enable exploit / container-escape detection. |
| `exploit.flag_reverse_shell` | bool | `false` (starter sets `true`) | Flag network-bound reverse-shell patterns (`/dev/tcp/`, `nc -e`, `socat exec`, …). |
| `exploit.flag_privilege_escalation` | bool | `false` (starter sets `true`) | Flag privesc/escape patterns (sudoers tampering, `chmod +s`, `setcap`, `nsenter --target 1`, …). |
| `exploit.watch_paths` | list | `[/tmp, /dev/shm, /var/tmp]` | World-writable dirs walked for setuid payloads and execution-from-scratch. Add custom tmpfs mounts if you have them. |
| `exploit.suspicious_processes` | list | built-in (dirtycow, dirtypipe, pwnkit, linpeas, nsenter, runc, deepce, …) | Exploit/privesc tool names flagged on sight. Replaces the built-in list when set. |

::: warning THE `flag_*` BOOLEANS ALSO DEFAULT TO `false`
Like every other plain boolean in this file, `flag_reverse_shell` and `flag_privilege_escalation` are `false` when omitted — the starter config enables both. If you hand-roll a minimal config and only write `exploit.enabled: true`, you get setuid scanning of `watch_paths` but **no** reverse-shell or privesc pattern matching. Set the flags explicitly.
:::

### `detectors.abuse`

Hosting-abuse services: Tor exits/relays, proxy/VPN tunnels (OpenVPN, WireGuard, Shadowsocks, v2ray/xray, trojan, hysteria, sing-box, ngrok, frp), spam mail servers, IRC bots, and execution out of user upload directories.

```yaml
detectors:
  abuse:
    enabled: true
    known_processes: []      # replaces built-in list
    known_cmd_patterns: []   # replaces built-in list
    abusive_ports: []        # replaces built-in list
    watch_upload_paths: []   # replaces built-in list
    whitelist_processes: []  # replaces built-in game-server list
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `abuse.enabled` | bool | `false` (starter sets `true`) | Enable abuse detection. |
| `abuse.known_processes` | list | built-in (tor, openvpn, wireguard, shadowsocks, v2ray, xray, trojan, hysteria, sing-box, cloudflared, frpc/frps, ngrok, sendmail, postfix, exim, znc, eggdrop, …) | Abuse-service binary names flagged on sight. Replaces the built-in list when set. |
| `abuse.known_cmd_patterns` | list | built-in (`--orport`, `--socks-port`, `-f /etc/tor`, `--protocol vmess`, …) | Command-line substrings that strongly indicate abuse services. Replaces the built-in list when set. |
| `abuse.abusive_ports` | list&lt;int&gt; | built-in (Tor 9001/9030/9050/9051/9150/9151, SOCKS 1080/1081/1090, SS 8388/8389, trojan 4433/8443, …) | **Listening** ports that indicate abuse tunnels. Game servers should not normally bind these. Replaces the built-in list when set. |
| `abuse.watch_upload_paths` | list | `[/var/lib/pterodactyl/volumes, /var/lib/pterodactyl/mounts, /home/container, /tmp, /var/tmp, /dev/shm]` | Directories where customer-uploaded files live; executables must never run from here. Replaces the built-in list when set. |
| `abuse.whitelist_processes` | list | built-in game-server list | Exempt from abuse heuristics. Replaces the built-in list when set. |

::: details Common mistake — flagging your own mail/VPN
If you legitimately run a mail server or a WireGuard endpoint **on the host**, the abuse detector will flag it. Whitelist the specific container/process or host path via the top-level [`whitelist`](#whitelist) section rather than disabling the detector.
:::

### `detectors.yara`

Periodic full YARA sweep of `scan_paths` using the `yara` CLI (installed separately, e.g. `apt install yara`). **No-op if the binary is missing.** For instant per-file scanning prefer [`onaccess`](#detectors-onaccess); this is the backstop sweep.

```yaml
detectors:
  yara:
    enabled: false
    rules_dir: /etc/protection/yara
    scan_paths:
      - /var/lib/pterodactyl/volumes
    interval: 10m
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `yara.enabled` | bool | `false` | Enable the periodic YARA sweep. Opt-in even in the starter config. |
| `yara.rules_dir` | string | `/etc/protection/yara` | Directory containing `.yar` rule files. Populated by `protection rules update` / the [`intel`](#intel) section. |
| `yara.scan_paths` | list | `[/var/lib/pterodactyl/volumes]` | Directories swept each interval. |
| `yara.interval` | duration | `10m` | Time between sweeps. YARA on large volumes is I/O-heavy — don't go below a few minutes. |

### `detectors.fim`

File-integrity monitoring: alerts when the daemon's own binary, the config file, or any listed path changes on disk. Catches attackers tampering with Protection itself.

```yaml
detectors:
  fim:
    enabled: true
    paths: [/etc/ssh/sshd_config]
    interval: 5m
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `fim.enabled` | bool | `false` (starter sets `true`) | Enable file-integrity monitoring. |
| `fim.paths` | list | the protection binary + the loaded config file | Paths to hash and watch. The defaults are added automatically in `Load()`; anything you list is **added on top** (this list appends, unlike signature lists). Add high-value targets like `/etc/ssh/sshd_config` or your panel config. |
| `fim.interval` | duration | `5m` | Time between integrity checks. |

### `detectors.trivy`

Container-image vulnerability scanning via the `trivy` CLI (installed separately). **No-op if the binary is missing.** Emits one event per image with HIGH/CRITICAL vulnerability counts. Alert-only by design.

```yaml
detectors:
  trivy:
    enabled: false
    binary: trivy
    interval: 1h
    min_severity: medium
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `trivy.enabled` | bool | `false` | Enable image scanning. Opt-in even in the starter config. |
| `trivy.binary` | string | `trivy` | Path/name of the trivy executable. Change only for a non-PATH install. |
| `trivy.interval` | duration | `1h` | Time between scans. Image scans are expensive; hourly is already aggressive for large nodes. |
| `trivy.min_severity` | enum | `medium` | Minimum vulnerability severity reported (`medium`, `high`, `critical`). Set `high` to cut noise. |

### `detectors.onaccess`

The antivirus hot path. Watches upload dirs with fsnotify and scans every file the moment it is closed after writing: SHA-256 against the hash blocklist, then YARA against the rule bundle. Matched files hit the `malware` rule (quarantine + alert by default).

```yaml
detectors:
  onaccess:
    enabled: true
    watch_paths:
      - /var/lib/pterodactyl/volumes
    hash_check: true
    yara_check: true
    settle_ms: 500
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `onaccess.enabled` | bool | `false` (starter sets `true`) | Enable on-access scanning. |
| `onaccess.watch_paths` | list | `[/var/lib/pterodactyl/volumes, /var/lib/pterodactyl/mounts, /home/container, /tmp, /var/tmp, /dev/shm]` | Directories watched with fsnotify. Replaces the built-in list when set. |
| `onaccess.hash_check` | bool | `true` | SHA-256 against the blocklist. **Requires the blocklist to exist** — run `protection rules update` once (see warning). |
| `onaccess.yara_check` | bool | `true` | YARA-scan each written file. Needs the `yara` CLI installed; silently does nothing without it. |
| `onaccess.settle_ms` | int | `500` | Milliseconds to wait for writes to settle before scanning a closed file. Raise if you scan partially-written large uploads; lower for faster verdicts. |

::: warning RUN `protection rules update` ONCE
`hash_check` compares against `/var/lib/protection/blocklist.sha256`, which only exists after the first intel fetch. On a fresh install, run `protection rules update` once (or enable [`intel`](#intel) and let the daemon fetch on its schedule) or the hash half of on-access scanning has nothing to match against. `yara_check` similarly needs the `yara` binary installed and rules in `intel.rules_dir`.
:::

---

## `intel`

Threat-intel management: where the YARA rule bundle and the SHA-256 hash blocklist come from and how they refresh. `protection rules update` runs this once manually; the daemon refreshes automatically every `update_interval` when `intel.enabled: true`.

```yaml
intel:
  enabled: true
  rules_dir: /etc/protection/yara
  rules_url: "https://raw.githubusercontent.com/AnAverageBeing/protection/main/rules/protection.yar"
  hashlist_url: "https://bazaar.abuse.ch/export/txt/sha256/recent/"
  hashlist_file: /var/lib/protection/blocklist.sha256
  custom_hashlist: ""
  update_interval: 24h
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `intel.enabled` | bool | `false` (starter sets `true`) | Enable automatic intel refresh. With `false`, intel is only fetched when you run `protection rules update` by hand. |
| `intel.rules_dir` | string | `/etc/protection/yara` | Where the downloaded rule bundle is written (also the default `yara.rules_dir`). |
| `intel.rules_url` | string | curated bundle on GitHub (webshells, miners, tor, mirai, IRC bots, privesc) | Point at your own URL to self-host rules. |
| `intel.hashlist_url` | string | MalwareBazaar **recent** SHA-256 export (last ~48h) | See the RAM trade-off warning below before switching to `full`. |
| `intel.hashlist_file` | string | `/var/lib/protection/blocklist.sha256` | Local on-disk blocklist the on-access scanner matches against. |
| `intel.custom_hashlist` | string | *(empty)* | Path to your own extra hashes, one SHA-256 per line. **Merged** into the blocklist, never overwritten by updates. |
| `intel.update_interval` | duration | `24h` | Automatic refresh cadence. MalwareBazaar's recent feed moves fast; daily is the intended cadence — don't hammer it. |

::: warning `full` HASHLIST = HUNDREDS OF MB OF RAM
The default `recent` export covers roughly the last 48 hours of MalwareBazaar submissions — small and fast. Switching `hashlist_url` to `https://bazaar.abuse.ch/export/txt/sha256/full/` gives complete coverage at ~1.1M+ hashes, which the daemon holds as an **in-memory set costing a few hundred MB of RAM**. On 1–2 GB game nodes that alone can OOM the box. Only use `full` on nodes with RAM to spare.
:::

---

## `alerts`

Notification channels. Each channel has its own `min_severity` gate; the ordering is `info` < `low` < `medium` < `high` < `critical`. An empty or unrecognised `min_severity` parses to `medium` — a typo never silently disables a channel (or a rule).

### `alerts.discord`

```yaml
alerts:
  discord:
    enabled: false
    webhook_url: ""
    username: Protection
    min_severity: medium
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `discord.enabled` | bool | `false` | Enable Discord webhook alerts. |
| `discord.webhook_url` | string | *(required if enabled — startup fails without it)* | The Discord webhook URL. |
| `discord.username` | string | `Protection` | Webhook display name. |
| `discord.min_severity` | enum | `medium` (also the fallback for empty/invalid) | Lowest severity that triggers a Discord alert. `medium` is a good default; use `high` on quiet channels. |

### `alerts.smtp`

```yaml
alerts:
  smtp:
    enabled: false
    host: smtp.example.com
    port: 587
    username: alerts@example.com
    password: ""
    from: alerts@example.com
    to: [admin@example.com]
    tls: true
    min_severity: high
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `smtp.enabled` | bool | `false` | Enable email alerts. Startup fails if `host` or `to` are missing while enabled. |
| `smtp.host` | string | *(required if enabled)* | SMTP server hostname. |
| `smtp.port` | int | **none — you must set it** | `587` = STARTTLS (negotiated automatically), `465` = implicit TLS (needs `tls: true`). There is no code default; an unset port produces `host:0` and every send fails. |
| `smtp.username` | string | *(optional)* | Auth username. Omit both credentials for an open relay. |
| `smtp.password` | string | *(optional)* | Auth password. |
| `smtp.from` | string | *(required in practice)* | Envelope/From address. |
| `smtp.to` | list | *(required if enabled)* | Recipient addresses. |
| `smtp.tls` | bool | `false` unless set | Only used with `port: 465` (implicit TLS). Ignored on 587, where STARTTLS is always attempted. |
| `smtp.min_severity` | enum | `medium` fallback (starter suggests `high`) | Lowest severity that triggers email. Email is slow and easy to ignore — gate it high. |

### `alerts.webhook`

```yaml
alerts:
  webhook:
    enabled: false
    url: ""
    method: POST
    headers:
      Authorization: "Bearer changeme"
    min_severity: medium
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `webhook.enabled` | bool | `false` | Enable the generic JSON webhook. Startup fails if `url` is empty while enabled. |
| `webhook.url` | string | *(required if enabled)* | Endpoint that receives `{ "installation": …, "event": {…} }` as JSON. Ideal for SIEM/automation. |
| `webhook.method` | string | `POST` (applied at send time) | HTTP method. |
| `webhook.headers` | map | *(none)* | Custom headers, e.g. auth tokens. |
| `webhook.min_severity` | enum | `medium` (fallback) | Lowest severity that triggers the webhook. |

### `alerts.batch`

Alert aggregation: when more than `threshold` alerts fire inside `window`, they collapse into one digest alert. Enable on busy nodes so a burst pages you once, not 50 times.

```yaml
alerts:
  batch:
    enabled: false
    threshold: 10
    window: 1m
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `batch.enabled` | bool | `false` | Enable digest batching. |
| `batch.threshold` | int | `10` | Burst size that triggers collapsing into a digest. |
| `batch.window` | duration | `1m` | Window the threshold is counted over. |

See **[Alerts & Notifications](../user-guide/alerts.md)** for payload formats.

---

## `actions`

Enforcement backends. An action in a rule only works if its backend is enabled here.

```yaml
actions:
  docker:
    enabled: true
    socket: /var/run/docker.sock
  pterodactyl:
    enabled: false
    url: https://panel.example.com
    api_key: ""
  file:
    enabled: true
    quarantine_dir: /var/lib/protection/quarantine
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `docker.enabled` | bool | `false` (starter sets `true`) | Enable container actions (`kill_container`, `stop_container`) and container egress stats for the ddos detector. |
| `docker.socket` | string | `/var/run/docker.sock` | Docker Engine API socket. |
| `pterodactyl.enabled` | bool | `false` | Enable `suspend_server`. Startup fails if `url`/`api_key` are missing while enabled. |
| `pterodactyl.url` | string | *(required if enabled)* | Panel base URL. |
| `pterodactyl.api_key` | string | *(required if enabled)* | **Application** API key with server read + suspend. |
| `file.enabled` | bool | `false` (starter sets `true`) | Enable `quarantine_file` / `delete_file`. |
| `file.quarantine_dir` | string | `/var/lib/protection/quarantine` | Where quarantined files are moved and `chmod 000`'d. Keep it on a partition an attacker can't fill to block quarantine. |

::: warning PTERODACTYL KEY TYPE
`pterodactyl.api_key` must be an **Application** API key (`ptla_…`), not a Client key (`ptlc_…`). It needs permission to read servers and toggle suspension.
:::

::: danger `delete_file` IS DESTROYING EVIDENCE
Prefer `quarantine_file` in your rules until you trust your false-positive rate — quarantine preserves the file (mode `000`) for inspection; `delete_file` is unrecoverable.
:::

---

## `whitelist`

Trusted targets exempt from **everything**. Whitelisted paths are never scanned or flagged, even if they also fall under a scan/watch path; whitelisted containers are never flagged, killed, or suspended.

```yaml
whitelist:
  paths: [/srv/trusted-builds]
  containers: ["3f4a9b2c1d", "my-admin-container"]
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `whitelist.paths` | list | *(empty)* | Matched by **prefix**: a whitelisted directory exempts everything beneath it (`/srv/trusted-builds` covers `/srv/trusted-builds/x/y`). Trailing slashes are trimmed. Use for known-good build dirs or admin script trees. |
| `whitelist.containers` | list | *(empty)* | Matched by **full ID, short ID, or exact name** (prefix comparison runs in both directions, so any unambiguous ID prefix works). Use for your own admin/monitoring containers. |

::: details Common mistake — whitelisting too broad a path
`whitelist.paths: [/var/lib/pterodactyl]` exempts **every** customer volume — you've just disabled most of Protection. Whitelist the narrowest path that solves your false positive.
:::

---

## `limits`

Optional resource-safety limits for the daemon itself. **Every field is opt-in and disabled at its zero value** — upgrades never change behavior. Turn these on if the daemon ever misbehaves on a huge or heavily-loaded node.

```yaml
limits:
  detector_timeout: 0s
  max_alerts_per_minute: 0
  max_setuid_walk_files: 0
  cache_directory_mtimes: false
  log_max_size_mb: 0
  log_max_backups: 0
```

| Path | Type | Default | Description |
| --- | --- | --- | --- |
| `limits.detector_timeout` | duration | `0s` (disabled) | Hard cap on how long a single detector may run per tick. Set e.g. `30s` if a slow detector (zipbomb sweeps on huge volumes) ever stalls the loop. |
| `limits.max_alerts_per_minute` | int | `0` (disabled) | Global alert rate limit across all channels. A last-resort flood brake; prefer [`alerts.batch`](#alerts-batch) for normal burst control. |
| `limits.max_setuid_walk_files` | int | `0` (disabled) | Caps how many files the exploit detector walks per setuid scan of its watch paths. |
| `limits.cache_directory_mtimes` | bool | `false` | Skip walking directories whose mtime hasn't changed since the last zip/exploit scan. Big I/O win on large, mostly-static volumes; tiny risk of missing a change that doesn't bump dir mtime. |
| `limits.log_max_size_mb` | int | `0` (disabled) | Rotate `general.log_file` at this size. Leave `0` if you use logrotate. |
| `limits.log_max_backups` | int | `0` | Rotated log files to keep when rotation is enabled. |

---

## `rules`

Rules map detected threats to enforcement. They're evaluated top-to-bottom; **every** matching rule contributes its actions (union). If you omit the section entirely, the built-in policy below is used.

```yaml
rules:
  - name: miners
    categories: [miner]
    min_severity: high
    actions: [neutralize, suspend_server, alert]
  - name: ddos
    categories: [ddos]
    min_severity: high
    actions: [neutralize, suspend_server, alert]
  - name: abuse
    categories: [abuse]
    min_severity: high
    actions: [neutralize, suspend_server, alert]
  - name: malware
    categories: [malware]
    min_severity: high
    actions: [quarantine_file, alert]
  - name: exploits
    categories: [exploit]
    min_severity: high
    actions: [neutralize, alert]
  - name: zipbombs
    categories: [zipbomb]
    min_severity: medium
    actions: [quarantine_file, alert]
  - name: portscans
    categories: [portscan]
    min_severity: medium
    actions: [alert]
  - name: catch-all
    categories: ["*"]
    min_severity: low
    actions: [alert]
```

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | Human label for the rule. |
| `categories` | list | One or more of `miner`, `portscan`, `ddos`, `zipbomb`, `exploit`, `abuse`, `malware`, or `*` (any). Unknown categories simply never match. |
| `min_severity` | enum | Minimum event severity for this rule to match. Empty/unrecognised parses to `medium` — a typo never silently disables a rule. |
| `actions` | list | Actions to run: `alert`, `neutralize`, `kill_container`, `stop_container`, `suspend_server`, `quarantine_file`, `delete_file`, `kill_process`, `log_only`. Each action also needs its backend enabled under [`actions`](#actions). |

::: tip THE `neutralize` ACTION
`neutralize` is smart: it kills the **container** for containerised threats and the **process** for host threats, so one rule works on Docker nodes and bare VPS hosts alike. See [Actions & Rules](../user-guide/actions-rules.md).
:::

::: warning RULES DON'T BYPASS `dry_run` OR BACKENDS
A matching rule only produces an action if (a) `general.dry_run` is `false` and (b) the action's backend is enabled under `actions:`. With `dry_run: true` every enforcement action is logged, not executed. And `malware` events only exist if [`onaccess`](#detectors-onaccess) (or YARA) is running with intel in place — the rule alone detects nothing.
:::

::: details Common mistake — trailing/missing list items
YAML lists need consistent indentation. `categories: [miner]` (flow) and the block form both work, but don't invent categories — unknown ones never match, and Protection won't warn you.
:::

---

## Full annotated example

The bundled starter config (`protection config init`) contains every option above with inline comments. Pair this reference with that file when tuning a node — and remember the starter is what sets `dry_run: true` and enables the core detectors; a from-scratch minimal config gets neither.

## Next steps

- **[CLI Reference →](../user-guide/cli.md)** — validate and apply changes.
- **[Actions & Rules →](../user-guide/actions-rules.md)** — design your enforcement policy.
