---
title: Configuration Reference
description: Every ProxTree configuration value — control-plane and agent environment variables, agent flags, node, IP and Paymenter product settings, plus the mistakes that break a deployment.
---

# Configuration Reference

> **The definitive reference for every ProxTree setting.**
> Generated from the actual defaults in `controlplane/internal/config/config.go`,
> `agent/internal/config/config.go` and `packaging/install.sh`. Last updated for
> ProxTree v1.0.0 (agent build 1.3.1).

[[toc]]

---

## Overview

ProxTree is configured in two places, and every value has exactly one home:

| Component | Binary | Configuration file | Default path |
|---|---|---|---|
| Control plane | `control-planed` | `control-planed.env` | `/etc/proxtree/control-planed.env` |
| Node agent | `proxtreed` | `proxtreed.env` | `/etc/proxtree/proxtreed.env` |

Both files are plain `KEY=value` shell-style files. The installer writes them
with mode `0600` inside a `0700` directory (they hold the database password, the
master key and the node token). The same files are loaded verbatim by the
systemd units via `EnvironmentFile=`, so there is no separate configuration
syntax to learn — a value you can put in the file is a value the process reads
from its environment.

::: warning Editing by hand
The installer never overwrites a file without a reason, but it does rewrite the
whole file on each run. If you hand-edit an env file, that edit survives until
the next `install.sh` run; after the run, re-check the file before restarting.
Changes take effect only when the unit restarts:

```bash
sudo systemctl restart control-planed   # or proxtreed on a node
```
:::

Two behavioural differences worth knowing up front:

- The **control plane ignores a malformed duration** and silently keeps the
  default (it calls `time.ParseDuration` and falls back on error). A typo like
  `PROXTREE_HEARTBEAT_TIMEOUT=90seconds` starts fine with 90s, and nothing warns
  you.
- The **agent refuses to start** on a malformed or non-positive duration, so a
  typo surfaces immediately in `journalctl -u proxtreed`.

---

## Control plane configuration

| Variable | Default | Type | What it does | When to change it |
|---|---|---|---|---|
| `PROXTREE_DATABASE_URL` | *(required)* | string (DSN) | PostgreSQL connection string used for everything: nodes, IPs, instances, credentials, rotations, audit, tokens. `control-planed` refuses to start without it. | Always — there is no default. Use `--db-url` on the installer for an external database. |
| `PROXTREE_MASTER_KEY` | *(required)* | string (base64, exactly 32 decoded bytes) | AES-256-GCM key used to encrypt proxy credentials and node tokens at rest. | Once, at install. Changing it invalidates everything already encrypted (see below). |
| `PROXTREE_LISTEN_ADDR` | `:8080` | string (`host:port`) | Address the API and `/healthz` listen on. Addressed as a listen spec, not a URL. | Change the port when 8080 is taken, or bind to a specific interface instead of all. |
| `PROXTREE_BASE_URL` | `http://127.0.0.1:8080` | string (URL) | The heartbeat target the control plane reports for its agents — printed in the boot log as `agent heartbeat target: …`. Agents are pointed at it separately, via their own `PROXTREE_CONTROL_PLANE_URL`. | Set it to the address every node can actually reach (for example `https://cp.example.com`) so the log tells the truth when you are troubleshooting heartbeats. |
| `PROXTREE_AGENT_TIMEOUT` | `5s` | duration | Per-call timeout when the control plane pushes desired state to a node agent (`POST /v1/instances/sync`). | Raise it on slow or heavily loaded nodes so a legitimate sync is not aborted. |
| `PROXTREE_HEARTBEAT_TIMEOUT` | `90s` | duration | A node with no heartbeat for this long is marked **offline**. Offline nodes are excluded from provisioning. | Lower it to detect dead nodes faster; must stay comfortably above the agent's heartbeat interval. |
| `PROXTREE_SWEEP_INTERVAL` | `10s` | duration | Sweeper cadence: how often stale nodes are marked offline and expired instances are expired. | Almost never. Lower it only if you need faster offline/expiry reaction. |
| `PROXTREE_RECONCILE_INTERVAL` | `30s` | duration | How often the full desired state is re-pushed to every online node. Convergence safety net that repairs drift. | Raise it on large fleets to cut sync traffic; lower it for faster self-healing. |
| `PROXTREE_ROTATION_COOLDOWN` | `10m` | duration | An IP released by an instance is not offered back to that instance during this window. | Raise it when a customer should not receive the same address soon again; lower it on IP-starved nodes. |

