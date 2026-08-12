---
title: CLI Reference — OpenShield-L7
description: Every openshield-l7 command — run, validate, gen-token, gen-cert — with global flags, examples, and sample output.
---

# CLI Reference

The `openshield-l7` binary has four subcommands. With no subcommand given, it defaults to `run`.

```text
openshield-l7 [--root DIR] [--config FILE] <COMMAND>

Commands:
  run        Load configs and start the proxy (default)
  validate   Parse + validate the global config and every site file, then exit non-zero if anything is invalid
  gen-token  Print a fresh random API token and the YAML snippet to paste
  gen-cert   Generate a self-signed dev certificate (fullchain.pem + privkey.pem)
```

## Global flags

| Flag | Default | Meaning |
|---|---|---|
| `--root DIR` | `.` | Project root containing `config.yaml` and `sites.d/`. |
| `--config FILE` | `<root>/config.yaml` | Global config file. Relative paths resolve inside `--root`; absolute paths are used as-is. |

Both flags are global — they work with every subcommand (`openshield-l7 --root /etc/openshield-l7 validate`).

---

## `run`

```bash
openshield-l7 run [--root DIR] [--config FILE]
```

Loads the global config and every site file, then starts the proxy, the admin API, the metrics engine, the limit-maintenance task, and the hot-reload watcher.

Startup behavior:

- **First-run bootstrap** — if `config.yaml` is missing, a fully-commented default is written (mode `0600`) with one generated admin token printed **once** to stdout (never logged). `data/` and `sites.d/` are created; an empty `sites.d/` gets a commented `example.yaml.disabled` template.
- **Per-file isolation at load** — every `sites.d/*.yaml` is parsed and validated independently; failures are logged and skipped, the rest still serve.
- **Empty site `id`** — the loader assigns a uuid and rewrites the file with it.
- **Hostname conflicts** between enabled sites are first-wins (sorted order); the later file is logged and skipped.
- **Challenge secret** — `data/challenge.secret` (hex, mode `0600`) is loaded or generated so clearance cookies survive restarts; a corrupt file is regenerated with a warning (existing clearances are invalidated).

```bash
# typical systemd invocation
openshield-l7 run --root /etc/openshield-l7

# unprivileged dev run on high ports (edit config to 8080/8443 first)
openshield-l7 run
```

Shutdown: `SIGTERM`/`SIGINT` stops accepting and drains gracefully (bounded), exit code `0`. If the proxy or admin API dies on its own (e.g. bind failure), the process exits `1` — under systemd that's `Restart=on-failure` territory.

**When to use:** always — this is the daemon. For preflight checks without starting, use `validate`.

---

## `validate`

```bash
openshield-l7 validate [--root DIR] [--config FILE]
```

Parses and validates `config.yaml` and every `sites.d/*.yaml`, printing **every** problem (not just the first), then exits non-zero if anything is invalid. Also reports cross-file issues: duplicate site ids and duplicate hostnames between enabled sites.

Sample output — all good:

```text
OK   /etc/openshield-l7/config.yaml
OK   /etc/openshield-l7/sites.d/example.yaml
OK   /etc/openshield-l7/sites.d/shop.yaml
all configs valid (config.yaml + 2 site file(s) in /etc/openshield-l7/sites.d)
```

Sample output — problems:

```text
OK   /etc/openshield-l7/config.yaml
FAIL /etc/openshield-l7/sites.d/broken.yaml: origin.url: 'http://': missing host
FAIL /etc/openshield-l7/sites.d/dup.yaml: hostname 'example.com' also claimed by /etc/openshield-l7/sites.d/example.yaml
2 problem(s) found
```

**When to use:** in CI before shipping config changes, after hand edits, and as step one of every upgrade (`validate` against the new binary before restarting). Exit code makes it scriptable: `openshield-l7 validate || exit 1`.

---

## `gen-token`

```bash
openshield-l7 gen-token [--name NAME]
```

Prints a fresh random API token plus the ready-to-paste YAML. `--name` defaults to `admin` and is only a label (used in logs, never the secret).

```text
$ openshield-l7 gen-token --name bootstrap
Generated admin API token:

  name:  bootstrap
  token: 7f3c9e1a-2b4d-4e8f-9a1c-5d6e7f8091a2

Paste into config.yaml:

admin:
  tokens:
    - name: "bootstrap"
      token: "7f3c9e1a-2b4d-4e8f-9a1c-5d6e7f8091a2"
      role: admin

Store it somewhere safe; openshield-l7 never logs token values.
```

**When to use:** bootstrap, adding a dashboard (`--name dashboard`, then change `role:` to `readonly`), and rotation. Note the snippet always prints `role: admin` — downgrade it yourself for less-privileged tokens. Hot reload means a pasted token is live within a second; no restart.

---

## `gen-cert`

```bash
openshield-l7 gen-cert --host HOSTNAME --out DIR
```

Writes a self-signed dev certificate pair (`fullchain.pem` mode `0644`, `privkey.pem` mode `0600`) with `HOSTNAME` as the SAN, plus the matching site-config snippet. `--host` must be non-empty; the output directory is created if needed.

```text
$ openshield-l7 gen-cert --host example.com --out ./certs/example.com
Wrote a self-signed dev certificate for 'example.com':

  cert: ./certs/example.com/fullchain.pem
  key:  ./certs/example.com/privkey.pem

Site config snippet:

tls:
  enabled: true
  cert_path: "./certs/example.com/fullchain.pem"
  key_path: "./certs/example.com/privkey.pem"

Self-signed: browsers will warn; use a real CA for production.
```

**When to use:** local TLS testing and staging — SNI routing, HSTS, and the 308 redirect all behave identically to a real cert. **Never** for production; browsers will warn.

---

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success — clean `validate`, or `run` stopped by signal and drained. |
| `1` | Any validation problem (`validate`), or `run` died from an internal failure (bind error, config load error, proxy/API task death). |

## Environment

| Variable | Effect |
|---|---|
| `RUST_LOG` | Overrides `log_level` from `config.yaml` (e.g. `RUST_LOG=debug openshield-l7 run`). When unset, the config value wins. |
