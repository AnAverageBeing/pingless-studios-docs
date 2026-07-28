# Configuration Reference

> **The definitive reference for every LiteShield XDP configuration value.**
> Generated from the actual defaults in `userspace/internal/config/defaults.go`
> and the example at `configs/liteshield.example.yaml`.

[[toc]]

---

## Overview

LiteShield is configured through a single YAML file at
`/etc/liteshield/liteshield.yaml`. The loader merges your file with built-in
defaults (Hosting/Balanced) — any key you omit retains its default value.
Validation runs at load time and rejects bad values before the XDP program
attaches.

**Configuration precedence (highest to lowest):**

1. YAML configuration file
2. Built-in Go defaults (`Default()` → Hosting preset, Balanced profile)

::: tip Edit with hot-reload
Use `sudo liteshield config` instead of editing the file by hand. It opens the
config in your `$EDITOR`, validates it, and applies the new thresholds to the
running instance — no detach, no protection gap.
:::

**Full annotated example:**

```yaml
# LiteShield XDP — example configuration
interface: eth0

# XDP attach mode: auto | native | generic
xdp_mode: auto

thresholds:
  pps: 200000        # max total packets/sec per source IP
  syn: 2000          # max TCP SYN/sec per source IP
  udp: 10000         # max UDP packets/sec per source IP
  icmp: 500          # max ICMP packets/sec per source IP
  new_src: 500       # max new source IPs/sec (global)
  flow_pps: 20000    # max packets/sec per flow
  flow_bps: 20000000 # max bytes/sec per flow (~20 MB/s)

ban_duration_sec: 300

discord:
  webhook_url: ""
  events: [rule_trigger, ip_banned, new_source]
  min_interval_sec: 10
```

---

## 1. Interface (`interface`)

### `interface`

| Property | Value |
|----------|-------|
| **YAML path** | `interface` |
| **Type** | `string` |
| **Default** | `"eth0"` |
| **Required** | Yes (must not be empty) |

The network interface the XDP program attaches to. All enforcement happens on
inbound packets arriving at this interface.

**When to change it:**

- Set it to your public-facing NIC (the one in your default route). The
  installer auto-detects this; a manual install defaults to `eth0`, which may
  not exist on predictable-name systems (`ens18`, `enp1s0`, …).
- Changing the interface requires a reload: `sudo liteshield unload && sudo
  liteshield load` (or restart the systemd service). Hot-reload only applies
  thresholds, not the attach point.

::: warning Common mistake
Attaching to `docker0`, `lo`, or a bridge instead of the physical NIC.
LiteShield only sees packets arriving at the attached interface — traffic on
other interfaces is unprotected.
:::

---

## 2. XDP Mode (`xdp_mode`)

### `xdp_mode`

| Property | Value |
|----------|-------|
| **YAML path** | `xdp_mode` |
| **Type** | `string` |
| **Default** | `"auto"` |
| **Valid values** | `"auto"`, `"native"`, `"generic"` (also empty = auto) |

How the XDP program attaches to the interface.

| Mode | Behavior | Performance |
|------|----------|-------------|
| `auto` | Try native (driver) first, fall back to generic | Best available |
| `native` | Driver mode only — fails if the NIC driver lacks XDP support | Best |
| `generic` | SKB mode — works on every interface | Slower, still pre-conntrack |

**When to change it:**

- Leave at `auto` in almost all cases.
- Set `native` if you want a hard failure (instead of a silent fallback) when
  the driver doesn't support XDP — useful in performance-critical deployments
  where generic mode would mask a problem.

::: info
Native-capable drivers include `ixgbe`, `i40e`, `mlx4/mlx5`, `bnxt`,
`virtio_net`, and most modern NICs. The active mode is shown in the TUI
header and in `ip link show dev <iface>`.
:::

---

## 3. Thresholds (`thresholds`)

Rate limits enforced **per source IP, per second**, on a 1-second sliding
window — except `new_src`, which is a **global** limit. Exceeding a threshold
drops the packet and (if `ban_duration_sec > 0`) starts an auto-ban.

### `thresholds.pps`

| Property | Value |
|----------|-------|
| **YAML path** | `thresholds.pps` |
| **Type** | `uint64` |
| **Default** | `200000` (Hosting/Balanced) |
| **Required** | Yes (must be > 0) |

Maximum total packets per second from a single source IP, across all
protocols. This is the catch-all ceiling that bounds any single talker.

**When to change it:**

- **Decrease** on small pipes (home lines, 100 Mbps VPS) where a single source
  should never legitimately exceed a few thousand PPS.
- **Increase** if you serve high-PPS legitimate traffic from concentrated
  sources (load balancer health checks, database replication, game server
  queries behind NAT).