The installer sets `PROXTREE_DATABASE_URL`, `PROXTREE_MASTER_KEY`,
`PROXTREE_LISTEN_ADDR` and `PROXTREE_BASE_URL`. The three interval knobs and the
cooldown are left at their defaults unless you add them by hand.

### `PROXTREE_MASTER_KEY`

The value is the base64 encoding of exactly 32 random bytes. The installer
generates it with `openssl rand -base64 32` (or
`head -c 32 /dev/urandom | base64` when `openssl` is absent). Startup validates
both properties and fails loudly otherwise:

| Failure | Message |
|---|---|
| Missing | `PROXTREE_MASTER_KEY is required (32 bytes, base64)` |
| Wrong length or not base64 | `PROXTREE_MASTER_KEY must be 32 bytes base64-encoded` |

The key protects two things at rest:

- **Proxy credentials** — a password is re-encrypted whenever a credential is
  created or reset; the plaintext is only returned to the caller at that moment.
- **Node tokens** — stored hashed *and* encrypted, because the control plane must
  present the plaintext token when it calls the agent.

::: danger The master key is not rotatable in place
There is no re-encryption command. If you replace `PROXTREE_MASTER_KEY`, every
existing ciphertext is undecryptable: node syncs fail with
`decrypt node token`, and credentials can no longer be read. The only safe path
is to keep the key, store it in your secret manager, and back it up alongside
the database. If it is lost, you must re-register nodes (new tokens) and reset
customer credentials.
:::

### `PROXTREE_AGENT_TIMEOUT`

Every push to an agent runs under this timeout. Provisioning is synchronous:
`POST /v1/proxies` pushes the full desired state to the node before it commits, so
a sync that exceeds the timeout fails the sale with `502 agent_sync_failed` and a
compensating transaction removes the rows it just wrote. Nothing half-exists, but
the customer sees a failed purchase.

Raise it when a node legitimately needs longer to answer — a busy agent applies
the whole inventory on every sync, so a node hosting thousands of listeners can
take more than five seconds. Lowering it below the node's real apply time turns
slow-but-healthy nodes into failed sales.

### `PROXTREE_HEARTBEAT_TIMEOUT`

This is the offline threshold. A node's `status` is `online` only while it keeps
beating; the sweeper (every `PROXTREE_SWEEP_INTERVAL`) flips anything older than
this to `offline`, and logging records it:

```text
sweeper: 1 node(s) marked offline (no heartbeat for 1m30s)
```

Offline nodes are invisible to provisioning, so this timeout is the difference
between "a rebooted node stops taking orders" and "customers buy proxies that no
one can deliver".

It interacts directly with the agent's retry behaviour. The agent retries a
failed heartbeat with exponential backoff — `15s → 30s → 60s → …` capped at
**2 minutes**. If `PROXTREE_HEARTBEAT_TIMEOUT` is shorter than that cap, a
transient control-plane outage longer than the timeout can mark a node offline
even though its next retry was already in flight. Keep the timeout well above
two minutes if you care about avoiding flapping, and above the agent's
`PROXTREE_HEARTBEAT_INTERVAL` by a comfortable margin regardless.

::: tip Nodes keep serving while offline
Losing heartbeats does not stop a node. The agent enforces credentials, ports,
limits and expiry from its local SQLite database, so existing customers are
unaffected. What an offline node loses is new provisioning and reconciler
pushes.
:::

### `PROXTREE_RECONCILE_INTERVAL`

The reconciler re-pushes the complete desired state to every online node on this
cadence. It is convergent by design: the agent reconciles to exactly the set it
is given, so a dropped sync, a node that rebooted from an older state, or a
listener someone killed by hand is repaired automatically within one interval.

