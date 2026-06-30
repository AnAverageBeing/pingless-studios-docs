# `openshield fix` — Auto-Repair

The `fix` command auto-detects and repairs 7 categories of common issues that can prevent OpenShield-XDP from loading.

## Usage

```bash
sudo openshield fix           # Standard mode — shows one line per fix
sudo openshield fix -v        # Verbose mode — shows detail for each step
sudo openshield fix --verbose # Same as -v
```

Root is required because `/sys/fs/bpf` and `/var/run` need write access.

## The 7 fixable issues

### 1. Stale BPF pins

**Problem:** Previous installation or crash left pinned maps/programs in `/sys/fs/bpf/`. New load fails with "reusing pinned map" or "parameter mismatch" because the pinned map's struct layout differs from the current version.

**Fix:** Removes known stale pin files:
- `/sys/fs/bpf/config_map`, `/sys/fs/bpf/global_stats_map`, `/sys/fs/bpf/ip_stats_map`
- `/sys/fs/bpf/ban_map`, `/sys/fs/bpf/whitelist_map`, `/sys/fs/bpf/baseline_map`
- `/sys/fs/bpf/panic_bucket_map`, `/sys/fs/bpf/events_map`, `/sys/fs/bpf/prof_map`
- `/sys/fs/bpf/l7_sig_map`, `/sys/fs/bpf/prefix_ban_map`, `/sys/fs/bpf/bloom_map`
- `/sys/fs/bpf/xdp_prog`
- IPv6 variants: `whitelist_map_v6`, `ip_stats_map_v6`, `ban_map_v6`, `subnet_ban_map`, `subnet_ban_map_v6`
- Entire `/sys/fs/bpf/openshield` directory

### 2. BPF filesystem permissions/mounting

**Problem:** `/sys/fs/bpf` is not mounted or not accessible. BPF programs require the BPF filesystem.

**Fix:** If `/sys/fs/bpf` doesn't exist, mounts it with:
```bash
mount -t bpf bpf /sys/fs/bpf
```

### 3. Stale PID file

**Problem:** `/var/run/openshield/loader.pid` exists but the process with that PID is dead. `openshield load` sees the PID file and thinks a loader is already running.

**Fix:** Reads the PID from the file, checks if `/proc/<pid>` exists:
- If the process is dead → removes the stale PID file
- If the PID file is empty → removes it
- If the process is alive → leaves it (not stale)

### 4. Stale `/var/run/openshield` directory

**Problem:** Socket files, lock files, or other artifacts left in `/var/run/openshield` from a previous run.

**Fix:** Removes all entries in `/var/run/openshield` — but only if no loader is currently running (checks `isLoaderRunning()` first).

### 5. Orphaned XDP programs

**Problem:** XDP program is still attached to a NIC but no corresponding BPF pin file exists. This happens when the loader is killed with SIGKILL (no chance to clean up) or the system crashed.

**Fix:** Two methods:
1. Uses `bpftool link show -j` to find XDP links. If found, iterates common interface names (`eno1`, `eth0`, `ens3`) and runs `bpftool net detach xdp dev <iface>`.
2. Checks for orphaned `/sys/fs/bpf/xdp_prog` pin without a running loader — removes it.

### 6. Config map struct mismatches

**Problem:** Pinned `config_map` has a different struct layout than the current version (e.g., after an upgrade that added/removed fields). Loading fails with "expected map size N, got M".

**Fix:** Removes stale config maps at:
- `/sys/fs/bpf/config_map`
- `/sys/fs/bpf/openshield/config_map`

### 7. Missing required directories

**Problem:** Expected directories don't exist, causing file-creation failures.

**Fix:** Creates (with `0755`):
- `/etc/openshield` — config file
- `/var/lib/openshield/state` — persistent state
- `/var/lib/openshield/pins` — BPF pin backing
- `/var/log/openshield` — log output
- `/var/run/openshield` — runtime files

## When to use `fix` vs manual intervention

| Scenario | Use `openshield fix` | Manual intervention needed |
|----------|:---:|---------------------------|
| After a crash or SIGKILL | ✅ | — |
| After upgrading OpenShield | ✅ | Check config compatibility |
| "reusing pinned map" error | ✅ | — |
| "parameter mismatch" error | ✅ | — |
| "device or resource busy" | ✅ | — |
| `/sys/fs/bpf` doesn't exist | ✅ | — |
| NIC driver doesn't support XDP | ❌ | Install a supported NIC/driver |
| Kernel too old (no BTF) | ❌ | Upgrade kernel or rebuild with `CONFIG_DEBUG_INFO_BTF=y` |
| Config file is invalid YAML | ❌ | Fix `/etc/openshield/openshield.yaml` |
| Disk full | ❌ | Free space on `/var` for logs |
| Permission denied on `bpftool` | ❌ | Install `bpftool` or run as root |

## Auto-invocation

`openshield load` automatically runs `fix` internally when it encounters map-related errors ("failed to create", "parameter mismatch", "reusing pinned map"). You don't need to manually run `fix && load` — just `load` handles it. However, explicitly running `fix` can be useful as a pre-flight check before loading.

## Example output

### Standard mode

```
OpenShield-XDP — Automated Repair
==================================

  Clearing stale BPF pins ... fixed
  Fixing /sys/fs/bpf permissions ... ok
  Removing stale PID file ... ok
  Clearing /var/run/openshield ... fixed
  Detaching orphaned XDP programs ... ok
  Removing stale config maps ... fixed
  Creating required directories ... ok

Issues checked: 7, Fixed: 3

All issues resolved. Run 'openshield load' to start.
```

### Verbose mode

```
OpenShield-XDP — Automated Repair
==================================

  Clearing stale BPF pins ...   removed: /sys/fs/bpf/config_map
  removed: /sys/fs/bpf/ban_map
  cleared: /sys/fs/bpf/openshield
fixed
  ...
```

## Next steps

[Load Deep-Dive](/openshield-xdp/cli/load) · [Status Output](/openshield-xdp/cli/status) · [CLI Commands](/openshield-xdp/cli/commands)
