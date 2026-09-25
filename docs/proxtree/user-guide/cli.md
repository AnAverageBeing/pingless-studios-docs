---
title: CLI Reference
description: Running control-planed and proxtreed, their commands and flags, the installer as an operational tool, systemd service management, deployment verification and routine API recipes.
---

# CLI Reference

> **How to run, verify and operate ProxTree from the shell.** Commands and log
> strings below come from `controlplane/cmd/control-planed`, `agent/cmd/proxtreed`,
> `packaging/install.sh` and the control-plane API routes.

[[toc]]

---

## `control-planed`

The control plane is one binary: it applies migrations, serves the API and runs the background loops (sweeper and reconciler). Configuration is environment-only.

### Running the service

```bash
# Foreground. Configuration comes from the environment; there are no flags.
set -a; . /etc/proxtree/control-planed.env; set +a
/opt/proxtree/bin/control-planed
```

With no arguments it reads `PROXTREE_*`, exits if a required value is missing (`config: PROXTREE_DATABASE_URL is required`), connects to PostgreSQL, applies pending migrations, prints a bootstrap admin token if none exists, starts the sweeper and reconciler, then listens on `PROXTREE_LISTEN_ADDR`. It drains gracefully on `SIGINT`/`SIGTERM` for up to ten seconds.

### The `migrate` subcommand

```bash
sudo sh -c 'set -a; . /etc/proxtree/control-planed.env; set +a; \
  /opt/proxtree/bin/control-planed migrate'
# 2026/09/25 13:19:58.113402 migrations applied
```

`migrate` applies every pending embedded migration and exits — it does not serve the API, start the sweeper, or bootstrap a token. Already-applied versions are skipped, so it is idempotent and safe to run before an upgrade or repeatedly. There is no dry-run; to inspect schema state, query the tracking table:

```bash
psql "$PROXTREE_DATABASE_URL" -c \
  'SELECT version, name, applied_at FROM schema_migrations ORDER BY version'
```

Any argument other than `migrate` is fatal: `unknown command "serve" (want: migrate)`. That is also why the installer's version probe falls back for this binary.

### No flags, no `--help`

`control-planed` accepts no flags at all — no `--config`, no `-listen`, no `-version`, no `--help`. Every setting is an environment variable read at startup, which is why the unit uses `EnvironmentFile=` and why "use an external database" means editing `PROXTREE_DATABASE_URL`. One configuration path means one thing to get wrong.

### The bootstrap admin token

On the first start, if the database has no admin token, one is generated and printed once:

```text
2026/09/25 13:19:58.582914 =================================================================
2026/09/25 13:19:58.582914 BOOTSTRAP ADMIN TOKEN (shown once, store it safely): ptx_1f9c…
2026/09/25 13:19:58.582914 =================================================================
```

Store it immediately — it is hashed in the database and cannot be recovered. Every later start skips this step silently.

### Running under systemd

The installer writes `/etc/systemd/system/control-planed.service` with `Restart=always`, `RestartSec=3`, `LimitNOFILE=1048576` and a hardened sandbox:

```bash
sudo systemctl start control-planed
sudo systemctl stop control-planed
sudo systemctl restart control-planed    # needed after editing the env file
sudo systemctl status control-planed

journalctl -u control-planed -f          # follow; -n 100 for the last 100 lines
```

A healthy startup log:

```text
2026/09/25 13:20:11.482913 control-plane listening on :8080 (agent heartbeat target: http://127.0.0.1:8080)
```

Later, successful state pushes appear as `agent sync ok node=de-1 (6d1e…): 12 instance(s)`.

---

## `proxtreed`

The agent runs the proxy listeners and its own control channel. Every setting has both an environment variable and a flag; a flag wins.

### Flags