```mermaid
graph LR
    A[Database desired state] --> B[Reconciler every 30s]
    B --> C[Agent applies full inventory]
    C --> D{Drift?}
    D -- yes --> C
    D -- no --> E[No change]
```

Raise the interval on a large fleet where per-node syncs dominate traffic; lower
it when you want faster repair after a node restart. It is a safety net, not the
primary path — normal provisioning pushes immediately.

### `PROXTREE_ROTATION_COOLDOWN`

When a rotation is accepted, the control plane picks a replacement IP on the same
node, preferring addresses the instance has **never** used (tracked in
`ip_history`) and excluding any IP released within this cooldown. The instance
receives a new IP **and a new port**.

The cooldown exists so a freshly released address is not immediately reassigned
to the same customer mid-rotation, where it could look like the rotation did
nothing. It is a preference filter, not a hard reservation: if no better IP
exists, rotation resolves as `no_slots` and the request is left pending rather
than silently failing.

---

## Agent configuration

| Variable | Default | Type | What it does | When to change it |
|---|---|---|---|---|
| `PROXTREE_NODE_TOKEN` | *(required)* | string | Node bearer token issued once by `POST /v1/nodes`. Every request the control plane makes to the agent is authenticated with it. | At registration, and on token rotation. The agent refuses to start without it. |
| `PROXTREE_PREV_NODE_TOKEN` | *(empty)* | string | The previous node token, accepted in addition to the current one during a rotation window. | Only during a zero-downtime token rotation; remove it afterwards. |
| `PROXTREE_LISTEN` | `:9090` | string (`host:port`) | Address of the agent's control channel (health, sync, status, metrics). | Change the port so each agent on a host is unique, or bind a specific interface. |
| `PROXTREE_CONTROL_PLANE_URL` | *(empty)* | string (URL) | Base URL the agent heartbeats to (`POST {url}/v1/nodes/heartbeat`). Empty disables heartbeats entirely. | Set it on every production node. The agent cannot discover the control plane. |
| `PROXTREE_DB_PATH` | `/var/lib/proxtree/proxtree.db` | string (path) | SQLite credential database. The installer overrides this to `/opt/proxtree/var/proxtreed.db`. Created at mode `0600` in a `0700` directory. | Change it when the prefix or data directory differs from the install defaults. |
| `PROXTREE_HEARTBEAT_INTERVAL` | `15s` | duration or seconds | Heartbeat cadence. | Lower for faster offline detection; must stay below `PROXTREE_HEARTBEAT_TIMEOUT`. |
| `PROXTREE_PROBE_TARGET` | `1.1.1.1:53` | string (`host:port`) | Host:port the reachability prober dials from each candidate IP to prove outbound routing. | Change to a host your provider is known to route, if `1.1.1.1:53` is blocked on the node. |
| `PROXTREE_PROBE_INTERVAL` | `60s` | duration or seconds | How often IP reachability is re-verified. | Lower it to catch provider routing changes faster; raise it to reduce probe traffic. |
| `PROXTREE_MTLS_CA` | *(empty)* | string (path) | CA bundle the agent uses to require and verify client certificates on the control channel. Empty disables mTLS. | Only when the control-plane→agent leg needs client-certificate verification and the caller can present a cert — see the mTLS caveat below. |
| `PROXTREE_TLS_CERT` | *(empty)* | string (path) | TLS server certificate served by the agent. Required when `PROXTREE_MTLS_CA` is set. | Only with mTLS. |
| `PROXTREE_TLS_KEY` | *(empty)* | string (path) | Private key for `PROXTREE_TLS_CERT`. Required when `PROXTREE_MTLS_CA` is set. | Only with mTLS. |
| `PROXTREE_METRICS_PATH` | `/v1/metrics` | string (path) | Path the Prometheus/JSON/Influx metrics endpoint is mounted on, on the control channel. | Only when a scraper expects a different path. |

The installer writes `PROXTREE_NODE_TOKEN`, `PROXTREE_LISTEN`,
`PROXTREE_CONTROL_PLANE_URL`, `PROXTREE_DB_PATH` and
`PROXTREE_HEARTBEAT_INTERVAL` (plus `PROXTREE_PREV_NODE_TOKEN` when
`--prev-node-token` was passed). The probe, mTLS and metrics settings are left at
their defaults unless you add them by hand.

