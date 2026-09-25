---
title: Operations
description: Day-two operations for a ProxTree proxy platform — daily health checks, capacity arithmetic, adding IPs, rotations, maintenance, backups and incident playbooks.
---

# Operations

This page is the runbook for the platform itself: the control plane and its node agents.
Everything here uses the [HTTP API](/proxtree/user-guide/api) with an **admin-role** token.
For the billing side see the [Paymenter addon](/proxtree/user-guide/paymenter).

```bash
export PTX=https://cp.example.com        # control plane base URL
export TOKEN=ptx_...                     # admin-role API token
export NODE=00000000-0000-0000-0000-000000000000   # a node id
```

## Daily checks

1. **Every node is online.** A node turns `online` on its first heartbeat and is flipped
   `offline` by the sweeper when its last heartbeat is older than `PROXTREE_HEARTBEAT_TIMEOUT`
   (default 90 s; agents heartbeat every `PROXTREE_HEARTBEAT_INTERVAL`, default 15 s).

   ```bash
   curl -sS -H "Authorization: Bearer $TOKEN" "$PTX/v1/nodes" \
     | jq -r '.nodes[] | [.name, .status, .location, (.last_heartbeat_at // "never")] | @tsv'
   ```

   Anything not `online`, or `online` with a stale heartbeat, needs attention.

2. **Capacity that is actually sellable.** `free_slots` is what a node can still host after
   exclusions; `free_bundles` is shaped capacity (IPs that can take the requested number of
   instances). Check both per node and as an availability snapshot for the shapes you sell.

   ```bash
   curl -sS -H "Authorization: Bearer $TOKEN" "$PTX/v1/nodes/$NODE" \
     | jq '{active_instances, free_slots, ip_count: (.ips | length)}'

   curl -sS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
     -X POST "$PTX/v1/availability/check" -d '{"ip_count":1,"instances_per_ip":1}' \
     | jq '{available, detail: {free_slots_by_location: .detail.free_slots_by_location,
            free_bundles_by_location: .detail.free_bundles_by_location}}'
   ```

3. **No excluded IPs piling up.** `ip_drift` lists registered addresses the agent has not
   reported as present on the host; `unreachable_ips` lists addresses it probed and could not
   reach. Both are unsellable and both are warned about on the admin **ProxTree Nodes** page.

   ```bash
   curl -sS -H "Authorization: Bearer $TOKEN" "$PTX/v1/nodes/$NODE" \
     | jq '{ip_drift, unreachable_ips, ip_health: .node.ip_health}'
   ```

4. **Billing jobs, if the Paymenter addon is installed.** The queue worker must be running, and
   `php artisan queue:failed` must be empty; `SyncStockJob` (5 min) and `ReconcileJob` (10 min)
   are dispatched by the Paymenter scheduler. See [Paymenter addon](/proxtree/user-guide/paymenter).

5. **Audit log review.** Skim what changed today: node and IP edits, provisions, suspensions,
   rotations and credential resets all write an entry with actor and source IP.

   ```bash
   curl -sS -H "Authorization: Bearer $TOKEN" "$PTX/v1/audit?limit=100" \
     | jq -r '.entries[] | [.created_at, .actor, .action, .resource_type, .resource_id] | @tsv'
   ```

   The endpoint accepts `?action=` and `?resource_type=` filters plus `limit` (max 500).

## Managing capacity

Capacity is counted in **instances**, not IPs, and two different limits apply.

**Per IP, by mode.** A `dedicated` IP contributes 1 instance while it is unused and can never
carry a second one. An `oversell` IP contributes `max_instances - used`, or the size of the
node's port range when `max_instances` is null (meaning unlimited). An IP that is not reported
by the agent, or that the prober found unreachable, contributes nothing.

**Per node, by port space.** Listeners bind `0.0.0.0:<port>`, so a port is unique **per node**,
not per IP. The node's ceiling is `port_range_end - port_range_start + 1`, minus ports already
used by `active` and `suspended` instances, minus the agent's own reserved control port. A node
can run out of ports while IPs still have free slots.

