# `openshield load` — Deep-Dive

The `load` command is the primary entry point for OpenShield-XDP. It performs pre-flight checks, loads BPF programs, attaches to the NIC, starts telemetry, and (optionally) launches the TUI dashboard.

## Full loading lifecycle

```mermaid
flowchart TD
    A[openshield load] --> B[Parse flags]
    B --> C[Load & validate config]
    C --> D{Stale state detected?}
    D -->|XDP attached but no pin| E[Clean up stale XDP]
    D -->|Pin exists but no loader| F[Clean up stale pins]
    D -->|Loader running| G[Stop running loader]
    D -->|Clean| H[Create BPF loader]
    E --> H
    F --> H
    G --> H

    H --> I{Load BPF programs}
    I -->|Map error| J[Auto-repair: openshield fix]
    J --> K[Retry load]
    K --> I
    I -->|Success| L[Init maps with config]

    L --> M{Attach to NIC}
    M -->|Attach fails| N[Cleanup stale XDP, recreate loader]
    N --> O[Reload + reattach]
    O -->|Fails| P[Error: try openshield unload]
    M -->|Success| Q[Write PID file]

    Q --> R[Start Unix socket server]
    R --> S[Start telemetry collector]
    S --> T{Display mode}
    T -->|--stats-off| U[Block on signals]
    T -->|--stats-minimal| V[Text snapshots]
    T -->|default| W[Safety confirmation]
    W -->|Enter pressed| X[TUI dashboard]
    W -->|Timeout (10s)| Y[Auto-unload]
```

## Pre-flight: stale state detection

Before loading, `openshield load` checks three stale state scenarios:

1. **XDP attached to NIC but no BPF pin file** — loader crashed or was killed without cleanup. Calls `bpf.CleanupAll()` to detach the orphaned program.
2. **BPF pin file exists but no loader running** — pins left behind. Calls `bpf.CleanupAll()` to remove stale pins.
3. **Loader PID file exists and process is running** — another loader instance. Attempts graceful stop (SIGINT → SIGTERM → SIGKILL fallback). If the process can't be killed, force-detaches XDP from the NIC.

## XDP mode auto-detection

When `xdp_mode` is `auto` (default), the attachment mode is determined by what the NIC driver supports:

| Priority | Mode | Requires |
|----------|------|----------|
| 1st | `native` | NIC driver with native XDP support |
| 2nd | `generic` | Any NIC (runs in kernel after skb allocation, slower) |
| 3rd | `skb` | Any NIC (same as generic, different attach point) |

You can override with `-m native` or `-m generic` to force a specific mode. If forced mode fails, the load fails with an error (no fallback).

## Auto-repair on load failure

If the BPF load step fails with a "parameter mismatch", "reusing pinned map", or "failed to create" error, `openshield load` automatically:

1. Closes the failed loader
2. Runs `openshield fix` (clears stale pins, config maps, orphaned programs)
3. Creates a new loader
4. Retries loading

If the retry also fails, the user is directed to run `openshield fix && openshield load` manually.

Similarly, if the attach step fails, the code force-cleans the interface, recreates the loader from scratch, and retries with a fresh attach.

## Safety confirmation (10-second countdown)

For interactive loads (not `--stats-off` and stdin is a real TTY), a safety prompt appears **after** the XDP program is loaded:

```
============================================================
  XDP program loaded on eno1 (mode: native)
============================================================

  If your SSH connection is still working, press ENTER now
  to confirm. Otherwise, the XDP program will auto-unload
  in 10 seconds to restore access.

  >>> Press ENTER to confirm (10s remaining):
```

This is a critical safety feature: if a bad configuration blocks SSH traffic, the admin can't press Enter, and after 10 seconds the XDP program auto-unloads, restoring network access. Pressing Enter confirms the program stays loaded.

This prompt is **skipped** when:
- `--stats-off` is set (systemd daemon mode — no terminal)
- stdin is not a TTY (piped, redirected, not interactive)

## Flags reference

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-t` | int | `0` | Auto-unload after N seconds (0 = run forever) |
| `--refresh` | int | `1000` | Stats refresh interval in milliseconds (min 50 for text, min 40 for TUI) |
| `--stats-off` | bool | `false` | No stats display at all — daemon mode for systemd |
| `--stats-minimal` | bool | `false` | Print text snapshots to stdout instead of TUI |
| `-i` | string | `""` | Override `interface` from config file |
| `-m` | string | `""` | Override `xdp_mode` from config file (`native`, `generic`, `skb`) |

## Examples

```bash
# Default: load with TUI dashboard and safety confirmation
sudo openshield load

# Production daemon mode (no TUI, no safety prompt, runs until signal)
sudo openshield load --stats-off

# Fast-refresh TUI (100ms updates)
sudo openshield load --refresh 100

# Ultra-fast TUI (40ms updates)
sudo openshield load --refresh 40

# Load on specific interface in native mode
sudo openshield load -i eth0 -m native

# Auto-unload after 1 hour (testing)
sudo openshield load -t 3600

# Minimal text mode (no TUI, prints stats to stdout)
sudo openshield load --stats-minimal

# Minimal text with fast refresh
sudo openshield load --stats-minimal --refresh 50
```

## Next steps

[Status Output](/openshield-xdp/cli/status) · [Fix Reference](/openshield-xdp/cli/fix) · [CLI Commands](/openshield-xdp/cli/commands)
