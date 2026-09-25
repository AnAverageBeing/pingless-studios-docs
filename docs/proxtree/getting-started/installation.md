---
title: Installation
description: Install the ProxTree control plane and node agent from the release package — requirements, every installer flag, verification, post-install hardening, troubleshooting and uninstall.
---

# Installation

> **From release zip to a running control plane and agent.**
> ProxTree ships as pre-built static Go binaries plus a POSIX installer — no Go
> toolchain, no compiler, no container runtime. There are two daemons:
> `control-planed` (control plane) and `proxtreed` (node agent), and the same
> script installs either or both.

[[toc]]

---

## Requirements

| Component | Needs |
| --- | --- |
| Control plane (`control-planed`) | Linux or macOS for the installer (Windows: run the shipped binary directly). A PostgreSQL database reachable from the host. Outbound TCP to each node's control port. Root/sudo to install services; the daemon itself only needs to read its env file and talk to PostgreSQL. |
| Node agent (`proxtreed`) | Linux or macOS (Windows: shipped binary). No database server — it keeps its own SQLite file. Permission to bind the proxy port range and its control port. |
| Paymenter addon | Paymenter v1.5.7 plus its own queue worker and scheduler running, and network access to the control plane API. |

The installer is POSIX `sh` and handles apt / dnf / yum / pacman / apk / brew, with or
without systemd. Supported architectures are `amd64` and `arm64`; other
architectures abort with `unsupported architecture`.

### Network ports

| Port | Default | Who connects | Must be reachable from |
| --- | --- | --- | --- |
| Control plane API | `8080/tcp` (`PROXTREE_LISTEN_ADDR`, `--cp-listen`) | operators, the billing addon, agents sending heartbeats | the addon host and your admin network — not the public internet |
| Agent control channel | `9090/tcp` (`PROXTREE_LISTEN`, `--agent-listen`) | the control plane | the control plane only |
| Proxy listeners (customer traffic) | `10000-60000/tcp` (`port_range_start`..`port_range_end`) | customers using their proxies | the public internet |
| PostgreSQL | `5432/tcp` | the control plane, when the database is local | the control plane host (loopback is enough) |

The proxy port range is node-wide and editable per node with
`PATCH /v1/nodes/{id}` — open whatever range you configure. The agent's own
control port is reserved and never handed to a customer.

::: warning Master key is mandatory
The control plane refuses to start without `PROXTREE_MASTER_KEY`, a 32-byte
value in base64. It is the AES-256-GCM key that encrypts customer credentials
and node tokens at rest. The installer generates one on first install and reuses
it on every re-run, but **nothing else can regenerate it**. Back it up.
:::

---

## Get the release

Every release publishes two archives. They are not interchangeable.

| Asset | Contents | Goes on |
| --- | --- | --- |
| `ProxTree-Backend-<v>.zip` | Static binaries (`CGO_ENABLED=0`, stripped) for linux-amd64, linux-arm64, darwin-amd64, darwin-arm64 and windows-amd64, under `bin/<os>-<arch>/`, plus `install.sh` | Your servers — the control plane host and every proxy node |
| `ProxTree-Paymenter-Addon-<v>.zip` | The Paymenter Servers-type extension | The Paymenter panel — uploaded in Paymenter admin, or unzipped into `extensions/Servers/ProxTree` |

::: warning Mixing up the two zips is the most common packaging error
The backend zip is the only one that contains `install.sh` and the daemons; it
never goes into Paymenter. The addon zip contains PHP and a `composer.json` for
Paymenter; it never goes on a proxy server. If `install.sh` is missing, you have
the addon; if there is no Paymenter extension manifest, you have the backend.
:::

```bash
unzip ProxTree-Backend-<v>.zip
cd ProxTree-Backend-<v>
ls bin/linux-amd64/      # control-planed  proxtreed
```

---

## Install the control plane

```bash
sudo sh install.sh --only control-plane
```

With an existing PostgreSQL instead of a locally installed one:

```bash
sudo sh install.sh --only control-plane \
  --db-url 'postgres://proxtree:secret@db.example.com:5432/proxtree?sslmode=require'
```

A local install creates the role `proxtree`, the database `proxtree`, a random
password, and the DSN `postgres://proxtree:<pass>@127.0.0.1:5432/proxtree?sslmode=disable`.
`--no-db` without `--db-url` is rejected outright — there is nothing to connect to.

The installer applies migrations during install (and the daemon re-applies any
pending ones at every startup), then verifies `http://127.0.0.1:<cp-port>/healthz`
before declaring success.

### What lands where