**How many of plan X can I sell?** Availability computes `best_node_free_bundles` across online
nodes, where one bundle is one IP that can take `instances_per_ip` instances. The number of
sellable plans on the best node is:

```text
sellable = best_node_free_bundles / ip_count     # integer division, rounded down
```

Worked example: a node with 7 free bundles and a plan of `ip_count: 3, instances_per_ip: 1`
yields `7 / 3 = 2` sellable plans — the seventh bundle buys you nothing, because a sale is
all-or-nothing across three distinct IPs. The same node with `ip_count: 1, instances_per_ip: 3`
against 4 free bundles yields 4 plans only if 12 ports are free; with 9 free ports the port space
caps it at 3. Provisioning targets **one** node, so per-node numbers are what matter, and
`free_bundles_by_location` tells you where to add capacity.

## Adding IPs

Order matters, but not for the reason you might expect.

1. **Assign the address on the host** — through your provider's panel, or on the machine:

   ```bash
   sudo ip addr add 203.0.113.10/32 dev eth0
   ```

2. **Confirm it can actually reach the network**, from the same source address:

   ```bash
   curl --interface 203.0.113.10 -sS --max-time 5 -o /dev/null -w '%{http_code}\n' https://1.1.1.1
   ```

   A `200` means the address is routed. A timeout or "cannot assign requested address" means it
   is not — fix that before registering it.

3. **Register it on the node.** A single address, with the mode and (for oversell) a cap:

   ```bash
   curl -sS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
     -X POST "$PTX/v1/nodes/$NODE/ips" \
     -d '{"address":"203.0.113.10","mode":"oversell","max_instances":10,"label":"de-fra extra"}'
   ```

   To add a whole block at once, send `{"cidr":"203.0.113.0/29","mode":"oversell"}` instead of
   `address`.

Registering *before* the address exists is harmless: an IP is sellable only when the agent
reports it in `bound_ips` **and** the prober has not found it unreachable, so the platform simply
refuses to sell an address the server does not have or cannot route. It will not be counted as
capacity, and the admin page will warn about it. Confirming first avoids the confusing
intermediate state where you registered an IP, saw no new capacity, and started hunting for a
platform bug. Capacity appears on the agent's next heartbeat after the interface exists.

## Handling unroutable and missing IPs

Two independent gates decide whether an IP can be sold, and each has its own failure class.

| Class | Meaning | Where it shows up |
|---|---|---|
| Not on the server | The address is registered but missing from the agent's `bound_ips` — it does not exist on an interface. | `ip_drift` on the node, `unreported_ips` in availability, the amber **"not on server"** warning on the Nodes page. |
| Unreachable | The address exists on an interface but the prober could not dial the network from it. | `unreachable_ips` on the node and in availability, per-IP `ip_health`, the red **"unreachable"** warning on the Nodes page. |

Both are excluded from stock, both are named in the `hint` field of an availability response so
an operator can act instead of guessing, and both make provisioning refuse rather than hand a
customer a proxy that cannot pass traffic. ("Not on server" is only flagged once the node has
reported at least once — a brand-new node with no heartbeat yet fails open so a fresh install
keeps working.)

There are exactly two resolutions:

- **Make the address usable.** For "not on server", configure it on an interface. For
  "unreachable", ask your provider to route the address; if they cannot, it is not usable here.
  The agent reports fix-ups on its next heartbeat (15 s) and re-probes on
  `PROXTREE_PROBE_INTERVAL` (default 60 s).
- **Remove it** so it stops confusing the numbers:
  `curl -H "Authorization: Bearer $TOKEN" -X DELETE "$PTX/v1/ips/$IP_ID"`. Removing an IP that
  instances are bound to is refused with `409 ip_in_use`.

## Rotation operations

A customer requests an IP rotation; an operator resolves it. The queue lives on the admin
**ProxTree Rotations** page, and the API equivalent is:

```bash
# what is waiting
curl -sS -H "Authorization: Bearer $TOKEN" "$PTX/v1/rotations?status=pending" | jq '.rotations'

# accept / deny / ignore
curl -sS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -X POST "$PTX/v1/rotations/$ROTATION_ID/resolve" -d '{"action":"accept"}'
```

