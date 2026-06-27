# Keyboard Shortcuts

Complete keybinding reference for the OpenShield-XDP TUI.

## Global

| Action | Key(s) |
|--------|--------|
| Toggle help overlay | `?` |
| Close help overlay | `?`, `Esc`, `q` |
| Quit | `q`, `Ctrl+C` |

## Navigation

| Action | Key(s) |
|--------|--------|
| Dashboard | `1` |
| Traffic | `2` |
| Attacks | `3` |
| Bans | `4` |
| Logs | `5` |
| Status | `6` |
| Config | `7` |
| Next screen | `Tab` |
| Previous screen | `Shift+Tab` |
| Click nav tab | Mouse left-click on tab label |

## Logs screen (`5`)

| Action | Key(s) |
|--------|--------|
| Scroll down (1 line) | `j`, `↓` |
| Scroll up (1 line) | `k`, `↑` |
| Page down | `PgDn` |
| Page up | `PgUp` |
| Jump to bottom | `G` |
| Jump to top | `g` |
| Search/filter | `/` (type query, `Esc` to clear, `Enter` to confirm) |
| Clear search | `Esc` |
| Toggle line wrapping | `w` |
| Scroll (mouse) | Scroll wheel up/down |

## Bans screen (`4`)

| Action | Key(s) |
|--------|--------|
| Next page | `n` |
| Previous page | `p` |
| Search by IP/reason | `/` (type query, `Esc` to clear) |
| Clear search | `Esc` |
| Scroll pages (mouse) | Scroll wheel up/down |

## Attacks screen (`3`)

| Action | Key(s) |
|--------|--------|
| Next page of offenders | `n` |
| Previous page of offenders | `p` |

## Config screen (`7`)

### Browse mode

| Action | Key(s) |
|--------|--------|
| Move cursor down | `↓`, `j`, `Tab` |
| Move cursor up | `↑`, `k`, `Shift+Tab` |
| Edit selected field | `Enter` (runtime-safe fields only) |
| Toggle read-only fields visibility | `r` |
| Preview and apply pending changes | `a` |
| Discard all pending changes | `d` |
| Revert individual field | `x` |

### Edit mode

| Action | Key(s) |
|--------|--------|
| Save edited value | `Enter` |
| Cancel editing | `Esc` |
| Delete last character | `Backspace` |
| Type characters | Any printable ASCII |

### Preview mode

| Action | Key(s) |
|--------|--------|
| Confirm and apply changes | `y` |
| Cancel | `n`, `Esc` |

### Confirmation dialog

| Action | Key(s) |
|--------|--------|
| Confirm | `y` |
| Cancel | `n`, `Esc` |

## Mouse

| Action | Gesture |
|--------|---------|
| Switch screen | Click nav tab in navigation bar |
| Scroll logs | Scroll wheel (anywhere on logs screen) |
| Scroll bans | Scroll wheel (anywhere on bans screen) |

## Search mode

When search is active (`/` pressed on Logs or Bans screen):

| Action | Key(s) |
|--------|--------|
| Add character | Type any printable ASCII |
| Delete last character | `Backspace` |
| Confirm search | `Enter` |
| Cancel search | `Esc` |

The hint bar displays the current search query while in search mode. Matching entries are filtered in real-time as you type.

## Visual indicators

| Indicator | Meaning |
|-----------|---------|
| `>` (cyan) | Currently selected config field |
| `*` (yellow) | Field has a pending change |
| `[RO]` (dimmed) | Read-only field |
| Red text | Error, ban event, under attack |
| Yellow text | Warning, suspect IP, pending changes |
| Green text | OK, normal, healthy |
| Dimmed text | Secondary info, read-only, inactive |

## Next steps

[TUI Screens Deep-Dive](/openshield-xdp/tui/screens) · [TUI Overview](/openshield-xdp/tui/overview) · [CLI Reference](/openshield-xdp/cli/commands)
