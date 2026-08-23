---
title: Configuration Reference
description: Every GameFilter XDP config value documented — YAML path, type, default, meaning, when to change it, and common mistakes. Covers all built-in validators, per-filter fields, OpenShield sync modes, and the API section.
---

# Configuration Reference

Config file: `/etc/gamefilter/gamefilter.yaml` (YAML, `chmod 600` — it contains the API key).

Every value below is optional — missing keys fall back to the defaults shown. After editing, apply with `sudo gamefilter reload` (hot, no detach) or `POST /api/v1/reload`.

```yaml
interface: eth1
xdp_mode: auto
enabled: true
default_action: drop

filters:
  - name: mc-java
    protocol: tcp
    ports: ["25565"]
    validator: mc_java
    min_size: 7
    max_size: 800
    admission_ttl_sec: 300
    ban_sec: 300
    max_failures: 8

whitelist: []
blacklist: []

sync:
  openshield:
    enabled: false
    mode: api
    url: "http://127.0.0.1:9100"
    api_key: ""
    file: /var/lib/openshield/lists.json
    interval_sec: 15

api:
  enabled: true
  listen: 127.0.0.1:9300
  api_key: ""
  rate_limit_per_sec: 10
  whitelist: []
```

[[toc]]

---

## Top level

### `interface`

| | |
|---|---|
| Type | string |
| Default | `"eth1"` |

The interface the XDP program attaches to. This must be the **private NIC** facing your game servers, not the public edge.

**When to change:** always, at install — the installer auto-detects from your default route and asks.

**Common mistakes:** attaching to the public interface (GameFilter is designed to run behind an edge firewall like OpenShield-XDP), or attaching to the interface you SSH through without an `ssh` filter or whitelist entry.

### `xdp_mode`

| | |
|---|---|
| Type | string |
| Default | `"auto"` |

Reserved. The loader currently always behaves as `auto`: it attempts a **native** (driver) attach first and falls back to **generic** (SKB) mode if the NIC driver rejects it. The mode actually used is recorded in `/var/lib/gamefilter/state.json` and shown by `gamefilter status`.

**Common mistakes:** assuming you can force a mode here — you can't yet; the value is parsed but not consulted.

### `enabled`

| | |
|---|---|
| Type | boolean |
| Default | `true` |

Global kill switch, mirrored into the kernel `CONFIG` map. When `false`, the XDP program passes every packet immediately — the attachment stays in place but filters nothing.

**When to change:** emergency "stop filtering without detaching" — can be flipped live via `POST /api/v1/config` with `{"enabled": false}`.

### `default_action`

| | |
|---|---|
| Type | string: `drop` \| `pass` |
| Default | `"drop"` |

What happens to traffic whose destination port **no filter owns**:

- `drop` — only traffic that matches a filter (or the whitelist) passes. Recommended for a dedicated game NIC.
- `pass` — filters protect their ports; everything else flows through.

**Common mistakes:** `drop` on an interface that also carries SSH/monitoring/other services without filters for them — you will lock those services out. Anything else (typos like `"deny"`) is rejected by `POST /api/v1/config` and treated as unrecognized on load.

---

## `filters:` — per-filter fields

A list of up to **64 filters** (`MAX_RULES`). Each filter owns a set of ports for one protocol and validates first packets against it.

```yaml
filters:
  - name: mc-bedrock
    protocol: udp
    ports: ["19132"]
    validator: raknet
    min_size: 25
    max_size: 1500
    admission_ttl_sec: 300
    ban_sec: 300
    max_failures: 8
```

### `filters[].name`

| | |
|---|---|
| Type | string |
| Default | `""` |

Human label used in `gamefilter status`, the API, and admissions listings. Not used by the kernel — position in the list determines the rule slot.

**Common mistakes:** reordering the list between reloads and confusing yourself — per-filter stats are keyed by list position (slot), not name.

### `filters[].protocol`

| | |
|---|---|
| Type | string: `tcp` \| `udp` |
| Default | `"udp"` |

L4 protocol this filter owns. Port ownership is per-protocol: TCP 25565 and UDP 25565 are independent entries in the port table, so one filter never shadows the other protocol's traffic.

**Common mistakes:** pointing a TCP validator at `protocol: udp` (or vice versa) — load fails fast with `unknown protocol` only for values other than `tcp`/`udp`; a wrong-but-valid choice loads fine and then drops everything on that port.

