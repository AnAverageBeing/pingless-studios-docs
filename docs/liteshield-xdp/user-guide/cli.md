# CLI Reference

`liteshield` is the single command-line interface for LiteShield XDP. It loads and detaches the XDP program, manages the whitelist/blacklist maps live, and hot-reloads configuration. Every command that touches BPF state requires root.

[[toc]]

::: info Root required
All commands except `status`, `version`, and `help` must run as root
(`sudo`). BPF map and link operations require `CAP_BPF`/`CAP_SYS_ADMIN`, which
in practice means euid 0.
:::

---

## Lifecycle

### `load`

Attach the XDP program to the configured interface and show the live status screen.

```bash
sudo liteshield load [--stats-off] [--no-tui] [--config <path>]
```

| Option | Description |
| ------ | ----------- |
| `--stats-off` | Attach, then show a static screen — no per-second stats polling (for very small machines) |
| `--no-tui` | Load and exit immediately (used by the systemd unit) |
| `--config` | Path to a non-default config file (default `/etc/liteshield/liteshield.yaml`) |

```
$ sudo liteshield load
LiteShield XDP is protecting eth0 (native mode).
XDP stays loaded after you quit. Use `liteshield unload` to stop.

 ◆ LiteShield XDP ACTIVE  eth0  up 00:02:14
   ...
```

```
$ sudo liteshield load --no-tui
LiteShield XDP loaded on eth0 (native mode).
```

**When to use:** First start after installation, interactive monitoring sessions, or manually re-attaching after `unload`. The systemd service uses `load --no-tui`.

::: tip Quitting keeps protection running
`Ctrl-C` exits the status screen only. The XDP program stays attached until you run `liteshield unload` or stop the service.
:::

---

### `unload`

Detach the XDP program and remove all pinned BPF state.

```bash
sudo liteshield unload
```

```
$ sudo liteshield unload
LiteShield XDP unloaded.
```

**When to use:** Before uninstalling, before changing the protected interface, or to temporarily disable all enforcement. Unloading clears counters, per-IP state, and auto-bans — manual whitelist/blacklist entries are also dropped, so re-add them after the next `load`.

---

## Inspection

### `status`

Show whether LiteShield is loaded, plus a counters snapshot.

```bash
liteshield status
```

```
$ sudo liteshield status
LiteShield XDP is loaded.
  Packets: 301442981 rx (300238425 passed, 1204556 dropped)
  Rule drops: SYN 812110 | UDP 390021 | ICMP 2425 | PPS 0 | NewSrc 0 | Ban 0
  Lists: whitelist hits 1204 | blacklist hits 88 | active bans 3
```

```
$ liteshield status
LiteShield XDP is NOT loaded.
$ echo $?
1
```

**When to use:** The first thing you run when something feels off, and in monitoring scripts — exit code is `0` when loaded, `1` when not.

---

## Whitelist

Whitelisted sources always pass — no rate limits, no bans. Entries live in a kernel HASH map (max 65,536) and take effect immediately, without reloading.

### `whitelist add`

```bash
sudo liteshield whitelist add <ip|cidr>
```

```
$ sudo liteshield whitelist add 10.0.0.0/24
whitelist add: 10.0.0.0/24 (256 address(es))

$ sudo liteshield whitelist add 203.0.113.10
whitelist add: 203.0.113.10 (1 address(es))
```

**When to use:** Exempt your office IP, monitoring probes, upstream load balancers, and health checkers so they are never rate-limited or auto-banned.

::: warning CIDRs are expanded, not matched
LiteShield uses HASH maps, not LPM tries. A CIDR is expanded into individual addresses at insert time — the maximum is `/24` (256 addresses). A `/16` would need 65,536 entries and is rejected.
:::

---

### `whitelist remove`

```bash
sudo liteshield whitelist remove <ip|cidr>
```

```
$ sudo liteshield whitelist remove 10.0.0.0/24
whitelist remove: 10.0.0.0/24 (256 address(es))
```

---

### `whitelist list`

```bash
sudo liteshield whitelist list
```

```
$ sudo liteshield whitelist list
10.0.0.1
10.0.0.2
203.0.113.10
```