### The reachability prober

An IP address being assigned to an interface does **not** mean the network
carries it. A provider can fail to route an address to the server; a listener
bound to it accepts connections and every outbound dial silently dies — a proxy
that looks alive and passes nothing. ProxTree therefore verifies routing instead
of assuming it.

Every `PROXTREE_PROBE_INTERVAL`, the agent opens a TCP connection to
`PROXTREE_PROBE_TARGET` **bound as the source address** of each candidate IP
(the dialer sets `LocalAddr`). The probed set is the control plane's registered
inventory for that node — sent with every sync as `probe_ips`, so an address is
checked *before* it can be sold — plus any address an instance currently serves.

An IP is sellable only when both gates pass:

```mermaid
graph TD
    A[Registered IP] --> B{Agent reports it in bound_ips?}
    B -- no --> X[Excluded from capacity]
    B -- yes --> C{Prober found it reachable?}
    C -- no --> X
    C -- yes --> D[Sellable]
```

Both checks fail open when the node has never reported, so a fresh install keeps
working. Results appear in `/v1/status` (`ip_health`, `unreachable_ips`) and in
every heartbeat; the control plane stores them as `nodes.ip_health`. Unreachable
IPs are excluded from stock, returned as `unreachable_ips`, warned about on the
admin Nodes page, and named in provision errors and the storefront out-of-stock
message.

A transition into failure is logged once, not every round:

```text
level=WARN msg="instance IP cannot reach the network; it will not be sold" ip=203.0.113.7 target=1.1.1.1:53 error="dial tcp 203.0.113.7:0->1.1.1.1:53: i/o timeout"
```

To make such an address sellable, fix the routing at the provider or remove the
registration — the platform never guesses. If the default target itself is
unreachable from your network, point `PROXTREE_PROBE_TARGET` at any host that
answers reliably.

### The previous-token rotation window

Node tokens are shown exactly once, when the node is registered or when
`POST /v1/nodes/{id}/token/rotate` is called. The control plane keeps the
previous token valid until the *next* rotation, which is what makes a
zero-downtime cutover possible: rotate the node, put the new token in
`PROXTREE_NODE_TOKEN` and the old one in `PROXTREE_PREV_NODE_TOKEN`, restart the
agent, then remove the previous token.

The agent accepts either token during the window (compared in constant time
against SHA-256 digests), so a control-plane call holding the old token still
authenticates while the node settles. Set `PROXTREE_PREV_NODE_TOKEN` only for the
duration of the rotation and clear it afterwards — leaving it set leaves a
retired credential accepted indefinitely.

### mTLS setup

Bearer tokens authenticate the caller; mTLS additionally proves the caller holds
a key. Setting `PROXTREE_MTLS_CA` switches the control channel to TLS with
`RequireAndVerifyClientCert` (TLS 1.2 minimum). All three files are then
mandatory, and the agent fails at startup with a precise error if a certificate is
missing:

```text
control: mTLS requires a server certificate (PROXTREE_TLS_CERT/PROXTREE_TLS_KEY): ...
control: no certificates found in <ca-file>
control: read mTLS CA file: ...
```

Because this is **mutual** TLS, the caller must also present a client certificate
signed by that CA, and the node URL must use `https://` — the agent serves TLS
only when `PROXTREE_MTLS_CA` is set. The agent's own certificate is what the
control plane verifies, so give it a SAN matching the node's hostname or IP.

::: warning The shipped control plane cannot present a client certificate
`control-planed`'s agent client uses Go's default TLS configuration: system roots,
no client certificate, and no configuration knob to add one. Enabling
`PROXTREE_MTLS_CA` therefore secures the agent's inbound channel but breaks the
control plane's own calls to it (`/v1/instances/sync`, `/v1/status`), which fail
with `502 agent_sync_failed` and a TLS error. Heartbeats keep working — the agent
initiates those over plain HTTP to the control plane.