### `filters[].ports`

| | |
|---|---|
| Type | list of strings |
| Default | `[]` |

Ports this filter owns. Three forms, freely mixed:

```yaml
ports: ["25565"]                # single
ports: ["27015", "27016"]       # list
ports: ["27015-27050"]          # inclusive range
```

Rules: ports 1–65535, ranges must be ascending and at most **4096 ports wide**.

**Common mistakes:** quoting is required (`"25565"`, not `25565` — the field is a list of strings); overlapping two filters on the same port+protocol (the later filter wins the port — the earlier one silently loses it).

### `filters[].validator`

| | |
|---|---|
| Type | string (validator id) |
| Default | `"none"` |

Which protocol proof the first data packet from an unadmitted source must pass. One of:

| Validator | L4 | First-packet proof | Recommended bounds |
| --------- | -- | ------------------ | ------------------ |
| `mc_java` | TCP | Full handshake frame: varint length that exactly consumes the payload, packet id 0, protocol varint, address string, port, next-state 1\|2. Legacy `FE 01` ping accepted. | `min_size: 7`, `max_size: 800` |
| `raknet` | UDP | RakNet offline magic at the exact offset for unconnected ping (`0x01`) or open-connection-request 1/2 (`0x05`, `0x07`). | `min_size: 25`, `max_size: 1500` |
| `fivem` | UDP | `0xFFFFFFFF` + `getinfo`/`getstatus`/`connect`, or ENet CONNECT (low nibble 2, ≥52 bytes). **UNVERIFIED upstream.** | `min_size: 9`, `max_size: 1500` |
| `source_engine` | UDP | `0xFFFFFFFF` + A2S type byte (`T`/`U`/`V`/`W`/`i`/`q`); `T` additionally requires `Source Engine Query\0`. | `min_size: 5`, `max_size: 1400` |
| `ssh_banner` | TCP | Payload begins with `SSH-`, 8–255 bytes (RFC 4253). | `min_size: 8`, `max_size: 255` |
| `tcp_generic` | TCP | Size bounds + NULL/Xmas/FIN-scan flag rejection. | `min_size: 1`, `max_size: 1460` |
| `udp_generic` | UDP | Size bounds only. | `min_size: 1`, `max_size: 1400` |
| `none` | both | Size bounds only (same as the generic validators without flag checks). | — |

An unknown validator name fails the load/reload with `unknown validator '<name>'`.

**When to change:** widen to `udp_generic`/`tcp_generic` if a strict validator false-drops your traffic (the `fivem` ENet CONNECT check is marked UNVERIFIED upstream) — keep the size bounds tight when you do.

### `filters[].min_size`

| | |
|---|---|
| Type | integer (bytes) |
| Default | `1` |

Minimum L4 payload size for the validating (first) packet. Payloads smaller than this fail validation.

**When to change:** set from the protocol's smallest legal first frame (e.g. 7 for a degenerate MC Java handshake, 25 for RakNet — the unconnected ping is exactly 33 bytes).

**Common mistakes:** setting it above real client traffic (e.g. proxies that coalesce or pad) — false drops; or leaving it at 1 for a strict validator, which lets tiny garbage reach the validator (harmless, it still fails the magic checks).

### `filters[].max_size`

| | |
|---|---|
| Type | integer (bytes) |
| Default | `1500` |

Maximum L4 payload size. `0` disables the upper bound. Payloads larger than this fail validation.

**When to change:** raise for setups with jumbo frames, MTU probing (RakNet open-connection-request-1 pads up to ~1464 bytes of payload), or modded servers.

**Common mistakes:** setting it tighter than the protocol's MTU probes — the classic false-drop cause for Bedrock (`1500` covers the 1464-byte probe).

### `filters[].admission_ttl_sec`

| | |
|---|---|
| Type | integer (seconds) |
| Default | `300` |

Sliding admission window. A source that passes validation once is admitted for this long, and **every subsequent packet refreshes the deadline** — active players stay admitted forever; idle ones fall out after the TTL and must revalidate.

**When to change:** raise for long-lived protocols where revalidation is annoying (SSH uses 3600 in the example); lower for high-churn query-only ports.

### `filters[].ban_sec`