**What `accept` does.** The control plane picks a replacement IP on the **same node**, preferring
IPs the instance has never used (tracked in `ip_history`) and excluding the current IP and any IP
released within `PROXTREE_ROTATION_COOLDOWN` (default 10m). The instance gets a new IP **and a new
port** — a rotation must produce a visibly different binding. The new state is pushed to the agent
before success is reported; if the agent cannot apply it, the move is rolled back and the request
is re-opened (`502 agent_sync_failed`).

**`no_slots`.** If no eligible IP exists, the request resolves as `no_slots`, not as a silent
failure. What to tell the customer: the request was reviewed but the node had no spare address to
move them to, so it was closed **without** an IP change and their current proxy still works. They
can ask again once you add capacity, or you can move them to a different node — which means
terminating the instance and provisioning a replacement, so confirm with them first.

**One IP cannot rotate anyone.** A node with a single address has nowhere to move an instance to,
so every accept resolves `no_slots` (or returns `503 node_offline` if the node is down, leaving
the request pending for a retry). Add IPs before promising rotations on that node.

## Suspend, resume, terminate

| Action | Effect on serving | Effect on capacity |
|---|---|---|
| Suspend | The listener is torn down; the proxy stops accepting connections. | **Still consumed** — `active` and `suspended` both count as used for IP slots and node ports. |
| Resume | The listener is restored. The addon extends expiry before resuming, so a renewal while suspended comes back with the right date. | Unchanged (still counted while suspended). |
| Terminate | The instance is deleted and its port is freed. | The IP slot and the port are released back to the node. |

When a customer disputes charges, the recommended sequence is **suspend → investigate → resume
or terminate**:

1. Suspend the service: it stops serving immediately, keeps the binding and the audit trail, and
   is instantly reversible.
2. Check the audit log for the account's provisioning, resets and rotations, and the live
   per-instance status for actual traffic.
3. Resume if the dispute is resolved; terminate only once you are done — termination deletes the
   instances and, on the Paymenter side, wipes the `proxtree_*` properties, so reinstating means a
   fresh provision rather than a flip back.

A suspended service still holds its IP slot and port, so a mass suspension does not free capacity
for resale.

## Credential resets

Use a reset when a credential pair must stop working: a leak, suspected sharing, or a customer
request. It is one call — `POST /v1/proxies/{id}/credentials/reset`.

The control plane swaps the username and password **atomically**, so the old pair dies the moment
the call returns success — there is no overlap window. The new pair is pushed to the agent with
the next sync and the instance's listeners start enforcing it; `max_conns` and `new_conn_rate` are
unchanged.

The customer must update their tooling: every client, script and browser profile using the old
username or password starts failing authentication. Tell them before you press the button, and
remember the reset invalidates **both** values, not just the password.

## Node maintenance

**Draining a node.** There is no cross-node migration primitive — rotation only ever moves an
instance to another IP on the *same* node. So a drain means one of:

- let services expire and stop selling new ones on that node (set the relevant products'
  `location` away, or leave it and rely on capacity), which is the quietest option;
- suspend instances to stop serving while you work, accepting that they still hold capacity;
- terminate and re-provision customers on another node (with their agreement), which releases
  the capacity here.

**Why simply stopping the agent is not enough.** Stopping `proxtreed` leaves the control plane's
records intact: the instances stay `active`/`suspended` and still count against the node's IP
slots and ports, while the node itself goes `offline` after the heartbeat timeout and disappears
from availability. Sales stop, and the records keep consuming capacity that nothing is serving.
Suspending or terminating is what actually frees capacity.

**Changing port ranges when co-locating agents.** Two agents on one host bind `0.0.0.0`, so their
port ranges must be **disjoint** or they will fight over the same ports. Give each node its own
range when you register it, or edit it later with `PATCH /v1/nodes/{id}` passing
`port_range_start` and `port_range_end`. The agent's own control port (parsed from the node URL)
is reserved and never allocated; existing instances keep their ports, and the new range governs
future allocations.