**When to use:** Audit who is exempt before tightening thresholds. Works for both IPv4 and IPv6 entries.

---

## Blacklist

Blacklisted sources are always dropped. Bans are permanent or timed; timed entries use a `CLOCK_MONOTONIC` deadline — the same clock the BPF program reads — so expiry is exact and survives userspace restarts.

### `blacklist add`

```bash
sudo liteshield blacklist add <ip> [duration_sec]
```

| Argument | Description |
| -------- | ----------- |
| `<ip>` | IPv4 or IPv6 address (single address only, no CIDR) |
| `[duration_sec]` | Ban length in seconds. `0` or omitted = permanent |

```
$ sudo liteshield blacklist add 203.0.113.7 3600
blacklisted 203.0.113.7 for 3600s

$ sudo liteshield blacklist add 198.51.100.23
blacklisted 198.51.100.23 permanently
```

**When to use:** Kill a specific attacker immediately, or pre-ban known-bad ranges' individual IPs during an incident. For floods from many sources, rely on auto-ban instead — manual bans don't scale to thousands of spoofed IPs.

---

### `blacklist remove`

```bash
sudo liteshield blacklist remove <ip>
```

```
$ sudo liteshield blacklist remove 203.0.113.7
removed 203.0.113.7 from blacklist
```

---

### `blacklist list`

```bash
sudo liteshield blacklist list
```

```
$ sudo liteshield blacklist list
203.0.113.7                              2814s remaining
198.51.100.23                            permanent
```

```
$ sudo liteshield blacklist list
blacklist is empty
```

**When to use:** Verify a ban landed, or check remaining time before it expires. Note this lists only *manual* bans — auto-bans from threshold violations appear in the TUI's **Active bans** counter, not here.

---

## Configuration

### `config`

Open the config in `$EDITOR`, validate it, and hot-reload thresholds into the running instance.

```bash
sudo liteshield config [--config <path>]
```

```
$ sudo liteshield config
# (nano opens /etc/liteshield/liteshield.yaml — you edit and save)
config applied to the running instance.
```

Behavior:

1. Creates a default config (Hosting/Balanced) if none exists yet
2. Opens `$EDITOR`, falling back to `nano` then `vi`
3. Validates the file — invalid YAML or bad values abort with an error and nothing is applied
4. If LiteShield is loaded, thresholds are written into the live `config_map`; otherwise the file is saved for the next `load`

**When to use:** Every threshold change. This is the only supported way to tune a running instance.

::: info What hot-reload applies
Thresholds, ban duration, and Discord settings are applied live. Changing
`interface` or `xdp_mode` requires `unload` + `load` — the attach point
cannot change on a running program.
:::

---

## Informational

### `version`

Print the build version.

```bash
liteshield version
```

```
$ liteshield version
liteshield v1.0.0
```

**When to use:** Reporting bugs or verifying an upgrade. `liteshield --version` and `liteshield -v` are aliases.

---

### `help`

Print the usage summary.

```bash
liteshield help
```

```
$ liteshield help
LiteShield XDP — minimal XDP firewall

Usage:
  liteshield load [--stats-off] [--no-tui] [--config PATH]
  liteshield unload    Detach the XDP program and remove all state
  liteshield status    Show whether LiteShield is loaded plus counters
  ...
```

---

## Command Quick Reference

| Command | Category | Quick description |
| ------- | -------- | ----------------- |
| `load` | Lifecycle | Attach XDP + live status screen (`--no-tui` for systemd) |
| `unload` | Lifecycle | Detach XDP and clear all state |
| `status` | Inspection | Loaded? + counters snapshot (exit 0/1) |
| `whitelist add` | Whitelist | Exempt an IP or ≤/24 CIDR |
| `whitelist remove` | Whitelist | Remove an exemption |
| `whitelist list` | Whitelist | List whitelisted addresses |
| `blacklist add` | Blacklist | Ban an IP (timed or permanent) |
| `blacklist remove` | Blacklist | Remove a ban |
| `blacklist list` | Blacklist | List bans with remaining time |
| `config` | Configuration | Edit YAML in `$EDITOR`, hot-reload |
| `version` | Informational | Print build version |
| `help` | Informational | Usage summary |