| Flag | Env equivalent | Default | Example |
|---|---|---|---|
| `-listen` | `PROXTREE_LISTEN` | `:9090` | `-listen 0.0.0.0:9090` |
| `-db-path` | `PROXTREE_DB_PATH` | `/var/lib/proxtree/proxtree.db` | `-db-path /opt/proxtree/var/proxtreed.db` |
| `-control-plane-url` | `PROXTREE_CONTROL_PLANE_URL` | *(empty — heartbeats disabled)* | `-control-plane-url https://cp.example.com` |
| `-heartbeat-interval` | `PROXTREE_HEARTBEAT_INTERVAL` | `15s` | `-heartbeat-interval 30s` |
| `-node-token` | `PROXTREE_NODE_TOKEN` | *(required)* | `-node-token ptx_…` |
| `-prev-node-token` | `PROXTREE_PREV_NODE_TOKEN` | *(empty)* | `-prev-node-token ptx_old…` |
| `-mtls-ca` | `PROXTREE_MTLS_CA` | *(empty)* | `-mtls-ca /etc/proxtree/mtls/ca.pem` |
| `-tls-cert` | `PROXTREE_TLS_CERT` | *(empty)* | `-tls-cert /etc/proxtree/mtls/agent.pem` |
| `-tls-key` | `PROXTREE_TLS_KEY` | *(empty)* | `-tls-key /etc/proxtree/mtls/agent-key.pem` |
| `-metrics-path` | `PROXTREE_METRICS_PATH` | `/v1/metrics` | `-metrics-path /metrics` |
| `-version` | *(none)* | — | `proxtreed -version` → `1.3.1` |

`-version` prints the bare version string and exits without opening the database or binding a port, so it is safe in health scripts. The probe target and probe interval are env-only; there is no flag for either.

### Foreground versus systemd

For debugging, run it in the foreground so logs go straight to your terminal:

```bash
set -a; . /etc/proxtree/proxtreed.env; set +a
/opt/proxtree/bin/proxtreed -heartbeat-interval 5s
```

In production it runs under `proxtreed.service` and should be restarted as a unit (`sudo systemctl restart proxtreed`). Running the binary directly is only normal for `--no-service` installs.

### A healthy startup log

```text
level=WARN  msg="PROXTREE_CONTROL_PLANE_URL not set; heartbeat disabled"
level=INFO  msg="proxtreed started" version=1.3.1 listen=[::]:9090 db=/opt/proxtree/var/proxtreed.db heartbeat_interval=15s probe_target=1.1.1.1:53
```

The `WARN` appears only when no control-plane URL is configured. The `INFO` line always carries the five values worth confirming: version, bound listen address (`[::]:9090` is what `:9090` resolves to), database path, heartbeat interval and probe target. An instance that could not be restored from the local database logs `msg="restore: instance could not be started" id=… error=…` first.

### Log lines worth knowing

| Line | Level | Means |
|---|---|---|
| `msg="restored instance" id=… port=… ip=…` | INFO | A non-expired instance was re-bound from local SQLite at startup, with no control-plane round trip. |
| `msg="instance recreated" id=… port=… ip=…` | INFO | A sync changed a listener (new instance, or changed port/IP/protocols) and it was rebound. |
| `msg="instance removed" id=… port=…` | INFO | The instance was absent from the pushed desired state; its listener was closed and its credential deleted. |
| `msg="instance failed to start" id=… port=… ip=… error=…` | ERROR | A listener could not bind. The sync response reports it, so provisioning fails rather than selling a dead proxy. |
| `msg="instance ip is not assigned to a local interface; attempting anyway" id=… ip=…` | WARN | The control plane pushed an instance on an address this host does not own. It cannot carry traffic. |
| `msg="instance IP cannot reach the network; it will not be sold" ip=… target=… error=…` | WARN | The prober failed from this address. Logged once per transition into failure; the IP is excluded from stock. |
| `msg="instance expired; torn down" id=… port=…` | INFO | `expires_at` passed; the janitor tore down the listener and deleted the credential locally. |
| `msg="heartbeat failed; operating autonomously, will retry" error=… next_in=…` | WARN | The heartbeat failed. The agent keeps serving and retries with backoff capped at 2 minutes. |
| `msg="heartbeat target unreachable — is PROXTREE_CONTROL_PLANE_URL correct? …"` | WARN | Emitted once on the first connectivity failure, with the 9090/8080 port hint. A configuration smell, not a transient outage. |
| `msg="heartbeat recovered; control plane reachable again"` | INFO | The first heartbeat after a failure streak succeeded. |
| `msg="shutdown timed out; some connections did not drain"` | WARN | `SIGTERM` arrived and connections did not close within the ten-second drain. |

