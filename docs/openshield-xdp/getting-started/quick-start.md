# Quick Start

## Load

```bash
sudo openshield load
```

This starts the full TUI dashboard. A 10-second safety confirmation appears — press `Enter` while your SSH session is still accessible to confirm the program stays loaded. If SSH was blocked by a bad config, the program auto-unloads, restoring access.

::: tip Default thresholds
The default configuration uses these per-IP thresholds:
- **PPS:** 850 packets/s
- **TCP PPS:** 680 packets/s
- **UDP PPS:** 425 packets/s
- **ICMP PPS:** 85 packets/s
- **SYN PPS:** 170 packets/s
- **Suspicion threshold:** 100 (cumulative score to trigger ban)
:::

## Example: Load with custom interface and mode

```bash
sudo openshield load -i eth0 -m native
```

XDP mode is auto-detected if `-m` is not specified: native → generic → skb fallback.

## Daemon mode

For production (systemd):

```bash
sudo openshield load --stats-off
```

No TUI, no safety prompt. The installed systemd service uses this mode:

```bash
sudo systemctl enable --now openshield-loader
```

## Example: Load with Bloom filter and freplace

The Bloom filter accelerates whitelist lookups (O(1) probabilitistic check before hashmap lookup), and freplace enables hot-patching of individual BPF modules without reloading the main program:

```bash
# Enable Bloom filter (default: enabled, 150K entries)
sudo openshield tui
# Press 7 for Config screen, navigate to maps.bloom_filter_enabled

# Or run load with custom config:
sudo openshield config  # generates /etc/openshield/openshield.yaml
# Then edit: maps.bloom_filter_enabled: true
sudo openshield load
```

::: info freplace
`freplace` is an **opt-in** feature: build with `make FREPLACE=1` on **kernel ≥ 6.10**. Default builds inline the pipeline stages so OpenShield loads on every supported kernel (5.15+) with zero fixes. When enabled, individual BPF stages (ban check, rate limit, conn track, amplification, L7) are attached as `BPF_PROG_TYPE_EXT` programs linking to the main XDP program, so a single stage can be hot-patched without detaching the main program. The TUI Config screen shows read-only fields that require a full reload; freplace-covered logic can be reloaded via `openshield reload` without unloading XDP.
:::

## Verify

```bash
sudo openshield status
```

::: details Expected output
```
OpenShield-XDP Status
=====================
  XDP Program:  LOADED
  Loader:       RUNNING
  Telemetry:    AVAILABLE
  Interface:    eno1
  XDP Mode:     native
  Static Mit:   true
  Dynamic Mit:  true
  Whitelist:    true (0 IPs)
  BPF Pin:      EXISTS
  Systemd:      INSTALLED
```
:::

## Common problems

### "Error: failed to load BPF program"

```bash
sudo openshield fix && sudo openshield load
```

Stale BPF pins from a previous installation are the most common cause. `openshield fix` checks and repairs 7 categories of issues.

### TUI stuck at "Loading..."

The loader process isn't running. Start it:

```bash
sudo openshield load --stats-off
```

### "Another loader instance is running"

```bash
sudo openshield unload
sudo openshield load
```

## CLI modes

| Command | Use case |
|---------|----------|
| `openshield load` | Interactive TUI dashboard with safety confirmation |
| `openshield load --stats-off` | Systemd daemon mode (no TUI) |
| `openshield load --stats-minimal` | Text-based snapshots |
| `openshield load --refresh 100` | Fast refresh (100ms) |
| `openshield load -t 3600` | Auto-unload after 1 hour |
| `openshield load -i eth0 -m native` | Custom interface and XDP mode |

## Next steps

- [Configuration Reference](/openshield-xdp/user-guide/configuration)
- [TUI Guide](/openshield-xdp/user-guide/tui)
- [CLI Reference](/openshield-xdp/cli/commands)
