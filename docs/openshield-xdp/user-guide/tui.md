# TUI Guide

7 interactive screens. Built on Bubbletea.

| Key | Screen | Content |
|-----|--------|---------|
| `1` | Dashboard | Overview, packets, mitigation stats, protocol distribution |
| `2` | Traffic | Live PPS/BPS charts, peak statistics |
| `3` | Attacks | Attack state, duration, type, top offenders |
| `4` | Bans | Paginated ban table, search/filter, star system |
| `5` | Logs | Scrolling event log, search/filter |
| `6` | Status | Health badges, map utilization, kernel info |
| `7` | Config | Live YAML editor, validation, confirmation dialogs |

## Navigation

| Action | Key |
|--------|-----|
| Switch screen | `1`–`7` |
| Scroll | `j`/`k`, `PgUp`/`Dn` |
| Jump top/bottom | `g`/`G` |
| Search (bans/logs) | `/` |
| Clear search | `Esc` |
| Help overlay | `?` |
| Quit | `q`/`Ctrl+C` |

## Charts
Braille-resolution streamline graphs via ntcharts. 60s rolling Y-axis max with 10% headroom. 10-color gradient status bar (green→red).

## CLI variants
```bash
openshield load                 # Full TUI
openshield load --stats-off     # Daemon mode
openshield load --stats-minimal # Text snapshots
openshield-tui                  # Standalone viewer
```

## Next steps
[CLI Reference](/openshield-xdp/user-guide/cli) · [Configuration](/openshield-xdp/user-guide/configuration)

