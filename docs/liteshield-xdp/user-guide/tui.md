# TUI Guide

LiteShield ships a built-in live status screen — plain text with ANSI colors, no TUI frameworks, no dependencies. It starts automatically with `sudo liteshield load` and refreshes once per second.

[[toc]]

---

## Launching

```bash
sudo liteshield load              # attach + live screen
sudo liteshield load --stats-off  # attach + static screen (no per-second polling)
```

::: info The TUI is not the firewall
The XDP program is attached before the first frame renders and **stays
attached after you quit**. The TUI is a read-only view over the pinned BPF
maps — quitting never disables protection.
:::

---

## Layout

```
  _     _ _       ____  _     _      _     _   __  ______  ____
 | |   (_) |_ ___/ ___|| |__ (_) ___| | __| |  \ \/ /  _ \|  _ \
 | |   | | __/ _ \___ \| '_ \| |/ _ \ |/ _  |   \  /| | | | |_) |
 | |___| | ||  __/___) | | | | |  __/ | (_| |   /  \| |_| |  __/
 |_____|_|\__\___|____/|_| |_|_|\___|_|\__,_|  /_/\_\____/|_|

 ◆ LiteShield XDP ACTIVE  eth0  up 01:12:44

 ▸ Throughput
   PPS  84.2k    BPS  512.30 MB/s

 ▸ Packets
   Passed   301442981
   Dropped  1204556

 ▸ Defense
   Active bans  3
   Rule drops   SYN 812110 | UDP 390021 | ICMP 2425 | PPS 0 | NewSrc 0
   Lists        whitelist 1204 | blacklist 88

 Press Ctrl-C to exit — LiteShield keeps running.
```

The screen has a banner, a status bar, and three sections:

| Section | Shows |
| ------- | ----- |
| **Status bar** | `ACTIVE` indicator, protected interface, uptime (since `load`) |
| **Throughput** | Live packets/sec and bytes/sec, computed from per-second counter deltas |
| **Packets** | Cumulative passed and dropped counters since attach |
| **Defense** | Active auto-bans, per-rule drop counters, whitelist/blacklist hit counts |

---

## Color Theme

The theme is deliberately minimal — **blue, red, white**, with semantic accents:

| Element | Color | Meaning |
| ------- | ----- | ------- |
| Banner, section markers (`▸`), interface name | **Blue** (bold) | Branding / structure |
| Values (PPS, BPS, counters) | **White** (bold) | Primary data |
| `ACTIVE` | Green | Program attached and enforcing |
| Dropped packets | **Red** when > 0, green when 0 | Drops are happening vs. all clean |
| Active bans | Yellow when > 0, green when 0 | Attention vs. idle |
| Labels, hints, uptime | Gray | Secondary information |

::: tip Reading drops at a glance
If **Dropped** is green, nothing is being filtered. Red means LiteShield is
actively mitigating — check the **Rule drops** line to see *which* rule is
firing (a SYN flood shows up under `SYN`, a reflection attack under `UDP`).
:::

---

## What Each Section Shows

### Status bar

`◆ LiteShield XDP ACTIVE  eth0  up 01:12:44`

- **ACTIVE** — the XDP program is attached and the `enabled` flag is set in `config_map`
- **Interface** — the attach point from your config, with its mode shown at load time (`native` or `generic`)
- **Uptime** — time since this `load` invocation (not since boot)

### Throughput

Per-second rates derived from deltas between consecutive `global_stats_map`
reads. `PPS` uses compact suffixes (`84.2k`, `1.20M`); `BPS` uses binary units
(`512.30 MB/s`).

### Packets

Cumulative counters since the program was attached. `Passed + Dropped` equals
total `rx` packets the parser recognized as IP traffic.

### Defense

- **Active bans** — sources currently inside their auto-ban window (from
  threshold violations) plus manual timed bans still in effect
- **Rule drops** — cumulative drops attributed to each rule:
  `SYN` / `UDP` / `ICMP` / `PPS` (per-IP thresholds) and `NewSrc` (global
  new-source limit)
- **Lists** — cumulative packets matched by the whitelist (passed) and
  blacklist (dropped)

---

## Keyboard Controls

There is exactly one control — by design:

| Key | Action |
| --- | ------ |
| `Ctrl-C` | Exit the status screen. The XDP program **keeps running**. |

The cursor is hidden while the screen renders and restored on exit.

::: warning Want to actually stop protection?
`Ctrl-C` is not enough. Run `sudo liteshield unload`, or
`sudo systemctl stop liteshield-loader.service` if you're running under
systemd.
:::

---

## Static Mode (`--stats-off`)

On very small machines (or over slow serial/SSH links) you can skip the
per-second map polling entirely:

```bash
sudo liteshield load --stats-off
```

```
LiteShield XDP is protecting eth0 (native mode).
XDP stays loaded after you quit. Use `liteshield unload` to stop.

Stats display disabled (--stats-off). Press Ctrl-C to exit.
```

The firewall enforces identically — only the display is static. Use
`sudo liteshield status` from another terminal for on-demand counters.

---

## systemd and the TUI

The installed service runs headless:

```ini
ExecStart=/usr/local/bin/liteshield load --no-tui --config /etc/liteshield/liteshield.yaml
```

`--no-tui` attaches the program and exits; the BPF link stays pinned at
`/sys/fs/bpf/liteshield/link`, so protection persists with no process at all.
To watch stats on a systemd-managed host, use `sudo liteshield status` for a
one-shot snapshot — running `liteshield load` while already loaded fails with
`LiteShield is already loaded (run `liteshield unload` first)`.
