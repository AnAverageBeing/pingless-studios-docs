# Terminal UI (TUI)

Bandwidth Manager ships with a fully interactive terminal interface for real-time monitoring. No browser, no Grafana — just open a terminal and run `bandwidth top`.

[[toc]]

## Launching

```bash
bandwidth top [--interval <seconds>]
```

| Option       | Default | Description                              |
| ------------ | ------- | ---------------------------------------- |
| `--interval` | `2`     | Poll interval in seconds (minimum `0.5`) |

The TUI connects to the running daemon. If the daemon isn't running, it will offer to start it:

```
$ bandwidth top
✘ Daemon not running. Start it now? [Y/n]: y
✔ Daemon started — connecting…
```

## Keyboard Shortcuts

::: tip Mnemonics
Most shortcuts mirror tools you already know: `j`/`k` from Vim, `g`/`G` from less, `q` from everything.
:::

### Navigation

| Key              | Action                                           |
| ---------------- | ------------------------------------------------ |
| <kbd>↑</kbd> <kbd>↓</kbd> | Move selection up/down in the interface list |
| <kbd>j</kbd> <kbd>k</kbd> | Vim-style: move selection down/up           |
| <kbd>g</kbd>              | Jump to top of interface list               |
| <kbd>G</kbd>              | Jump to bottom of interface list            |

### Panel Focus

| Key                            | Action                        |
| ------------------------------ | ----------------------------- |
| <kbd>←</kbd> <kbd>h</kbd>     | Focus left panel (interfaces) |
| <kbd>→</kbd> <kbd>l</kbd>     | Focus right panel (graph)     |

### Filtering & Sorting

| Key              | Action                                             |
| ---------------- | -------------------------------------------------- |
| <kbd>Tab</kbd>   | Open the filter/search bar                         |
| <kbd>s</kbd>     | Cycle sort order: `name` → `rx` → `tx` → `limit %` |

Filter syntax inside the search bar:

```
eth          → filter by interface name containing "eth"
>50mbps      → show only interfaces exceeding 50 Mbps
!docker      → exclude entries containing "docker"
```

Press <kbd>Esc</kbd> to clear the filter.

### Time Window

| Key              | Period        |
| ---------------- | ------------- |
| <kbd>1</kbd>     | 1 minute      |
| <kbd>5</kbd>     | 5 minutes     |
| <kbd>t</kbd>     | 15 minutes    |
| <kbd>d</kbd>     | 1 day         |

The graph and stats panel update to reflect the selected window. A longer window smooths spikes; a shorter one reveals bursts.

### Global

| Key              | Action                              |
| ---------------- | ----------------------------------- |
| <kbd>q</kbd>     | Quit (or <kbd>Ctrl</kbd>+<kbd>C</kbd>) |
| <kbd>?</kbd>     | Show the help overlay               |

---

## Layout

The TUI is divided into four sections:

```
┌── 1. Header ──────────────────────────────────────────────────────┐
│  Bandwidth Manager · live · 2s interval · 2026-06-30 09:18 UTC   │
├── 2. Speed Bar ───────────────────────────────────────────────────┤
│  ██████████████████████████████████████░░░░░░░░░░░░░░  312 Mbps  │
├──────────────────────────────┬────────────────────────────────────┤
│  3. Left Panel (35%)         │  4. Right Panel (65%)              │
│  ┌─ Interfaces ────────────┐ │  ┌─ web-app ────────────────────┐ │
│  │ ● eth0     142 Mbps     │ │  │ ╭── RX ───╮                 │ │
│  │ ● docker0   98 Mbps     │ │  │ │███████░░│ 8.2 Mbps        │ │
│  │ ● wg0       52 Mbps     │ │  │ ╰─────────╯                 │ │
│  │   …                     │ │  │ ╭── TX ───╮                 │ │
│  └─────────────────────────┘ │  │ │███░░░░░░│ 2.1 Mbps        │ │
│                              │  │ ╰─────────╯                 │ │
│                              │  │ Avg:      31.4 Mbps          │ │
│                              │  │ 95%ile:   45.2 Mbps          │ │
│                              │  │ Peak:     49.8 Mbps          │ │
│                              │  │ Total:    142.3 GB            │ │
│                              │  └──────────────────────────────┘ │
├──────────────────────────────┴────────────────────────────────────┤
│  5. Bottom Bar                                                     │
│  q:Quit  s:Sort  tab:Filter  1/5/t/d:Period  ↑↓:Nav  ←→:Panels   │
└────────────────────────────────────────────────────────────────────┘
```