| | |
|---|---|
| Type | integer (seconds) |
| Default | `0` |

Temp-ban length once a source hits `max_failures` failed validations inside a 60-second window. `0` = never ban, just drop.

**When to change:** set `0` while tuning a new filter so mistakes drop packets instead of banning players; 300–600 is the normal production range.

### `filters[].max_failures`

| | |
|---|---|
| Type | integer |
| Default | `8` |

Failed validations inside a sliding 60-second window that trigger the temp-ban. Banning only happens when **both** `ban_sec > 0` and `max_failures > 0`. With `max_failures: 0`, failure accounting is skipped entirely.

**Common mistakes:** setting it to 1 — a single fragmented/corner-case packet from a real client then earns a ban.

---

## `whitelist:` / `blacklist:`

| | |
|---|---|
| Type | list of IP strings (v4 or v6) |
| Default | `[]` |

Static lists seeded into the kernel maps **at load time**. Whitelisted sources bypass everything (checked first, before the blacklist); blacklisted sources are dropped permanently (config-seeded entries never expire).

These are the **secondary** list source — the primary source for a fleet is [OpenShield sync](#sync-openshield) below, and live entries managed via the CLI/API are never removed by sync.

::: warning Reload does not re-seed lists
`gamefilter reload` / `POST /api/v1/reload` hot-apply filters, port ownership, and globals — but **not** these lists. Changes to `whitelist:`/`blacklist:` in the YAML take effect on the next `gamefilter load` (or add them live with the CLI/API instead).
:::

---

## `sync.openshield` — OpenShield-XDP list sync

Polls OpenShield-XDP and mirrors its whitelist/blacklist into GameFilter's kernel maps. Adds **and removals** both propagate (each cycle diffs against the previous sync). Locally added entries (CLI/API) always win — sync never touches them.

```yaml
sync:
  openshield:
    enabled: false
    mode: api
    url: "http://127.0.0.1:9100"
    api_key: ""
    file: /var/lib/openshield/lists.json
    interval_sec: 15
```

### `sync.openshield.enabled`

| | |
|---|---|
| Type | boolean |
| Default | `false` |

Master switch. The sync loop runs inside `gamefilter daemon` (the `gamefilter-api.service` unit), so sync requires the daemon to be running even if the HTTP API itself is disabled.

### `sync.openshield.mode`

| | |
|---|---|
| Type | string: `api` \| `file` \| `maps` |
| Default | `"api"` |

How lists are fetched:

- `api` — polls `{url}/api/v1/lists` with Bearer auth. Expects `{"whitelist": [...], "blacklist": [...]}`.
- `file` — reads a JSON export of the same shape from `file`.
- `maps` — best-effort direct read of OpenShield's pinned ban maps (`/sys/fs/bpf/openshield/pinned_bans_map` or `…/maps/pinned_bans_map`). **IPv4 blacklist only** — OpenShield's whitelist is bloom/LPM and cannot be enumerated.

An unknown mode logs `unknown sync mode` each cycle and syncs nothing.

### `sync.openshield.url`

| | |
|---|---|
| Type | string (URL) |
| Default | `"http://127.0.0.1:9100"` |

OpenShield metrics endpoint base URL (`api` mode only). The path `/api/v1/lists` is appended; a trailing slash is handled.

### `sync.openshield.api_key`

| | |
|---|---|
| Type | string |
| Default | `""` |

OpenShield API key (`osk_…`, see `openshield key`) sent as a Bearer token in `api` mode. Masked as `"***"` in `GET /api/v1/config` responses.

### `sync.openshield.file`

| | |
|---|---|
| Type | string (path) |
| Default | `"/var/lib/openshield/lists.json"` |

JSON export path for `file` mode: `{"whitelist": ["1.2.3.4", …], "blacklist": […]}`.

### `sync.openshield.interval_sec`

| | |
|---|---|
| Type | integer (seconds) |
| Default | `15` |

Poll interval. Values below 5 are clamped to 5.

**Common mistakes:** enabling `maps` mode and expecting whitelist entries (impossible by design); pointing `api` mode at GameFilter's own API port (9300) instead of OpenShield's (9100).

---

## `api:` — management API

Everything is managed through this API (no TUI by design). It runs inside `gamefilter daemon`.

```yaml
api:
  enabled: true
  listen: 127.0.0.1:9300
  api_key: ""
  rate_limit_per_sec: 10
  whitelist: []
```

### `api.enabled`

| | |
|---|---|
| Type | boolean |
| Default | `true` |

When `false`, `gamefilter daemon` skips the HTTP server entirely and only runs OpenShield sync (idling otherwise).

### `api.listen`

| | |
|---|---|
| Type | string (`host:port`) |
| Default | `"127.0.0.1:9300"` |

Bind address. Keep it on `127.0.0.1` unless you also set `api.whitelist` — the only other protections are the API key and the rate limit.

### `api.api_key`

| | |
|---|---|
| Type | string (min 8 chars) |
| Default | `""` |

Bearer token for every endpoint (including `/health`). The installer generates `gf_` + 32 hex chars. **The daemon refuses to start without a key of at least 8 characters.** Manage it with `sudo gamefilter key [set|regen]`; masked as `"***"` in API config reads.

### `api.rate_limit_per_sec`

| | |
|---|---|
| Type | integer |
| Default | `10` |

Per-source-IP token bucket: `rate_limit_per_sec` tokens per second, burst capacity 2× the rate. Over-limit requests get `429`. `0` disables rate limiting. Checked **after** the key, so it only throttles authenticated clients.

### `api.whitelist`

| | |
|---|---|
| Type | list of IPs / CIDRs |
| Default | `[]` (any source) |

Source-IP allowlist for the API itself, checked before the key (`403` on mismatch). Accepts single IPs and CIDRs, v4 and v6:

```yaml
api:
  listen: 0.0.0.0:9300
  whitelist: ["10.0.0.5", "192.168.1.0/24"]
```

**Common mistakes:** exposing `listen` on a routable address with an empty whitelist; mixing v4 CIDRs with v6 clients (a v4 rule never matches a v6 source and vice versa).

---

## Complete example

The shipped default — filters for Minecraft Java/Bedrock, Geyser, FiveM, Source engine, and SSH:

```yaml
interface: eth1
xdp_mode: auto
enabled: true
default_action: drop

filters:
  - name: mc-java
    protocol: tcp
    ports: ["25565"]
    validator: mc_java
    min_size: 7
    max_size: 800
    admission_ttl_sec: 300
    ban_sec: 300
    max_failures: 8

  - name: mc-bedrock
    protocol: udp
    ports: ["19132"]
    validator: raknet
    min_size: 25
    max_size: 1500
    admission_ttl_sec: 300
    ban_sec: 300
    max_failures: 8

  - name: geyser
    protocol: udp
    ports: ["19133"]
    validator: raknet
    min_size: 25
    max_size: 1500
    admission_ttl_sec: 300
    ban_sec: 300
    max_failures: 8

  - name: fivem
    protocol: udp
    ports: ["30120"]
    validator: fivem
    min_size: 9
    max_size: 1500
    admission_ttl_sec: 600
    ban_sec: 300
    max_failures: 8

  - name: source-engine
    protocol: udp
    ports: ["27015-27050"]
    validator: source_engine
    min_size: 5
    max_size: 1400
    admission_ttl_sec: 600
    ban_sec: 300
    max_failures: 8

  - name: ssh
    protocol: tcp
    ports: ["22"]
    validator: ssh_banner
    min_size: 8
    max_size: 255
    admission_ttl_sec: 3600
    ban_sec: 600
    max_failures: 5

whitelist: []
blacklist: []

sync:
  openshield:
    enabled: false
    mode: api
    url: "http://127.0.0.1:9100"
    api_key: ""
    file: /var/lib/openshield/lists.json
    interval_sec: 15

api:
  enabled: true
  listen: 127.0.0.1:9300
  api_key: ""
  rate_limit_per_sec: 10
  whitelist: []
```

Generic fallbacks for non-game services (commented out in the shipped config):

```yaml
  - name: tcp-generic
    protocol: tcp
    ports: ["80", "443"]
    validator: tcp_generic
    min_size: 1
    max_size: 1460
    admission_ttl_sec: 300
    ban_sec: 0
    max_failures: 8
  - name: udp-generic
    protocol: udp
    ports: ["53"]
    validator: udp_generic
    min_size: 1
    max_size: 1400
    admission_ttl_sec: 60
    ban_sec: 0
    max_failures: 8
```