On the control-plane side, sync failures appear as `agent sync failed node=<name> (<id>): <error>`, and any per-instance error makes the sync response `ok=false` — which fails provisioning with `502 agent_sync_failed` instead of selling a proxy that never bound.

---

## The installer

`packaging/install.sh` is both the installer and the operational tool for reconfiguring a node. It is POSIX `sh`, idempotent, and supports Linux (apt/dnf/yum/pacman/apk, systemd) and macOS (brew, launchd); on Windows run the shipped binaries directly.

### Installing

```bash
# Everything, creating a local PostgreSQL if none is running.
sudo sh install.sh

# Control plane against a managed database, no local Postgres.
sudo sh install.sh --only control-plane \
  --db-url 'postgres://proxtree:pw@db.internal:5432/proxtree?sslmode=require'
```

Useful flags: `--only control-plane|agent|all`, `--prefix DIR`, `--config-dir DIR`, `--master-key KEY`, `--cp-listen ADDR`, `--db-url URL`, `--no-db`, `--node-token TOKEN`, `--agent-listen ADDR`, `--cp-url URL`, `--prev-node-token T`, and `--service`/`--no-service`. Re-running with no flags upgrades the binaries and reconciles config **without changing anything that works**: ports, URLs, the database password, master key and node token are reused from the existing env files unless the matching flag is passed. A re-run cannot silently repoint a working install.

### Upgrading

```bash
sudo sh install.sh            # same flags as the original install
```

Binaries are copied aside and moved into place atomically, so replacing a running binary is safe; the units restart afterwards. Migrations run as part of the control-plane step.

### Reconfiguring the agent

```bash
# Move the heartbeat target. The flag must be explicit, or the old value is reused.
sudo sh install.sh --only agent --node-token ptx_… --cp-url https://cp.example.com
```

The installer refuses a `--cp-url` that points at the agent's own port on localhost — the agent cannot heartbeat to itself:

```text
[warn] PROXTREE_CONTROL_PLANE_URL port (9090) equals the agent's own listen port.
[ok]   refusing to configure a heartbeat target that cannot work
```

It then probes `${cp-url}/healthz`; if nothing answers it scans `8080`, `8081` and `18081` and prints the URL to use, without failing the install — the agent enforces credentials and expiry autonomously.

### Adding a second agent on the same host

Use a distinct prefix, config directory and listen address, and a node token from a separate node registration:

```bash
sudo sh install.sh --only agent \
  --prefix /opt/proxtree-agent2 \
  --config-dir /etc/proxtree-agent2 \
  --agent-listen :9091 \
  --node-token ptx_second… \
  --cp-url https://cp.example.com \
  --no-service
```

Two follow-ups:

1. **Give it a disjoint port range.** The installer cannot know about the first agent, so set it on the control plane: `PATCH /v1/nodes/<second-node> {"port_range_start": 20001, "port_range_end": 60000}`. Overlapping ranges mean colliding listener binds.
2. **Supervise it yourself.** The installer always names the unit `proxtreed.service`, so a second agent with services enabled would overwrite the first agent's unit. `--no-service` avoids that: write a separate unit (`proxtreed-agent2.service`) pointing at `EnvironmentFile=/etc/proxtree-agent2/proxtreed.env` and `ExecStart=/opt/proxtree-agent2/bin/proxtreed`.

### `--no-service` mode and `proxtree-start.sh`

`--no-service` is the container and no-init-system mode. It writes `$PREFIX/bin/proxtree-start.sh` and starts the selected components with `nohup`, recording PIDs under `$PREFIX/var`:

```bash
# Start (writes /opt/proxtree/var/*.pid and /opt/proxtree/log/*.log)
/opt/proxtree/bin/proxtree-start.sh

# Stop everything it started
kill $(cat /opt/proxtree/var/*.pid)
```

The script sources each env file with `set -a`, so the same `0600` files drive a container install. It is the only supported way to run ProxTree without an init system.

---

## Service management

Both units are ordinary systemd services. The installer enables and starts them; after that, use systemd.