To use mTLS today, terminate the authenticated leg outside the stock control
plane: point the node's `url` at a local forwarder or sidecar that holds the
client certificate and proxies to the agent, or build the control plane with a
client-certificate transport. Treat the bearer node token as the supported
control-channel authentication until then.
:::

---

## Agent command-line flags

Every agent setting can be overridden with a flag. Flags are parsed *after* the
environment, so a flag always wins; the default shown in the table is the value
that applies when neither a flag nor an env variable is set.

| Flag | Env equivalent | Default | Notes |
|---|---|---|---|
| `-listen` | `PROXTREE_LISTEN` | `:9090` | Agent control-channel listen address. |
| `-db-path` | `PROXTREE_DB_PATH` | `/var/lib/proxtree/proxtree.db` | SQLite credential database path. |
| `-control-plane-url` | `PROXTREE_CONTROL_PLANE_URL` | *(empty — heartbeats disabled)* | Heartbeat target base URL. |
| `-heartbeat-interval` | `PROXTREE_HEARTBEAT_INTERVAL` | `15s` | Go duration (`15s`, `1m`). |
| `-node-token` | `PROXTREE_NODE_TOKEN` | *(none — required)* | Starting without one is an error: `PROXTREE_NODE_TOKEN (or -node-token) is required`. |
| `-prev-node-token` | `PROXTREE_PREV_NODE_TOKEN` | *(empty)* | Accepted in addition to the current token. |
| `-mtls-ca` | `PROXTREE_MTLS_CA` | *(empty)* | CA file; enables client-certificate verification. |
| `-tls-cert` | `PROXTREE_TLS_CERT` | *(empty)* | TLS server certificate, required with `-mtls-ca`. |
| `-tls-key` | `PROXTREE_TLS_KEY` | *(empty)* | TLS server key, required with `-mtls-ca`. |
| `-metrics-path` | `PROXTREE_METRICS_PATH` | `/v1/metrics` | Metrics path on the control server. |
| `-version` | *(none)* | — | Prints the version and exits; no env equivalent. |

The probe target and probe interval are **env-only** — there is no `-probe-target`
or `-probe-interval` flag. `control-planed` has no flags at all and no `-version`
(see the [CLI reference](/proxtree/user-guide/cli)).

---

## Node-level settings

Node settings are not environment variables. They live in the control plane's
database and are managed with `POST /v1/nodes` (registration) and
`PATCH /v1/nodes/{id}` (edits). `PATCH` accepts any subset of the fields below.

| Field | Type | Default | What it does |
|---|---|---|---|
| `name` | string | *(required on create)* | Human label shown in logs, the API and the addon's admin pages. |
| `url` | string (http/https URL) | *(required on create)* | Base URL the control plane uses to reach the agent. Its port is the node's **reserved** port. |
| `location` | string | *(empty)* | Free-form region label. Products select on it; an empty location means "any". |
| `port_range_start` | int | `10000` | First port the node may allocate to instances. |
| `port_range_end` | int | `60000` | Last port the node may allocate to instances. |

Validation is the same on create and edit. A range must satisfy
`1 <= start < end <= 65535`, otherwise the call fails with
`422 invalid_port_range` and the message
`port range must satisfy 1 <= start < end <= 65535`. A bad URL fails with
`400 bad_request` and `url must be a valid http(s) URL`.

`status`, `last_heartbeat_at`, `bound_ips` and the tokens are deliberately not
editable here — status is written by the heartbeat path and the sweeper, and
tokens have their own rotation endpoint.

### Why co-located agents need disjoint ranges

Listeners bind `0.0.0.0:<port>`, so **a port is unique per node, not per IP**.
Two instances on different IPs of the same node cannot share a port, and two
agents on the same host cannot share a port either — the second bind fails.

Two agents on one host must therefore be given non-overlapping ranges, and each
range must be registered on *its own* node row. If node A owns `10000-20000` and
node B is left at the default `10000-60000`, the first instance B allocates will
collide with A's range and fail to bind. Set B with, for example,
`port_range_start: 20001, port_range_end: 60000`.

### Why the control port is reserved