**Rotating a node token without downtime.** Rotate it with
`POST /v1/nodes/{id}/token/rotate`; the response contains the new token (shown once). The
**previous token stays valid until the next rotation**, on both sides of the conversation: the
control plane resolves heartbeats against the current *or* previous node token, and the agent
accepts `PROXTREE_PREV_NODE_TOKEN` on its control channel. So there is a safe window: set the new
token as `PROXTREE_NODE_TOKEN` and keep the old one as `PROXTREE_PREV_NODE_TOKEN`, then restart
the agent. Heartbeats and control-plane pushes continue throughout, and the next rotation retires
the old token.

## Backups and recovery

Back up three things, and treat two of them as irreplaceable:

| What | Where | Why |
|---|---|---|
| PostgreSQL database | control plane's `PROXTREE_DATABASE_URL` | Nodes, IPs, instances, credentials, rotations, IP history, audit log and tokens. |
| Master key | `PROXTREE_MASTER_KEY` (32-byte base64) | Encrypts credentials and node tokens at rest with AES-256-GCM. **Without it the database is useless** — the credential and node-token columns cannot be decrypted. Store it offline, separately from the dump. |
| Agent SQLite file | `PROXTREE_DB_PATH` (default `/var/lib/proxtree/proxtree.db`; installer: `/opt/proxtree/var/proxtreed.db`) | Lets an agent restore its non-expired instances instantly at boot, with no control-plane round trip. Optional, but it makes a node restart a non-event. |

```bash
pg_dump "$PROXTREE_DATABASE_URL" -Fc -f proxtree-$(date +%F).dump
```

**On restore.** Start the control plane (it applies embedded migrations at startup, or on
`control-planed migrate`); the reconciler then re-pushes the full desired state to every online
node each `PROXTREE_RECONCILE_INTERVAL` (default 30 s), so agents converge back to what the
database says. Agents that kept running need no action beyond being reachable; agents that
restarted re-bind their own non-expired instances from local SQLite and then confirm with the
control plane. Restore the database and the master key together and credentials and node tokens
keep working; lose the master key and you must re-issue node tokens and reset every customer
credential.

## Scaling out

Add capacity by registering a node and pointing an agent at the control plane; each node brings
its own IPs and its own port space, so a new node is a new pool, not an extension of an existing
one. Register the node (admin **ProxTree Nodes**, or `POST /v1/nodes`), copy the one-time token
into the agent, and it turns `online` on its first heartbeat.

Spread nodes across locations by using the `location` string consistently, because location is
the only grouping the platform exposes — availability and provisioning both filter on it. The
Paymenter addon's product `location` field is matched against that string:

- Product `location` **empty** → any online node that can fit the shape.
- Product `location` **set** → only nodes with that exact location, so a typo or a renamed
  location silently becomes "out of stock" for that plan.

Keep the names short and stable (`de-fra`, `us-nyc`), and add nodes in pairs for plans with
`ip_count > 1`, so one node failure does not remove all capacity for the shape.

## Incident playbooks

**1. Control plane is down.**

1. Nothing to do for existing proxies: agents enforce credentials, ports, limits and expiry
   locally, and re-bind non-expired instances after a reboot. Traffic keeps flowing.
2. Sales stop. The Paymenter addon fails closed at checkout, so a purchase that cannot be
   provisioned is refused rather than half-completed. Renewals queue up in `SyncExpiryJob` with
   retries.
3. Restart `control-planed` and confirm `GET /healthz` answers; the reconciler resumes pushing
   desired state to agents within `PROXTREE_RECONCILE_INTERVAL`.
4. Verify no drift: compare a few instances' bindings against the dashboard, and check the audit
   log for anything that committed just before the outage.

**2. A node is offline.**

1. Identify it from the nodes list (`status`, `last_heartbeat_at`).
2. On the host, check the agent process and its logs, then the network path (the agent needs to
   reach `PROXTREE_CONTROL_PLANE_URL`, and the control plane needs to reach the node URL).
3. Restart `proxtreed`. A token mismatch shows as repeated 401s; re-read the node token if the
   agent's config was rebuilt.
4. Confirm the heartbeat flips the node back to `online`, then check the instances are still
   served: the agent re-binds everything non-expired from its local database on boot, so a node
   restart does not need the control plane to come back first.

**3. A customer reports a dead proxy.**