| Task | Control plane | Agent |
|---|---|---|
| Start | `sudo systemctl start control-planed` | `sudo systemctl start proxtreed` |
| Stop | `sudo systemctl stop control-planed` | `sudo systemctl stop proxtreed` |
| Restart (after an env edit) | `sudo systemctl restart control-planed` | `sudo systemctl restart proxtreed` |
| Status | `sudo systemctl status control-planed` | `sudo systemctl status proxtreed` |
| Enable at boot | `sudo systemctl enable control-planed` | `sudo systemctl enable proxtreed` |
| Reload unit file | `sudo systemctl daemon-reload` | `sudo systemctl daemon-reload` |
| Follow logs | `journalctl -u control-planed -f` | `journalctl -u proxtreed -f` |
| Recent logs | `journalctl -u control-planed -n 100` | `journalctl -u proxtreed -n 100` |
| Logs since a time | `journalctl -u control-planed --since '15 min ago'` | `journalctl -u proxtreed --since '15 min ago'` |

Both units use `Restart=always` with a 3-second delay, so a crash loop shows up as repeating log lines rather than a dead service. On macOS the installer writes launchd plists to `/Library/LaunchDaemons/org.proxtree.<name>.plist` with logs in `$PREFIX/log/<name>.log`; on a host with no init system, manage `$PREFIX/bin/proxtree-start.sh`.

---

## Verifying a deployment

```bash
# 1. Control plane: unauthenticated health.
curl -s http://127.0.0.1:8080/healthz
# {"status":"ok"}

# 2. Agent health. Every agent endpoint requires the node token.
NODE_TOKEN=$(sed -n 's/^PROXTREE_NODE_TOKEN=//p' /etc/proxtree/proxtreed.env | tr -d "'")
curl -s -H "Authorization: Bearer $NODE_TOKEN" http://127.0.0.1:9090/v1/health
# {"status":"ok","version":"1.3.1","uptime_seconds":42}

# 3. Agent status: listeners, self-reported IPs, reachability.
curl -s -H "Authorization: Bearer $NODE_TOKEN" http://127.0.0.1:9090/v1/status \
  | jq '{bound_ips, unreachable_ips, load, ip_health}'

# 4. Metrics on the control channel (Prometheus by default).
curl -s -H "Authorization: Bearer $NODE_TOKEN" http://127.0.0.1:9090/v1/metrics
curl -s -H "Authorization: Bearer $NODE_TOKEN" 'http://127.0.0.1:9090/v1/metrics?format=json'
curl -s -H "Authorization: Bearer $NODE_TOKEN" 'http://127.0.0.1:9090/v1/metrics?format=influx'

# 5. Schema state (applies pending migrations, then exits).
sudo sh -c 'set -a; . /etc/proxtree/control-planed.env; set +a; \
  /opt/proxtree/bin/control-planed migrate'
```

Reading the agent's status output:

| Field | Meaning |
|---|---|
| `bound_ips` | Addresses the agent found on its own interfaces. A registered IP missing here is never sold. |
| `ip_health` | Map of IP to `{reachable, checked_at, error}` from the prober. |
| `unreachable_ips` | The subset with `reachable: false` — bound but not routed. Excluded from stock. |
| `load` | `active_conns` and `goroutines`. |
| `instances[]` | Per-instance `active_conns`, `bytes_in`, `bytes_out`, `uptime_seconds`, `last_seen` (RFC3339 or `null`). |

`ip_health` and `unreachable_ips` also ride along in every heartbeat and are stored on the control plane, so the same view is available without touching the node:

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://127.0.0.1:8080/v1/nodes/$NODE_ID \
  | jq '{status, bound_ips, ip_health, ip_drift, unreachable_ips, free_slots}'
```

`ip_drift` (registered but not present on the host) and `unreachable_ips` (provider routing problem) are different faults, and neither is ever sold.

---

## Routine operations

All API calls need an admin token (`Authorization: Bearer $ADMIN_TOKEN`) and `Content-Type: application/json`. Errors are always `{"error":{"code","message"}}`.

### Register a node

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/nodes \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"de-1","url":"http://10.0.0.10:9090","location":"de",
       "port_range_start":10000,"port_range_end":60000}'
```

The response has `node.id` and `token`. The token is shown exactly once — put it in `/etc/proxtree/proxtreed.env` as `PROXTREE_NODE_TOKEN`.

### Add IPs

