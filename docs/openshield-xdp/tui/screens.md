# TUI Screens

Detailed descriptions of all 7 TUI screens and their data sources.

---

## 1. Dashboard (`screenDashboard`)

The landing screen — a high-level overview of the firewall's current state.

### Layout

| Section | Content |
|---------|---------|
| **Traffic panel** | Current PPS, BPS, peak PPS, average PPS |
| **Packets panel** | Total/passed/dropped counters, pass% and drop% |
| **Mitigation panel** | Active ban count, suspicious IP count, new sources/s, attack state |
| **Protocol panel** | TCP/UDP/ICMP PPS with percentages, SYN PPS |
| **PPS chart** | Braille streamline chart with cur/peak/avg labels |
| **Panic alert** | Shown only when panic breaker is active — red `⚡ PANIC MODE` with bulk-drop percentage |
| **Drop paths** | Breakdown of where dropped packets went (Banned, RateDrop, PanicDrop, DNS Amp, etc.) |

### Wide vs narrow

- **Wide terminals (≥100 cols):** Traffic, Packets, and Mitigation panels side by side; Protocol panel below
- **Narrow terminals (<100 cols):** Traffic + Protocol left column, Packets + Mitigation right column

### Data source

`Snapshot.Global`, `Snapshot.Attack`, `Snapshot.Bans`, `Snapshot.Traffic`, `Snapshot.Prof` (drop paths)

---

## 2. Traffic (`screenTraffic`)

Deep-dive into traffic metrics with live charts.

### Layout

| Section | Content |
|---------|---------|
| **Live Metrics panel** | Current PPS, BPS, TCP PPS, UDP PPS, ICMP PPS, SYN PPS |
| **Peak Statistics panel** | Peak PPS, peak BPS, average PPS, average BPS |
| **PPS chart** | Braille streamline chart with cur/peak/avg |
| **BPS chart** | Braille streamline chart with cur/peak/avg |
| **Protocol Distribution** | TCP/UDP/ICMP/SYN with horizontal bar charts showing relative proportion |
| **Drop paths** | Drop path breakdown |

### Protocol bar charts

Each protocol shows a filled-bar visualization:
```
TCP   ████████████  85.2%  1250
UDP   ████          12.3%   180
ICMP  █              2.5%    35
```

Bar width adapts to terminal width. The bar is rendered using lipgloss-colored block characters.

### Data source

`Snapshot.Traffic`, `Snapshot.Global`, `Snapshot.Prof`

---

## 3. Attacks (`screenAttacks`)

Active attack details and top offender list.

### Normal state

When no attack is active (`attack.state != "under_attack"`):
```
[OK] No active attack

All traffic is within baseline parameters.
The system is operating normally.
```

### Under attack

| Field | Description |
|-------|-------------|
| State | `UNDER ATTACK` (red) |
| Type | Attack classification (SYN flood, UDP amp, etc.) |
| Duration | How long the attack has been ongoing |
| Started | UTC timestamp of attack onset |
| Current PPS/BPS | Current traffic levels vs baseline |
| Spike factor | Multiplier above baseline (e.g., 3.5×) |
| New sources/s | Rate of new IPs appearing |
| Packets dropped | Total drops during this attack |
| IPs banned | Bans triggered by this attack |

### Top offenders table

| Column | Description |
|--------|-------------|
| # | Rank |
| IP | Source IP address |
| PPS | Current packets/s |
| SYN | SYN packets/s |
| Score | Cumulative suspicion score |
| Status | `SUSPECT` (yellow) or `BANNED` (red) |

Paginated: `n`/`p` navigate pages. Page size adapts to terminal height (~5–20 rows).

### Attack timeline

Shows state transitions during the attack:
```
15:04:05  normal -> under_attack (spike detected)
15:04:10  New source flood engaged
15:05:30  Auto subnet ban triggered for 10.0.0.0/24
```

### Data source

`Snapshot.Attack`, `Snapshot.TopOffenders`, `Snapshot.AttackTimeline`

---

## 4. Bans (`screenBans`)

Active ban management with search and statistics.

### Ban table

| Column | Description |
|--------|-------------|
| # | Row number |
| IP | Banned IP address |
| Reason | Ban reason (e.g., "PPS exceeded", "TCP SYN flood") |
| Score | Suspicion score at ban time |
| Remaining | Time until ban expires (countdown) or "permanent" |
| Star | Repeat-offender star rating (★ to ★★★★★) |

### Search

Press `/` to enter search mode. Type an IP address or reason substring to filter. Matched count shown in header. Press `Esc` to clear.

### By Reason summary

Below the ban table, a grouped summary shows ban distribution by reason:
```
By Reason
  PPS exceeded             12 (60.0%)
  TCP SYN flood             5 (25.0%)
  UDP amplification         3 (15.0%)
```

### Pagination

`n`/`p` for next/previous page. Mouse scroll wheel also works. Page size adapts to terminal height.

### Star system

