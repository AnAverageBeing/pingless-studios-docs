---
title: CLI Reference
description: Every Protection Plus command — run, scan, status, config, test-alert, rules update, debug-conns and version — with syntax, example output, and when to use each.
---

# CLI Reference

Protection Plus is the system command `protection`. It needs **root** for full process/network introspection and enforcement. Everything below was verified against Protection Plus **v1.0.0**.

```text
protection plus — container-host abuse protection

USAGE:
  protection <command> [flags]

COMMANDS:
  run                  Start the protection daemon
  scan                 Run all detectors once and print findings (no enforcement)
  status               Show configuration and Docker connectivity
  config init [path]   Write a starter configuration file
  config check [path]  Validate a configuration file
  test-alert           Send a synthetic alert through every configured channel
  rules update         Download the latest YARA rules and hash blocklist
  debug-conns [port]   List all connections seen (host + every container)
  version              Print version

FLAGS:
  --config <path>      Path to config (default: /etc/protection/config.yaml)
```

---

## Global flags

| Flag | Description |
| --- | --- |
| `--config <path>` | Path to the config file. Defaults to `/etc/protection/config.yaml`. Works with `run`, `scan`, `status`, `test-alert` and `rules update`. |

`protection config` takes its target path as a positional argument instead (`protection config check ./config.yaml`), falling back to the same default when omitted.

---

## `protection run`

Start the daemon. This is what the systemd unit executes. Aliases: `start`, `daemon`.

```bash
sudo protection run --config /etc/protection/config.yaml
```

On startup it also refreshes threat intel (YARA rules + hash blocklist) when `intel.enabled` is set, then keeps updating it on the configured interval. If run as a non-root user it warns that introspection and enforcement may be limited, but still starts.

**When to use:** under systemd in production. For a foreground test run, just `Ctrl-C` to stop (it shuts down gracefully on `SIGINT`/`SIGTERM`).

Example log output:

```text
2026-07-29 14:02:11 [INFO ] threat-intel updated: 45231 bytes of YARA rules, 184112 blocklist hashes
2026-07-29 14:02:11 [INFO ] protection engine started: 10 detectors, 1 alert channels, interval=5s, dry_run=false
2026-07-29 14:02:16 [WARN ] [HIGH] Known miner binary detected — Process "xmrig" matches a known miner signature.
2026-07-29 14:02:16 [INFO ] running action "neutralize" on process xmrig (pid 595693)
2026-07-29 14:02:16 [INFO ] neutralized process pid 595693 (xmrig)
```

---

## `protection scan`

Run every detector **once**, print a findings table, and take **no** action. Shows a live spinner while scanning.

```bash
sudo protection scan
```

Example:

```text
SEVERITY  CATEGORY  TARGET                      TITLE
high      miner     process xmrig (pid 621221)  Known miner binary detected
high      zipbomb   /var/lib/.../bomb.zip       Decompression bomb detected

2 finding(s)
```

When nothing is found it prints `✓ no threats detected`.

**When to use:** to verify detection works, to audit a node on demand, or in a cron/monitoring check. It never enforces, so it's always safe to run.

::: tip Run a scan before arming enforcement
While `dry_run: true`, the daemon only logs what it *would* do. Run `protection scan` a few times on a busy node first — if it flags your legitimate workloads, tune the detectors (or whitelist paths) **before** you set `dry_run: false`.
:::

::: tip
The spinner is automatically suppressed when output is piped (e.g. `protection scan | tee report.txt`), keeping logs clean.
:::

---

## `protection status`

Show the loaded config, protection mode, enabled detectors/alerts, and Docker connectivity.

```bash
protection status
```

```text
config:        /etc/protection/config.yaml (ok)
installation:  node-fra-01
mode:          both
scan interval: 5s
dry run:       true
detectors:     miner, portscan, ddos, zipbomb, exploit, abuse, yara, fim, trivy, onaccess
alerts:        discord
docker:        connected via /var/run/docker.sock
```

If Docker is disabled in config the last line reads `docker: disabled`; if it is enabled but the socket ping fails you get `docker: UNREACHABLE (...)`.

**When to use:** first thing after install or after editing config — confirms what's enabled and that Docker is reachable.

---

## `protection config init`

Write a fully-commented starter config (in dry-run mode), then validate what it wrote so a bad flag fails loudly.

```bash
sudo protection config init /etc/protection/config.yaml
# wrote starter config to /etc/protection/config.yaml
```

It refuses to overwrite an existing file and creates missing parent directories automatically. The installer calls this with flags to pre-fill values:

| Flag | Sets |
| --- | --- |
| `--name <name>` | `general.name` (defaults to a generated display name) |
| `--mode <server\|docker\|both>` | `general.mode` (invalid values fall back to `both`) |
| `--dry-run <true\|false>` | `general.dry_run` (defaults to `true`) |
| `--discord-webhook <url>` | enables Discord alerts with this webhook |
| `--pterodactyl-url <url>` | Pterodactyl panel URL |
| `--pterodactyl-key <key>` | Pterodactyl Application API key (Pterodactyl integration is only enabled when **both** URL and key are given) |
| `--scan-paths <list>` | comma-separated archive-scan paths — see below |

```bash
sudo protection config init /etc/protection/config.yaml \
  --name node-fra-01 --mode both \
  --discord-webhook "https://discord.com/api/webhooks/…" \
  --pterodactyl-url "https://panel.example.com" \
  --pterodactyl-key "ptla_…" \
  --scan-paths "/var/lib/pterodactyl/volumes,/home"
```

### The `--scan-paths ALL` expansion

Passing the literal value `ALL` (case-insensitive) makes `config init` expand to the full set of user-writable directories Protection Plus should scan:

- always: `/tmp`, `/var/tmp`, `/dev/shm`, `/home`
- added only if they exist on the host: `/var/lib/pterodactyl/volumes`, `/var/lib/pterodactyl/mounts`, `/var/www`, `/srv`, `/opt`

```bash
sudo protection config init --scan-paths ALL
```

Omitting `--scan-paths` writes just the default `/var/lib/pterodactyl/volumes`.

---

## `protection config check`

Validate a config file without running the daemon.

```bash
protection config check /etc/protection/config.yaml
# ✓ /etc/protection/config.yaml is valid
```

**When to use:** after every manual edit, before `systemctl restart protection`. It catches mode typos, enabled-but-unconfigured alert channels, and YAML errors.

::: tip
Make `protection config check` part of your edit loop. A config that parses but fails validation is caught here — before systemd restart-loops the daemon on it.
:::

---

## `protection test-alert`

Send a synthetic **critical** alert through every enabled channel. Fails with an error if no channels are enabled.

```bash
protection test-alert
```

```text
✓ discord: delivered
✗ smtp: dial tcp: connection refused
```

**When to use:** right after configuring alerts, to confirm Discord/email/webhook all work end-to-end.

---

## `protection rules update`

Download the latest threat intel: the curated **YARA rule bundle** and the **MalwareBazaar SHA-256 hash blocklist**. Each source is attempted independently — one failing doesn't block the other (you'll get a partial-update error, and whatever succeeded is kept).

```bash
sudo protection rules update
```

```text
Downloading threat intel (YARA rules + hash blocklist)…
✓ rules: 45231 bytes -> /etc/protection/yara/protection.yar
✓ blocklist: 184112 hashes -> /var/lib/protection/blocklist.sha256
```

**When to use:** on first install (the YARA and on-access scanners need these files), after changing `intel.rules_url`/`intel.hashlist_url`, or to force a refresh instead of waiting for the daemon's automatic 24h update cycle. Downloads are atomic (temp file + rename), so a running daemon never sees a partial file.

---

## `protection debug-conns`

List **every** TCP connection Protection Plus can see — across the host and every container network namespace — with the owning PID and container. Optionally filter by remote (or local) port.

```bash
sudo protection debug-conns          # all connections
sudo protection debug-conns 3333     # only connections involving port 3333
```

```text
STATE   LOCAL              REMOTE        PID     PROCESS  CONTAINER
ESTAB   172.17.0.2:40959   1.1.1.1:80    637740  nc       07ed098c54bc

1 connection(s)
```

States shown include `ESTAB`, `SYN_SENT` and raw socket states; container IDs are truncated to 12 characters.

**When to use:** to confirm a suspected pool/scan connection, or to debug attribution.

::: tip Verifying container visibility
This is the quickest way to prove Protection Plus sees a container's traffic that never appears in the host's `/proc/net/tcp`. If `debug-conns` shows container IDs in the last column, namespace introspection is working — if it's always empty, check that the daemon runs as root and can reach the Docker socket.
:::

---

## `protection version`

```bash
protection version
# protection 1.0.0
```

Also available as `-v` / `--version`.

---

## `protection help`

Print the usage summary shown at the top of this page. Also available as `-h` / `--help`, and shown automatically (with exit code `2`) when you run an unknown command.

---

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Runtime error (printed to stderr) |
| `2` | Usage error (unknown command / missing argument) |

---

## Next steps

- **[How Detection Works →](./detection.md)** — what each detector checks.
- **[Alerts →](./alerts.md)** — channel setup and payloads.
- **[Actions & Rules →](./actions-rules.md)** — enforcement policy.