1. Confirm the instance is **active** (not suspended or expired) and get its current binding:
   `GET /v1/proxies?external_ref=paymenter-service-<id>` then `GET /v1/proxies/{id}/status`.
2. On the node, confirm the port is listening: `ss -lntp | grep ':<port>'`.
3. Confirm the source IP is the one sold and is routable:
   `curl --interface <ip> -sS --max-time 5 https://1.1.1.1`.
4. Confirm the credentials work, end to end:
   `curl --socks5 user:pass@<ip>:<port> -sS https://api.ipify.org` (and check the returned
   address is the sold IP). Add `--http-proxy`/HTTP CONNECT for an HTTP instance.
5. If the agent is unreachable, the dashboard shows "Status unavailable" but the proxy may still
   be serving — verify from a client before assuming an outage. If the instance is fine but its IP
   is listed in `unreachable_ips`, resolve it as in
   [Handling unroutable and missing IPs](#handling-unroutable-and-missing-ips).

**4. Suspected credential sharing.**

1. Measure it: `active_conns` and `conns_total` per instance (`GET /v1/proxies/{id}/status`, or
   the agent's `/v1/status`). A handful of concurrent connections is normal; hundreds are not.
2. Rotate the credentials to invalidate the shared pair immediately.
3. Tighten the plan: limits (`max_conns`, `new_conn_rate`) are applied at provisioning time from
   the product configuration, and no endpoint edits them on a live instance — so change the
   product for future sales, and re-provision the instance if the customer wants the stricter
   limit now.
4. Note the pattern in the audit log so repeat offenders are visible.

**5. Accidental capacity oversell.**

1. It should be impossible by construction: provisioning locks the node's IP rows `FOR UPDATE`
   in a deterministic order, re-verifies capacity under the lock, then allocates; the unique
   indexes `(ip_id, port)` and `(node_id, port)` for `active`/`suspended` instances are
   database-level backstops.
2. If a race still loses, the loser sees a clean error, not a corrupt state:
   `422 insufficient_capacity` — `"not enough IP capacity on the selected node"` (or the
   `unsatisfiable_plan` variant for a bad shape).
3. On the Paymenter side that surfaces as a failed provisioning job in Admin → Failed Jobs with
   the control-plane message; nothing is half-created, so add capacity or correct the plan and
   retry.

## Monitoring

**The metrics endpoint** lives on the **agent**, not the control plane, at `PROXTREE_METRICS_PATH`
(default `/v1/metrics`), and requires the node token. It serves three formats from one snapshot:

| Format | Request |
|---|---|
| Prometheus text (default) | `GET <node>/v1/metrics` |
| JSON | `GET <node>/v1/metrics?format=json` |
| InfluxDB line protocol | `GET <node>/v1/metrics?format=influx` |

**Per-instance counters worth alerting on.** Every series is labelled with `instance_id`, `port`
and `ip`, so alerts can be scoped to one customer:

- `active_conns` — open client connections. Alert when it sits at or near the instance's
  `max_conns`, or is anomalously high for the plan (the credential-sharing signal).
- `bytes_in_total` / `bytes_out_total` — counters. Alert on rate collapse (a listener that was
  busy and went quiet) or on a sudden spike.
- `conns_total` — accepted connections. A steep rate with almost no bytes is usually abuse or
  credential stuffing.
- `uptime_seconds` — a **reset** means the listener was recreated (agent restart, expiry, or a
  re-sync). Several instances resetting at once points at the agent, not the customers.

**Control-plane signals that matter** (all visible in the Daily checks code above):

- node status going `offline`, or a heartbeat older than `PROXTREE_HEARTBEAT_TIMEOUT`;
- `unreachable_ips` appearing on a node (an address stopped being routed);
- `ip_drift` growing (addresses were removed from the host but are still registered);
- repeated `agent_sync_failed` errors and `reconciler: sync node …` failures in the control
  plane's log — a node that cannot apply desired state is serving stale configuration, and its
  customers' expiries and rotations will not take effect.

The agent's `GET /v1/health` returns `status`, `version` and `uptime_seconds`, and the control
plane's unauthenticated `GET /healthz` is enough for a liveness probe.