The control plane parses the port out of the node's `url` and never allocates it
to a proxy instance. Without that rule, an unlucky allocation could hand a
customer the port the agent itself listens on — the listener bind would fail, or
worse, the assignment would look valid while being unreachable. Because changing
`url` changes which port is reserved, the reserved set is recomputed from the
current URL; if you move an agent to a new port, first make sure no instance
already holds it.

---

## IP-level settings

IPs are registered per node with `POST /v1/nodes/{id}/ips` — either a single
`address` or a `cidr` block (at most 256 addresses per call; IPv4 blocks larger
than `/31` drop the network and broadcast addresses) — and edited with
`PATCH /v1/ips/{id}`.

| Field | Type | Default | What it does |
|---|---|---|---|
| `address` | string (IP) | *(required on create)* | The address on the node. It must actually exist on an interface; the platform checks this against the agent's `bound_ips` report. |
| `label` | string | *(empty)* | Free-form annotation for operators. Not used in allocation. |
| `mode` | `dedicated` or `oversell` | `oversell` | Whether the IP is exclusive to one instance or shared by many. |
| `max_instances` | int >= 1 or `null` | `null` | **Oversell only.** Cap on instances bound to this IP. `null` means as many as the ports allow. |

### What each mode yields

| Mode | Capacity contribution | Effect |
|---|---|---|
| `dedicated` | `1` while the IP is unused, `0` once it hosts an instance | Exclusive IP. Exactly one proxy per address, and `max_instances` is ignored — it is forced to `null` on write and is meaningless on read. |
| `oversell` | `max_instances - used`, or the node's whole port-space size when `max_instances` is `null` | Shared IP. Many customers on one address, on different ports, bounded by the cap (or by free ports). |

Notes that decide real stock numbers:

- Setting `mode` to `dedicated` while an IP already hosts **more than one**
  instance is refused with `409 ip_in_use`
  (`cannot switch to dedicated: ip already hosts multiple instances`), because the
  change would leave the existing tenants invalid.
- Capacity is always capped by the node's free ports: an oversell IP cannot
  contribute more slots than the node has ports left.
- A `null` `max_instances` on an oversell IP makes its contribution approximate —
  it is computed as the node's full port-range size, then capped by the free-port
  count. Set an explicit cap when you want a predictable oversell ratio.
- An IP is never counted at all unless it passes both eligibility gates
  (present on the host *and* reachable) — see the prober section above.

---

## Product settings (Paymenter addon)

These are the plan fields a Paymenter product carries. The addon sends them to
`POST /v1/availability/check` for stock and to `POST /v1/proxies` at
provisioning. They are not env vars and are not control-plane configuration —
they are per-product selling decisions.

| Setting | Type | Default | What it does | What goes wrong if misconfigured |
|---|---|---|---|---|
| `location` | select (live from node inventory, cached 60s) | *(empty = any)* | Restricts the plan to nodes with this location. | A typo'd or removed location silently sells nothing: availability falls to zero with the hint "no free dedicated … IP". Leave empty unless you really mean one region. |
| `ip_count` | int, min 1 | `1` | Number of **distinct IPs** the plan provisions. Total instances = `ip_count x instances_per_ip`. | Raising it without enough IPs on a node turns a purchasable plan into `insufficient_capacity`. |
| `instances_per_ip` | int, 1–100 | `1` | Instances (ports) bound on **each** of those IPs. `ip_count: 1, instances_per_ip: 3` = three proxies sharing one IP on three ports. | Above 100 is rejected. Combined with `dedicated` it can never be satisfied (see below). |
| `ip_mode` | `any` / `dedicated` / `oversell` | `any` | Which pool to allocate from. `any` prefers shared capacity and falls back to a dedicated IP only when shared is full; `oversell` never consumes a dedicated IP; `dedicated` never uses a shared one. | `any` does **not** guarantee a dedicated IP. Expecting exclusivity from `any` hands customers shared addresses. |
| `protocol_socks5` | checkbox | on | Enable SOCKS5 with username/password auth on each instance. | Leaving every protocol off makes the plan unprovisionable — at least one must be enabled. |
| `protocol_socks4` | checkbox | off | Enable SOCKS4/4a on each instance. | SOCKS4 has no credential mechanism, so an instance that enables only SOCKS4 accepts any SOCKS4 CONNECT. Access control rests on the unguessable (ip, port) allocation. Enable `socks5` or `http` when per-user auth matters. |
| `protocol_http` | checkbox | on | Enable HTTP CONNECT + forward proxy with Basic auth on each instance. | Disabling it removes a protocol customers commonly expect; instances then only answer SOCKS. |
| `max_conns` | int, min 0 | `0` | Simultaneous connections per instance. `0` = unlimited. | A very low value makes a paid proxy reject legitimate traffic; `0` on a busy plan lets one customer consume a whole node's sockets. |
| `new_conn_rate` | int, min 0 | `0` | New connections per second per instance. `0` = unlimited. | Too low throttles browsers and scanners that open many short-lived connections; `0` removes abuse protection. |