### 1. Header

Shows the application name, current mode (`live` or `paused`), poll interval, and local time. If the daemon connection drops, the mode changes to `reconnecting…` in yellow.

### 2. Speed Bar

A horizontal bar representing total bandwidth across all interfaces. The bar fills proportionally to the highest limit configured. Colors follow the [speed-based scheme](#color-coding) so you can spot saturation at a glance.

### 3. Left Panel — Interface List (35%)

Lists every managed interface with its current total throughput. The selected interface is highlighted with a `●` marker. Each entry shows:

- Interface name
- Current combined RX+TX throughput
- Status indicator: green dot (under limit), yellow (approaching), red (at limit)

The list scrolls when there are more interfaces than fit on screen.

### 4. Right Panel — Graph + Stats (65%)

Displays detailed information for the selected interface, split into two sub-panels:

**Graph (top half):** A real-time ASCII/braille chart of inbound and outbound traffic over the selected time window.

**Stats (bottom half):** Numerical summaries computed from the visible data.

### 5. Bottom Bar

A condensed reminder of all active shortcuts. The currently focused panel's shortcuts are brighter; inactive ones dim.

---

## Graph Details

The graph uses **braille characters** (Unicode `U+2800`–`U+28FF`) to render high-density time-series data. Each braille cell encodes 2×4 dots, providing **8 data points per character** — far denser than block-character charts.

### Color Legend

| Color  | Meaning          | Visual                |
| ------ | ---------------- | --------------------- |
| Green  | RX (inbound)     | `⣿⣿⣿⣿⣿⣿⣿⣀⣀` |
| Red    | TX (outbound)    | `⣿⣿⣿⣀⣀⣀⣀⣀⣀` |
| Orange | Overlap (RX+TX)  | `⣿⣿⣿⣿⣿⣿⣿⣿⣿` |

When RX and TX values overlap at the same time point, the merged cell renders in **orange** to indicate both directions are active. This is common on symmetric connections or during request-response cycles.

### Reading the Graph

```
 ╭── RX ───╮
 │⣿⣿⣿⣿⣿⣀⣀⣀⣀⣀│ 12.3 Mbps
 ╰─────────╯
 ╭── TX ───╮
 │⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿│ 24.1 Mbps  ← notice: more filled cells
 ╰─────────╯
```

- **Left edge** = oldest data point in the time window
- **Right edge** = most recent sample
- **Dense fill** (`⣿`) = higher throughput at that moment
- **Sparse fill** (`⣀`) = lower throughput
- **Empty** (`⠀`) = zero or near-zero

### Graph Controls

While the right panel is focused (<kbd>→</kbd> or <kbd>l</kbd>):

| Key          | Action                        |
| ------------ | ----------------------------- |
| <kbd>←</kbd> <kbd>→</kbd> | Scroll graph history (if paused) |
| <kbd>Space</kbd>            | Pause/resume live updates     |

When paused, a `⏸ PAUSED` indicator appears in the header, and you can scroll back through historical data up to the daemon's in-memory buffer (typically 24 hours).

---

## Stats Panel

The stats panel shows four key metrics for the selected interface across the active time window:

### Average (Avg)
The arithmetic mean of all samples in the window — smoothed but may hide short bursts.

```
Avg: 31.4 Mbps
```

### 95th Percentile (95%ile)
95% of all samples fall below this value. This is the **most useful metric for capacity planning** — it filters out rare spikes while capturing sustained load.

```
95%ile: 45.2 Mbps
```

::: tip Why 95th percentile?
ISPs and cloud providers often bill on 95th percentile. If your container bursts to 500 Mbps for 2 minutes but sits at 50 Mbps the rest of the hour, the 95th percentile will read ~52 Mbps — far more representative than the average.
:::

### Peak
The single highest sample in the window. Useful for identifying burst events but not for setting limits (you'd over-provision).

```
Peak: 49.8 Mbps
```

### Total Transferred
Cumulative bytes transferred (RX + TX) over the window. Displayed in human-readable units (KB → MB → GB → TB).

```
Total: 142.3 GB
```

---

## Color Coding

Interface list entries and graph segments are color-coded by current throughput. The thresholds are configurable via `bandwidth configure set tui.thresholds.<level> <mbps>`.

| Color  | Range         | Meaning                             |
| ------ | ------------- | ----------------------------------- |
| Green  | < 10 Mbps     | Light traffic, well within limits   |
| Yellow | 10–100 Mbps   | Moderate traffic, normal operation  |
| Orange | 100–500 Mbps  | Heavy traffic, approaching capacity |
| Red    | > 500 Mbps    | Saturated, likely dropping packets  |

These colors apply to:

- Interface list entries in the left panel
- Individual bars/cells in the graph
- The aggregate speed bar (uses the highest interface's color)

::: warning Color-blind accessibility
If the default palette is hard to distinguish, set `tui.color_scheme: deuteranopia` or `tui.color_scheme: monochrome` in your config. The monochrome scheme uses character density instead of hue.
:::

---

## Mouse Support

The TUI has full mouse support. No configuration needed — it works if your terminal supports it (most do).

| Action          | Effect                                           |
| --------------- | ------------------------------------------------ |
| Click           | Select an interface in the left panel            |
| Scroll          | Scroll the interface list or graph history       |
| Click buttons   | Activate bottom-bar shortcuts                    |
| Drag            | Not used (no action)                             |

Mouse events are handled through standard SGR extended mouse mode. If you prefer keyboard-only, mouse input doesn't interfere.

::: info Disabling mouse
Set `tui.mouse: false` in your config if your terminal multiplexer (tmux, screen) has conflicting mouse bindings.
:::

---

## Terminal Requirements

The TUI uses advanced terminal features and works best in modern terminal emulators.

### Recommended Terminals

| Terminal          | True Color | Braille | Mouse | Notes                    |
| ----------------- | :--------: | :-----: | :---: | ------------------------ |
| Kitty             | ✔         | ✔      | ✔    | Native image support too |
| WezTerm           | ✔         | ✔      | ✔    | Cross-platform           |
| iTerm2 (macOS)    | ✔         | ✔      | ✔    | Enable "Use Unicode version 9+ widths" |
| Windows Terminal  | ✔         | ✔      | ✔    | Works out of the box     |
| Alacritty         | ✔         | ✔      | ✔    | Lightweight, fast        |
| foot (Wayland)    | ✔         | ✔      | ✔    | Minimal, Wayland-native  |

### Partial Support

| Terminal    | Issue                                         | Workaround                              |
| ----------- | --------------------------------------------- | --------------------------------------- |
| tmux        | True color requires `set -g default-terminal "tmux-256color"` and `set -ga terminal-overrides ",*:Tc"` | Add to `tmux.conf`            |
| GNOME Terminal | Braille may render with gaps              | Switch to a braille-friendly font like Iosevka or JuliaMono |
| PuTTY       | No braille support                            | Use `tui.graph_style: blocks` in config  |
| macOS Terminal.app | No true color                          | Upgrade to iTerm2 or Kitty              |

### Fonts

The braille graph requires a font with good Unicode Braille Patterns coverage (`U+2800`–`U+28FF`). Most modern monospace fonts work:

- **Iosevka** (excellent braille rendering)
- **JuliaMono** (designed for scientific/terminal use)
- **JetBrains Mono** (good coverage, slight gaps on some sizes)
- **Cascadia Code** (works, but braille dots can be small)

### Fallback Mode

If your terminal doesn't support braille or true color, Bandwidth Manager detects this and falls back:

```
# Fallback graph (block characters, 256 colors)
│ RX: ███████▌░░░░░░░░░░ 8.2 Mbps
│ TX: ███░░░░░░░░░░░░░░░ 2.1 Mbps
```

Set `tui.graph_style: blocks` to force this mode permanently. It uses fewer data points but works everywhere.

---

## Troubleshooting the TUI

**"The graph looks like random dots"**
Your font doesn't render braille characters properly. Install Iosevka or JuliaMono, or set `tui.graph_style: blocks`.

**"Colors are all white/gray"**
Your terminal doesn't support true color. Set `tui.color_mode: 256` to use 256-color mode, or `tui.color_mode: 16` for basic ANSI.

**"The TUI is flickering"**
Reduce the poll interval: `bandwidth top --interval 5`. Some terminals struggle to repaint faster than 2 FPS.

**"Mouse clicks do nothing"**
Ensure your terminal has mouse reporting enabled. In tmux, add `set -g mouse on` to your config.

**"The bottom bar is cut off"**
Your terminal window is too small. Resize to at least 80×24 characters. Below that, the TUI switches to a minimal mode.