```bash
# A shared (oversell) address with an explicit cap.
curl -sS -X POST http://127.0.0.1:8080/v1/nodes/$NODE_ID/ips \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"address":"203.0.113.7","mode":"oversell","max_instances":20,"label":"de-pool-1"}'
```

Swap in `"mode":"dedicated"` (and drop `max_instances`) for an exclusive address. A whole block cannot be rewritten in place, so delete and re-add it if the mode is wrong.

### Add a whole CIDR

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/nodes/$NODE_ID/ips \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"cidr":"203.0.113.0/29","mode":"oversell","max_instances":50}'
```

The block is expanded into individual addresses — at most 256 per call, so a larger prefix must be split. For IPv4 blocks wider than `/31` the network and broadcast addresses are dropped (`/29` yields six usable addresses). Every address must already exist on an interface; the agent reports them on its next heartbeat, and until then none are sellable.

### Raise a node's port range

```bash
curl -sS -X PATCH http://127.0.0.1:8080/v1/nodes/$NODE_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"port_range_end":61000}'
```

`PATCH` accepts any subset of `name`, `url`, `location`, `port_range_start`, `port_range_end`. The range must satisfy `1 <= start < end <= 65535` or the call fails with `422 invalid_port_range`. Keep ranges disjoint from any other agent on the same host.

### Rotate a node token without downtime

```bash
# 1. Get a new token for this node.
NEW_TOKEN=$(curl -sS -X POST http://127.0.0.1:8080/v1/nodes/$NODE_ID/token/rotate \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r .token)

# 2. On the node: install the new token, keep the old one accepted, restart.
sudo sed -i "s|^PROXTREE_NODE_TOKEN=.*|PROXTREE_NODE_TOKEN=$NEW_TOKEN|" \
  /etc/proxtree/proxtreed.env
echo "PROXTREE_PREV_NODE_TOKEN=$OLD_TOKEN" | sudo tee -a /etc/proxtree/proxtreed.env
sudo systemctl restart proxtreed

# 3. Once the cutover is confirmed, drop the previous token.
sudo sed -i '/^PROXTREE_PREV_NODE_TOKEN=/d' /etc/proxtree/proxtreed.env
sudo systemctl restart proxtreed
```

The agent accepts either token during the window, and the control plane keeps the previous token valid until the next rotation, so there is no downtime in either direction. Leaving the previous token set leaves a retired credential accepted indefinitely.

### Take instances or a node out of rotation

There is **no node-level drain or maintenance flag**. A node's `status` is written only by the heartbeat path (`online`) and the sweeper (`offline`); no endpoint sets it. What exists:

| Goal | What to do |
|---|---|
| Stop one customer's proxy | `POST /v1/proxies/{id}/suspend` stops serving while keeping the record, port and IP; `POST /v1/proxies/{id}/resume` restores it. |
| Free the port and IP | `DELETE /v1/proxies/{id}` deletes the instance and frees the allocation. |
| Remove a node from allocation | `DELETE /v1/nodes/{id}`. It returns `409 node_in_use` while instances are active; `?force=true` deletes those instances too (the agent is told to tear down first, best effort). |
| Exhaust a node's capacity | Remove its IPs (only when unused — `409 ip_in_use` otherwise), or narrow its port range so no free port remains. |

Two non-solutions: stopping the agent makes the node go offline after `PROXTREE_HEARTBEAT_TIMEOUT`, but a graceful stop also tears down every listener, so existing customers lose service. Changing the node's `url` does not remove it from allocation at all (allocation is driven by IPs and capacity) and merely breaks the control plane's syncs to that agent.

```bash
# Suspend every instance of a node before a planned removal.
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://127.0.0.1:8080/v1/proxies?node_id=$NODE_ID" | jq -r '.instances[].id' \
  | xargs -I{} curl -sS -X POST "http://127.0.0.1:8080/v1/proxies/{}/suspend" \
      -H "Authorization: Bearer $ADMIN_TOKEN"
```

> **Generated from** `controlplane/cmd/control-planed/main.go`, `agent/cmd/proxtreed/main.go`, `packaging/install.sh` and the routes in `controlplane/internal/httpapi/server.go`. Where the source and this page disagree, the source wins.