### `dedicated` + `instances_per_ip > 1` is rejected

A dedicated IP hosts exactly one instance, so that combination can never be
satisfied. Rather than report it as "out of stock" — which would send an operator
hunting for capacity that does not exist — the control plane rejects it
explicitly:

```text
422 unsatisfiable_plan
a dedicated IP hosts exactly one instance, so ip_mode=dedicated cannot be combined with instances_per_ip > 1
```

The `instances_per_ip` cap of 100 and the `1..1000` range on `ip_count` are
enforced the same way, with a precise reason instead of a generic failure.

::: info Dedicated plans consume whole IPs
To sell N dedicated plans at once you need N real IPs on the node. With one IP you
can sell either one dedicated plan or many shared plans — not both. This is why
products that require exclusivity typically target a node with a large IP block.
:::

---

## Common mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Wrong port in the agent's `--cp-url` / `PROXTREE_CONTROL_PLANE_URL` (pointing at the agent's own `:9090`) | Repeated `heartbeat failed; operating autonomously, will retry`, with `connection refused`; the node never leaves the offline state | Point the URL at the control plane's port (installer default `8080`). The installer refuses a localhost `--cp-url` whose port equals the agent's own listen port, and warns with the URL that does answer. |
| Using a **node token** as an API token | `401 unauthorized` on every control-plane API call | Node tokens only authenticate `/v1/nodes/heartbeat`. Use an admin or billing token from `POST /v1/tokens` (or the bootstrap token printed on first start) for API calls. |
| Registering an IP that is not on the server | The IP is never sold; `GET /v1/nodes/{id}` shows it in `ip_drift`, and availability reports it in `unreported_ips` | Add the address to an interface on the node (the agent reports it on the next heartbeat) or remove the registration. |
| Marking an IP `dedicated` and expecting many customers on it | Capacity shows `1`; the second sale fails with `insufficient_capacity` | Dedicated means one instance per IP. Use `oversell` with an explicit `max_instances` for sharing. |
| Product `ip_mode: any` while expecting dedicated IPs | Customers on the same plan receive the same IP | `any` prefers shared capacity. Set `ip_mode: dedicated` — and remember each sale then consumes a whole IP. |
| An agent port range overlapping another agent on the same host | Instance binds fail on the second agent; sync responses carry per-instance `errors` and `ok=false` | Give each node a disjoint range with `PATCH /v1/nodes/{id}` (for example `10000-20000` and `20001-60000`). |
| Forgetting the queue worker on the Paymenter side | Orders are paid, but nothing is provisioned; jobs sit in the queue and appear under Failed Jobs after retries | Run a Paymenter queue worker (`queue:work`, `default` queue) **and** the scheduler — provisioning, lifecycle and both sync jobs are queued, and `SyncStockJob`/`ReconcileJob` are dispatched by the scheduler. |
| `PROXTREE_HEARTBEAT_TIMEOUT` set below the agent's `PROXTREE_HEARTBEAT_INTERVAL`, or below the 2-minute retry cap | Nodes flap between online and offline; provisioning skips a node that is actually healthy | Keep the timeout comfortably above the heartbeat interval and above the 2-minute agent retry cap (the default `90s` assumes a responsive control plane). |
| A malformed duration in `control-planed.env` | The setting appears ignored; the default silently applies | The control plane falls back to the default on a parse error. Use Go duration syntax (`5s`, `90s`, `10m`) and confirm the intended value in the `control-plane listening on …` log line. |

