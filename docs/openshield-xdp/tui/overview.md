# TUI Overview

7 interactive screens. Keyboard + mouse. Built on Bubbletea.

| Key | Screen |
|-----|--------|
| `1` | Dashboard — overview, packets, mitigation, protocols |
| `2` | Traffic — live PPS/BPS charts, peaks |
| `3` | Attacks — state, duration, top offenders |
| `4` | Bans — paginated table, search, stars |
| `5` | Logs — scrolling events, search, filter |
| `6` | Status — health, map utilization, kernel info |
| `7` | Config — live YAML editor, validation, confirmation |

## Charts

ntcharts braille-resolution streamline graphs. 60s rolling max with 10% headroom. 10-color gradient status bar.

## CLI Variants

```bash
openshield load                 # Full TUI
openshield load --stats-off     # Daemon mode
openshield load --stats-minimal # Text snapshots
```