::: warning Common mistake
Setting `pps` below your NAT gateway's legitimate rate. Hundreds of clients
behind one public IP share a single per-IP budget — size for the aggregate,
not per client.
:::

---

### `thresholds.syn`

| Property | Value |
|----------|-------|
| **YAML path** | `thresholds.syn` |
| **Type** | `uint64` |
| **Default** | `2000` (Hosting/Balanced) |

Maximum TCP SYN packets per second per source IP. This is the primary defense
against SYN floods — a single client almost never needs more than a handful of
new connections per second.

**When to change it:**

- **Decrease** (e.g., `200`–`500`) for web/API servers where one source
  opening 2,000 connections/sec is already pathological.
- **Increase** for proxy/CDN origins where a single edge node legitimately
  opens thousands of connections per second.

::: tip
SYN cookies at the kernel level complement this rule but don't stop the
packets from consuming NIC interrupts. The XDP drop happens first.
:::

---

### `thresholds.udp`

| Property | Value |
|----------|-------|
| **YAML path** | `thresholds.udp` |
| **Type** | `uint64` |
| **Default** | `10000` (Hosting/Balanced) |

Maximum UDP packets per second per source IP. UDP has no handshake, so
legitimate per-source rates vary widely by workload (DNS, game servers, VoIP).

**When to change it:**

- **Decrease** sharply (e.g., `500`) if you run no UDP services at all.
- **Increase** for game servers or media relays where one client can
  legitimately send tens of thousands of UDP packets per second.

---

### `thresholds.icmp`

| Property | Value |
|----------|-------|
| **YAML path** | `thresholds.icmp` |
| **Type** | `uint64` |
| **Default** | `500` (Hosting/Balanced) |

Maximum ICMP/ICMPv6 packets per second per source IP. Covers ping floods;
normal monitoring sends a few pings per second at most.

::: warning Don't set this to near-zero
Path MTU discovery and some health checks depend on ICMP. A floor of ~50–100
per source keeps diagnostics working while still killing floods.
:::

---

### `thresholds.new_src`

| Property | Value |
|----------|-------|
| **YAML path** | `thresholds.new_src` |
| **Type** | `uint64` |
| **Default** | `500` (Hosting/Balanced) |

**Global** limit of new (previously unseen) source IPs accepted per second.
This is the spoofed-source-flood killer: attacks that randomize source
addresses can't exhaust the per-IP tracking map faster than this rate.

**When to change it:**

- **Decrease** for servers with a stable client base (private APIs, game
  servers with known player counts).
- **Increase** for public websites at launch/marketing spikes, where hundreds
  of genuinely new visitors per second is normal.

::: info How it works
Only packets from sources not already in the `ip_stats` map count against
this limit. Established sources are unaffected, so an ongoing spoofed flood
slows the *arrival of new clients* rather than dropping existing ones.
:::

---

### `thresholds.flow_pps`

| Property | Value |
|----------|-------|
| **YAML path** | `thresholds.flow_pps` |
| **Type** | `uint64` |
| **Default** | `20000` (Hosting/Balanced) |

Maximum packets per second per **flow** (source IP + dest IP + protocol +
ports). Catches single-connection floods that stay under the per-IP ceiling.

**When to change it:**

- **Decrease** if individual connections should never be high-rate (HTTP APIs).
- **Increase** for bulk-transfer workloads (backups, replication) where one
  flow legitimately saturates the link.

---

### `thresholds.flow_bps`

| Property | Value |
|----------|-------|
| **YAML path** | `thresholds.flow_bps` |
| **Type** | `uint64` (bytes/sec) |
| **Default** | `20000000` (~20 MB/s, Hosting/Balanced) |

Maximum bytes per second per flow. The bandwidth twin of `flow_pps`.

::: warning Units are bytes, not bits
`flow_bps: 20000000` is ~20 MB/s ≈ 160 Mbps. A common mistake is entering a
megabit value and getting a limit 8× tighter than intended.
:::

---

## 4. Auto-Ban (`ban_duration_sec`)

### `ban_duration_sec`

| Property | Value |
|----------|-------|
| **YAML path** | `ban_duration_sec` |
| **Type** | `uint64` (seconds) |
| **Default** | `300` (5 minutes) |

How long a source is auto-banned after exceeding any per-IP threshold. During
the ban, **all** packets from that source are dropped — not just the ones over
the limit.

| Value | Behavior |
|-------|----------|
| `0` | Auto-ban **disabled** — over-limit packets are dropped, but the source can send again the next second |
| `300` | 5-minute ban (default) — short enough for false positives to recover |
| `3600`+ | Aggressive — for repeat-offender environments |

**When to change it:**

- **Increase** if attackers probe until the rate limiter lets them back in.
- **Set `0`** if you prefer pure rate limiting without state accumulation
  (e.g., very legitimate-burst-heavy workloads like game launches).