Repeat offenders get escalating ban durations via star ratings:
- ★ (1 star) = ban_duration × 1
- ★★ = ban_duration × 2
- ★★★ = ban_duration × 4
- ★★★★ = ban_duration × 8
- ★★★★★ = ban_duration × 16
- ★★★★★★ = ban_duration × 32

Stars decay after `star_decay_seconds` of clean behavior.

### Data source

`Snapshot.Bans`

---

## 5. Logs (`screenLogs`)

Combined system log and security event viewer.

### Entry types

| Prefix | Meaning |
|--------|---------|
| `BAN_TRIGGERED` | Red — an IP was banned |
| `ERROR` | Red — system errors |
| `NEW_SOURCE_FLOOD` | Yellow — new source flood detected |
| `WARN` | Yellow — warnings |
| `INFO` | Default — informational messages |

Each entry shows: `HH:MM:SS  LEVEL  Message`

### Navigation

Full vi-style keybindings:
- `j`/`k` or `↓`/`↑` — scroll one line
- `PgDn`/`PgUp` — scroll one page
- `g` — jump to top
- `G` — jump to bottom
- `w` — toggle line wrapping (long lines truncated by default)

### Search

Press `/` to search. Matches against both the message text and log level. `Esc` clears the filter.

### Rendering

Visible-window optimization: only the lines currently on screen are rendered (via `logOffset` and `visibleLines`), not the entire log buffer. This keeps render times constant regardless of total log size.

### Data source

`Snapshot.RecentEvents` + `Snapshot.Logs` — merged and sorted by timestamp

---

## 6. Status (`screenStatus`)

System health, configuration, and map utilization overview.

### System panel

| Field | Source |
|-------|--------|
| Version | `Snapshot.System.Version` |
| Interface | `Snapshot.System.Interface` |
| XDP Mode | `Snapshot.System.XDPMode` |
| Kernel | `Snapshot.System.Kernel` (uname) |
| Uptime | `Snapshot.System.Uptime` (formatted) |

### Health panel

| Badge | Condition |
|-------|-----------|
| Loader: healthy | Loader process is running and pushing snapshots |
| XDP Program: attached | BPF program pin exists, XDP attached to NIC |
| Telemetry: connected | Socket is receiving data |
| Event Pipe: OK | Event ring buffer not overflowing |

Badges use ● green/yellow/red indicators.

### Statistics panel

Total/passed/dropped counters with percentages.

### Map Utilization

Progress bars showing fill levels of each BPF map:
```
ip_stats   ████░░░░░░  35,201 / 100,000
ban        █░░░░░░░░░     247 / 50,000
whitelist  ░░░░░░░░░░       0 / 10,000
events     256KB ring buffer
```

### Data source

`Snapshot.System`, `Snapshot.Global`, `Snapshot.Maps`, `Snapshot.Prof`

---

## 7. Config (`screenConfig`)

Live configuration browser and editor.

### Browse mode

Scrollable table with columns:
| Setting | Value | Range | Description |
|---------|-------|-------|-------------|

- `↑`/`↓` or `j`/`k` — navigate fields
- `Enter` — edit selected field (runtime-safe only)
- `r` — toggle showing read-only fields
- `a` — preview and apply pending changes
- `d` — discard all pending changes
- `x` — revert individual field (remove pending change)

Fields are organized by category: Static, Validation, Dynamic, Whitelist, Maps, System, Telemetry.

### Edit mode

When editing a field:
- Displays current value as pre-filled input
- `Enter` saves and validates (range checks for int/float, true/false for bool)
- `Esc` cancels
- Validation errors shown in red inline

### Preview mode

Shows all pending changes before applying:
```
Pending Changes (y=apply, n=cancel)
──────────────────────────────────
  static.pps_threshold -> 500
  dynamic.spike_percentage -> 150
```

### Apply flow

1. Changes are collected in `pendingChanges` map
2. Press `a` to preview
3. Press `y` to confirm (dialog: "Apply N config change(s)?")
4. JSON `config_update` message sent over Unix socket to loader
5. Loader updates BPF config map
6. Success/error response displayed

### Pending change indicators

- Fields with pending changes show `*` after the value in yellow
- The cursor line with pending changes is highlighted yellow
- Read-only fields are dimmed and marked `[RO]`

### Read-only fields

Fields that can't be changed at runtime (require XDP reattach or map recreation):
- `interface`, `xdp_mode`
- `maps.ip_stats_max`, `maps.ban_max`, `maps.whitelist_max`, `maps.event_buffer_size`
- `dynamic.baseline_window`, `dynamic.baseline_update_interval`, `dynamic.baseline_alpha`
- `telemetry.poll_interval`

Toggle visibility with `r`.

### Data source

Reads the YAML config file at `/etc/openshield/openshield.yaml` and parses it into typed fields matching the runtime `FieldMeta` metadata.

---

## Next steps

[Keyboard Shortcuts](/openshield-xdp/tui/shortcuts) · [TUI Overview](/openshield-xdp/tui/overview) · [CLI Reference](/openshield-xdp/cli/commands)