| Path | Contents |
| --- | --- |
| `/opt/proxtree/bin/control-planed` | control plane binary (atomic replace on upgrade) |
| `/opt/proxtree/bin/proxtreed` | agent binary — installed only for `--only agent` or the `all` default |
| `/etc/proxtree/control-planed.env` | `PROXTREE_DATABASE_URL`, `PROXTREE_MASTER_KEY`, `PROXTREE_LISTEN_ADDR`, `PROXTREE_BASE_URL` — mode 0600 |
| `/etc/proxtree/proxtreed.env` | agent env — mode 0600 |
| `/opt/proxtree/var/` | data root; the agent's SQLite credential DB (`proxtreed.db`) and pid files |
| `/opt/proxtree/log/` | logs on launchd and the no-init-system fallback |
| `/etc/systemd/system/control-planed.service`, `proxtreed.service` | generated units (systemd) |
| `/Library/LaunchDaemons/org.proxtree.<name>.plist` | generated units (macOS launchd) |
| `/opt/proxtree/bin/proxtree-start.sh` | start script when no init system is present |

The env files contain exactly the keys listed above. The remaining
`PROXTREE_*` knobs (timeouts, sweep cadence, rotation cooldown) use their
built-in defaults — add them to the file by hand to change one. See
[Configuration Reference](../configuration/reference.md).

Logs: under systemd everything goes to journald (`journalctl -u control-planed`).
Under launchd and the no-init-system fallback the installer writes
`/opt/proxtree/log/control-planed.log` and `/opt/proxtree/log/proxtreed.log`.
On a fresh install the bootstrap **admin API token is printed once** to the log —
capture it and store it, then use it to create per-purpose tokens:

```bash
journalctl -u control-planed | grep BOOTSTRAP
```

If you are not root and have no passwordless sudo, the installer switches to
rootless mode: prefix `$HOME/.local/proxtree`, config `$HOME/.config/proxtree`,
no services, no database.

---

## Install a node agent

A node must exist in the control plane first, because `POST /v1/nodes` is what
issues the node token:

```bash
curl -fsS -X POST http://127.0.0.1:8080/v1/nodes \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"de-fra-1","url":"http://10.0.0.5:9090","location":"de-fra"}'
```

The response carries the node token exactly once.

### Case A — agent on the same host as the control plane

```bash
sudo sh install.sh --only agent \
  --node-token ptx_... \
  --cp-url http://127.0.0.1:8080
```

### Case B — agent on a separate proxy server

```bash
sudo sh install.sh --only agent \
  --node-token ptx_... \
  --cp-url https://cp.example.com \
  --agent-listen :9090
```

Register that node with the URL the control plane will call — for case B that is
`http://<proxy-server-ip>:9090`, which is why `--agent-listen` and the node URL
have to agree.

::: warning The agent's control port is not the control plane's port
`control-planed` and `proxtreed` are two daemons on two ports: the control plane
listens on **8080**, the agent on **9090**. `--cp-url` must point at the control
plane — never at the agent. Pointing `--cp-url` at the agent's own port on
localhost is what produces `connection refused` on every heartbeat; the
installer refuses that configuration on localhost, and for any other URL it
probes `${cp-url}/healthz`, warns if nothing answers, and scans 8080 / 8081 /
18081 for a live control plane to suggest.
:::