::: tip
Auto-bans live in the per-IP stats map, not the blacklist map. `liteshield
blacklist list` only shows *manual* bans; the TUI shows the live auto-ban
count under **Active bans**.
:::

---

## 5. Discord (`discord`)

Outbound webhook alerts. All alerting is in-process — no external
notification daemon.

### `discord.webhook_url`

| Property | Value |
|----------|-------|
| **YAML path** | `discord.webhook_url` |
| **Type** | `string` |
| **Default** | `""` (disabled) |

Discord webhook URL (`https://discord.com/api/webhooks/...`). Empty disables
all alerting regardless of the `events` list.

::: danger Keep this secret
Anyone with the webhook URL can post to your channel. The config file is
created with mode `0600` for this reason — don't widen its permissions, and
don't commit the live file to git.
:::

---

### `discord.events`

| Property | Value |
|----------|-------|
| **YAML path** | `discord.events` |
| **Type** | `[]string` |
| **Default** | `[]` |
| **Valid values** | `rule_trigger`, `ip_banned`, `new_source` |

Which events fire a webhook. Unknown event names fail validation at load time.

| Event | Fires when |
|-------|-----------|
| `rule_trigger` | Any rate-limit drop counter increases (SYN/UDP/ICMP/PPS) |
| `ip_banned` | The active auto-ban count increases |
| `new_source` | Packets are dropped by the global new-source limit |

---

### `discord.min_interval_sec`

| Property | Value |
|----------|-------|
| **YAML path** | `discord.min_interval_sec` |
| **Type** | `int` (seconds) |
| **Default** | `10` |

Minimum seconds between two alerts **of the same event type**. Prevents a
sustained flood from spamming your channel — during an attack you get one
alert per cooldown window instead of one per second.

**When to change it:**

- **Increase** (e.g., `60`) if you only need to know an attack started, not
  that it's ongoing.
- **Decrease** (e.g., `5`) while actively monitoring an incident.

::: warning
Values `<= 0` fall back to the 10-second default at send time — you cannot
disable the cooldown.
:::

---

## 6. Presets & Multipliers

The installer renders `liteshield.yaml` from a **preset** (base rates)
multiplied by a **traffic profile**. The same numbers live in
`userspace/internal/config/defaults.go` and `install.sh`.

### Base rates (Balanced = 1.0×)

| Preset | PPS | SYN | UDP | ICMP | New src/s | Flow PPS | Flow BPS |
|--------|-----|-----|-----|------|-----------|----------|----------|
| **Personal** | 50,000 | 500 | 2,000 | 200 | 100 | 5,000 | 5 MB/s |
| **Hosting** | 200,000 | 2,000 | 10,000 | 500 | 500 | 20,000 | 20 MB/s |
| **Enterprise** | 1,000,000 | 10,000 | 50,000 | 2,000 | 2,000 | 100,000 | 100 MB/s |

### Traffic profile multipliers

| Profile | Multiplier | Use case |
|---------|-----------|----------|
| **Strict** | 0.5× | Tight budgets, low-traffic services, maximum paranoia |
| **Balanced** | 1.0× | Default — sane starting point for most servers |
| **High** | 2.0× | Burst-heavy legitimate traffic (game servers, launches) |

### Effective values example (Personal × Strict)

| Threshold | Base | × 0.5 | Effective |
|-----------|------|-------|-----------|
| pps | 50,000 | | 25,000 |
| syn | 500 | | 250 |
| udp | 2,000 | | 1,000 |
| icmp | 200 | | 100 |
| new_src | 100 | | 50 |
| flow_pps | 5,000 | | 2,500 |
| flow_bps | 5,000,000 | | 2,500,000 |

::: tip Start Balanced, tune with data
Run Balanced for a week, watch `liteshield status` rule-drop counters during
peak hours, then tighten. If legitimate traffic never exceeds 10% of a
threshold, that threshold can come down — drops from real users are far more
expensive than a slightly permissive limit.
:::

---

## 7. Validation Rules

The loader rejects these before attach:

| Rule | Error |
|------|-------|
| `interface` empty | `interface must not be empty` |
| `xdp_mode` not auto/native/generic | `xdp_mode must be auto, native or generic` |
| `thresholds.pps` = 0 | `thresholds.pps must be > 0` |
| Unknown Discord event | `unknown discord event "..."` |

All other thresholds accept `0` (effectively disabling that rule's drops,
except where the rule has no zero-check — `syn`/`udp`/`icmp` at `0` drop all
matching packets, since any count exceeds zero).

::: warning Zero thresholds
Only `flow_pps` and `flow_bps` treat `0` as "disabled". Setting `syn: 0`,
`udp: 0`, or `icmp: 0` drops **every** packet of that protocol. Leave them at
their preset values unless you mean it.
:::