---

## Example files

### `/etc/proxtree/control-planed.env`

```ini
# ProxTree control plane — /etc/proxtree/control-planed.env
# Mode 0600. Loaded by systemd via EnvironmentFile=. Restart after editing:
#   sudo systemctl restart control-planed

# PostgreSQL DSN. Required; the daemon exits without it.
# The installer creates proxtree/proxtree and writes sslmode=disable for a
# local database. Point this at a managed database for production.
PROXTREE_DATABASE_URL=postgres://proxtree:CHANGEME@127.0.0.1:5432/proxtree?sslmode=disable

# 32 random bytes, base64. Encrypts credentials and node tokens at rest.
# Generated once by the installer. Never change it on a live install.
PROXTREE_MASTER_KEY=REPLACE_WITH_BASE64_32_BYTES

# API + /healthz listen address.
PROXTREE_LISTEN_ADDR=:8080

# The URL node agents heartbeat to. Set it to an address every node can reach.
PROXTREE_BASE_URL=http://127.0.0.1:8080

# Per-call timeout when pushing desired state to an agent.
PROXTREE_AGENT_TIMEOUT=5s

# A node with no heartbeat for this long is marked offline.
PROXTREE_HEARTBEAT_TIMEOUT=90s

# Sweeper cadence: offline marking and instance expiry.
PROXTREE_SWEEP_INTERVAL=10s

# Full desired-state re-sync cadence to online nodes (drift repair).
PROXTREE_RECONCILE_INTERVAL=30s

# An IP released by an instance is not re-offered to it for this long.
PROXTREE_ROTATION_COOLDOWN=10m
```

### `/etc/proxtree/proxtreed.env`

```ini
# ProxTree node agent — /etc/proxtree/proxtreed.env
# Mode 0600. Loaded by systemd via EnvironmentFile=. Restart after editing:
#   sudo systemctl restart proxtreed

# Node token from POST /v1/nodes. Shown once, at registration. Required.
PROXTREE_NODE_TOKEN=ptx_REPLACE_ME

# Previous token, accepted in addition to the current one. Only during a
# token rotation; remove it once the control plane has the new token.
# PROXTREE_PREV_NODE_TOKEN=ptx_REPLACE_ME_TOO

# Control-channel listen address. Must be unique per agent on this host, and
# its port is reserved on the node (never allocated to a customer).
PROXTREE_LISTEN=:9090

# Control plane base URL for heartbeats. Empty disables heartbeats; the agent
# still enforces credentials, ports and expiry locally.
PROXTREE_CONTROL_PLANE_URL=http://127.0.0.1:8080

# SQLite credential database. The installer uses the data dir under its prefix.
PROXTREE_DB_PATH=/opt/proxtree/var/proxtreed.db

# Heartbeat cadence. Must stay below the control plane's heartbeat timeout.
PROXTREE_HEARTBEAT_INTERVAL=15s

# Reachability probe: dialled from each instance IP to prove it routes.
PROXTREE_PROBE_TARGET=1.1.1.1:53
PROXTREE_PROBE_INTERVAL=60s

# Metrics path on the control channel (Prometheus by default;
# ?format=json and ?format=influx are also supported).
PROXTREE_METRICS_PATH=/v1/metrics

# Mutual TLS. Set all three, or none. The agent then requires a verified client
# certificate, but the stock control plane cannot present one — see the mTLS
# section in the reference before enabling this.
# PROXTREE_MTLS_CA=/etc/proxtree/mtls/ca.pem
# PROXTREE_TLS_CERT=/etc/proxtree/mtls/agent.pem
# PROXTREE_TLS_KEY=/etc/proxtree/mtls/agent-key.pem
```

> **Generated from** `controlplane/internal/config/config.go`,
> `agent/internal/config/config.go`, `agent/cmd/proxtreed/main.go`,
> `controlplane/cmd/control-planed/main.go` and `packaging/install.sh`.
> Where the source and this page disagree, the source wins.