::: warning A node token is not an API token
A node token authenticates only `POST /v1/nodes/heartbeat` and the agent's own
control endpoints. It cannot list nodes, provision proxies, or manage anything
in the API, and pasting one into the Paymenter addon fails. Conversely an admin
API token cannot be used as `--node-token`. See the
[FAQ](./faq.md#what-is-the-difference-between-the-three-token-kinds).
:::

`--only agent` never touches PostgreSQL, so the same command works on a bare
proxy server. Note that after the heartbeat URL check the installer keeps going
even if the control plane is unreachable — the agent is autonomous and retries
with exponential backoff capped at two minutes.

---

## Installer reference

| Flag | Default | What it does |
| --- | --- | --- |
| `--only control-plane\|agent\|all` | `all` | Selects which component(s) to install. Any other value is rejected with `--only must be control-plane, agent or all`. |
| `--prefix DIR` | `/opt/proxtree` | Install root for binaries, data and logs. In rootless mode the default becomes `$HOME/.local/proxtree`. |
| `--config-dir DIR` | `/etc/proxtree` | Where the `*.env` files are written (files 0600, directory 0700). Rootless default: `$HOME/.config/proxtree`. |
| `--db-url URL` | none | Use an existing PostgreSQL DSN and skip installing a local server. Without it the installer installs/starts PostgreSQL and provisions role + database. |
| `--master-key KEY` | reuse existing, else generate | 32-byte base64 AES-256-GCM key. Generated with `openssl rand -base64 32` when absent. |
| `--cp-listen ADDR` | `:8080` | Control plane API listen address. Reused from the existing env file unless this flag is passed. |
| `--no-db` | off | Never install or start PostgreSQL. Requires `--db-url`; otherwise the installer fails with `no --db-url given and --no-db set`. |
| `--node-token TOKEN` | reuse existing | Node token from `POST /v1/nodes`. Required on the first agent install — the installer refuses to write a config without one. |
| `--cp-url URL` | reuse existing, else `http://127.0.0.1:8080` | Control plane base URL. Goes into the agent's `PROXTREE_CONTROL_PLANE_URL` (the heartbeat target) and into the control plane's `PROXTREE_BASE_URL`. Reused unless passed. |
| `--agent-listen ADDR` | `:9090` | Agent control channel listen address. Reused from the existing env file unless this flag is passed. |
| `--prev-node-token T` | empty | Previous node token, written as `PROXTREE_PREV_NODE_TOKEN` so a rotation window accepts both tokens. |
| `--service` / `--no-service` | auto | Force services on or off. `auto` uses systemd when available, else launchd on macOS, else the generated start script. |
| `-h`, `--help` | — | Print usage and exit. |

---

## Idempotent re-runs

Re-running the installer is the supported upgrade path. It reconciles config
instead of overwriting it:

- The **master key** is reused from `/etc/proxtree/control-planed.env` unless
  `--master-key` is passed.
- The **database password** is parsed out of the existing DSN and reused, so a
  re-run does not invalidate the role.
- **Listen addresses and URLs** are reused unless the matching flag was
  actually passed. Re-running with no flags cannot silently repoint a working
  install (for example moving an agent off `:8081` back onto `:8080`).
- The **node token**, previous token and heartbeat interval are reused from
  `/etc/proxtree/proxtreed.env`.
- Binaries are written to a temp file and `mv`-ed over the target, so replacing
  a running daemon is atomic; the unit is then restarted.

```bash
# Upgrade the control plane
unzip ProxTree-Backend-<new>.zip && cd ProxTree-Backend-<new>
sudo sh install.sh --only control-plane

# Upgrade each proxy server
sudo sh install.sh --only agent
```

No flags are needed on an existing install: ports, URLs, secrets and tokens are
all picked up from the env files, and pending migrations are applied.

---

## Verify the installation

```bash
systemctl status control-planed proxtreed
```

**Control plane health** — unauthenticated, must answer `200`:

```bash
curl -fsS http://127.0.0.1:8080/healthz
```

**Agent health** — every agent endpoint requires the node token:

```bash
curl -fsS -H "Authorization: Bearer $PROXTREE_NODE_TOKEN" \
  http://127.0.0.1:9090/v1/health
# {"status":"ok","version":"...","uptime_seconds":42}
```

Without the token this returns `401` — that is the endpoint working, not failing.

**Heartbeats** — beats that succeed are not logged, so a quiet log is the
healthy state:

```bash
journalctl -u proxtreed | grep heartbeat
```

You should see no `heartbeat failed; operating autonomously, will retry` lines.
A failure streak logs once with the error and the next retry delay; recovery
logs `heartbeat recovered; control plane reachable again`.

**Node status** — the node must be `online` in the control plane:

```bash
curl -fsS -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://127.0.0.1:8080/v1/nodes | jq '.nodes[] | {name, status, bound_ips}'
```

`bound_ips` is the agent's self-report of the addresses it actually has on an
interface. An IP that is registered in the control plane but absent here is
never sellable — that is the first gate before the reachability prober runs.

**Listeners** — confirm both daemons are bound:

```bash
ss -lntp | grep -E ':(8080|9090)\b'
```

Finish by adding an IP to the node (`POST /v1/nodes/{id}/ips`), confirming it
appears in `bound_ips` and is not flagged unreachable, then provisioning a test
proxy with `POST /v1/proxies` and connecting through it.

---

## Post-install hardening

- **Terminate TLS in front of the control plane.** The API is bearer-token
  protected but speaks plain HTTP by default. Put nginx or Caddy in front, keep
  `PROXTREE_LISTEN_ADDR` on loopback, and point each agent at the public HTTPS
  URL with `--cp-url` (the agent's own `PROXTREE_CONTROL_PLANE_URL`).
- **Restrict the admin API.** Allow `8080` only from the addon host and your
  admin network. Never expose `9090` publicly — that is the control plane's
  private channel to the agent.
- **Consider agent mTLS.** Setting `PROXTREE_MTLS_CA` (with
  `PROXTREE_TLS_CERT` / `PROXTREE_TLS_KEY`) makes the agent's control channel
  require a verified client certificate, so a leaked node token alone is not
  enough to push desired state.
- **Back up the master key and the config directory.** `/etc/proxtree` holds the
  database password, the master key and the node token. Losing the master key
  means the encrypted customer credentials and node tokens can never be
  decrypted again — tokens can be rotated to recover, stored passwords cannot.
- **Keep tokens short-lived in practice.** API tokens are shown once at
  creation; use `POST /v1/tokens/{id}/rotate` and
  `POST /v1/nodes/{id}/token/rotate` instead of long-lived credentials. Node
  rotation keeps the previous token valid until the next rotation, which is what
  `--prev-node-token` is for.
- **Do not run the agent as a privileged service it does not need** — its port
  range is above 1024, so the shipped systemd units' hardening
  (`NoNewPrivileges`, `ProtectSystem`, `ProtectHome`, `PrivateTmp`) can stay on.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Agent log: `heartbeat failed; operating autonomously, will retry` with `connection refused` | `PROXTREE_CONTROL_PLANE_URL` points at the agent's own port (9090) instead of the control plane (8080) | Re-run `sudo sh install.sh --only agent --node-token <token> --cp-url http://<cp-host>:8080`. The installer refuses this on localhost and otherwise scans for a live control plane. |
| Heartbeat returns `401` | Wrong or placeholder node token | The token is issued once by `POST /v1/nodes`; re-issue or rotate it and install the agent with `--node-token`. An admin API token will not work here. |
| `404` on `/v1/nodes` from the addon | The Server row's URL points at the agent (9090), not the control plane (8080) | The agent serves `/v1/health`, `/v1/status`, `/v1/instances/sync`, `/v1/metrics` — node listing lives on the control plane. Point the addon at the control plane URL. |
| Node shows `offline` | Heartbeats stopped; the control plane marks a node offline after `PROXTREE_HEARTBEAT_TIMEOUT` (90s) | Check `systemctl status proxtreed`, then `/v1/health` with the node token, then the firewall path from the agent to the control plane. |
| IPs never become sellable | Two independent gates: the address is not on an interface (missing from `bound_ips`), or the prober reports it unreachable | Confirm with `ip addr`; check the probe target (`PROXTREE_PROBE_TARGET`, default `1.1.1.1:53`) is reachable *from that IP*; read `ip_health` / `unreachable_ips` in the agent's `/v1/status`. |
| `422 insufficient_capacity` — `not enough IP capacity on the selected node` | No node can host the shape: not enough distinct IPs each with `instances_per_ip` free slots, or not enough free ports node-wide | `POST /v1/availability/check` returns `detail.hint`, which names the excluded addresses (`unreported_ips` and `unreachable_ips`) when that is the reason. Fix the named IPs or add capacity. |
| `502 agent_sync_failed` with `bind port N: address already in use` on a host running two agents | The two agents' `port_range_start`/`port_range_end` overlap; listeners bind `0.0.0.0`, so a port is unique per host, not per IP | Give each node a disjoint range with `PATCH /v1/nodes/{id}`, then re-run the provisioning. |
| PostgreSQL log line `FATAL: the database system is shutting down` | A transient PostgreSQL restart; clients are being disconnected on purpose | Transient — the control plane reconnects. If it repeats, inspect the PostgreSQL unit and its logs. |
| Control plane exits at startup: `PROXTREE_MASTER_KEY is required (32 bytes, base64)` | Env file missing or key is not exactly 32 decoded bytes | Restore the existing key from backup or set a new base64 32-byte value; a new key cannot decrypt credentials encrypted with the old one. |

---

## Uninstall

```bash
sudo systemctl disable --now control-planed proxtreed
sudo rm -f /etc/systemd/system/control-planed.service \
           /etc/systemd/system/proxtreed.service
sudo systemctl daemon-reload
sudo rm -rf /opt/proxtree
sudo rm -rf /etc/proxtree
```

On macOS, unload the plists and remove them instead:

```bash
sudo launchctl unload /Library/LaunchDaemons/org.proxtree.*.plist
sudo rm -f /Library/LaunchDaemons/org.proxtree.*.plist
```

Before deleting anything, deregister the node from the control plane so no
records point at a dead agent — `DELETE /v1/nodes/{id}` (or `?force=true` to
delete the node together with its instances).

What you are deleting:

- `/etc/proxtree` holds **secrets** — the database DSN with its password, the
  master key, and the node token. Treat it like any credential store.
- `/opt/proxtree/var` holds the agent's SQLite credential database
  (`proxtreed.db`, mode 0600) — the local copy of every credential the agent
  must present. Removing it is what actually ends access on that node.
- PostgreSQL data is **your call**. If the installer created it, the `proxtree`
  role and database are self-contained; dropping the database and the role is
  enough. Never remove the PostgreSQL cluster for a server that hosts other
  databases.

[Configuration Reference →](../configuration/reference.md) · [FAQ →](./faq.md) · [HTTP API →](../user-guide/api.md)
