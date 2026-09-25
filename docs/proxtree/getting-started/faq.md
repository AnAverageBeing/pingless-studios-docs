---
title: FAQ
description: Practical answers about ProxTree proxies, dedicated versus oversell IPs, capacity, credentials at rest, node outages, rotation, SOCKS4 authentication and token types.
---

# FAQ

## What exactly is one "proxy"? What does the customer receive?

One proxy is one **instance**: a single proxy listener bound to one `(IP, port)`
on one node, with its own credential pair, its enabled protocols, its expiry and
its per-instance limits (`max_conns`, `new_conn_rate`).

The customer receives an IP, a port, a username and a password, plus the
protocols that instance speaks — SOCKS5, SOCKS4/4a, or HTTP CONNECT and forward
proxy. The Paymenter client dashboard shows `ip:port`, protocol badges, the
credentials with reveal/copy, a ready-to-paste connection URI, and live uptime,
connection count and bandwidth on a 15-second poll.

The instance's outbound traffic is pinned to its assigned IP (`net.Dialer` with
`LocalAddr` set to that address), which is the IP isolation customers pay for:
instances bound to different addresses leave from those different addresses. A
shared (oversell) IP is the deliberate exception — those instances are meant to
share one address. See [Proxy Engine](../architecture/proxy-engine.md).

## What is the difference between a dedicated and an oversell IP at the product level?

It is the product's `ip_mode` field, and it selects which pool of addresses a
plan may draw from:

| `ip_mode` | Pool | Instances per IP |
| --- | --- | --- |
| `dedicated` | Exclusive IPs only — never shared with another customer | Exactly 1 |
| `oversell` | Shared IPs only — never consumes a dedicated IP | Up to `max_instances` |
| `any` (default) | Shared first, dedicated only when shared is full | As configured |

Sell **dedicated** when the buyer's use case depends on the IP's reputation or
on it being theirs alone — account-based services, IP allow-listing, anything
where a neighbour's abuse would hurt them. Sell **oversell** for volume plans
where a shared IP is acceptable, which is where the margin is. Keeping exclusive
IPs for dedicated plans is exactly why `any` prefers shared capacity.

## How do I sell several proxies on one IP?

Set `instances_per_ip` above 1. It is the number of instances bound on **each**
required IP, from 1 to 100, and total instances are
`ip_count × instances_per_ip`:

```json
{
  "ip_count": 1,
  "instances_per_ip": 3,
  "ip_mode": "oversell"
}
```

That buys three proxies sharing one IP on three different ports — three
credential pairs, three expiries, three sets of limits, all independent.

`ip_count` counts **distinct IPs**, so `ip_count: 3, instances_per_ip: 2` is six
proxies spread over three addresses. Note that `dedicated` with
`instances_per_ip > 1` is impossible, and the control plane rejects it as
`422 unsatisfiable_plan` instead of pretending it is out of stock.

## Why does my product show out of stock when I know the IP is free?

Stock is shaped capacity, not a raw IP count. A plan is available only when one
node has `ip_count` addresses that **each** take `instances_per_ip` instances,
plus enough free ports node-wide. The usual causes:

- **The IP is not on the server.** An address is sellable only if the agent
  reported it in `bound_ips` — it must exist on an interface. Registered but
  missing addresses are excluded and returned in `unreported_ips`.
- **The IP is unreachable.** The agent's prober could not reach
  `PROXTREE_PROBE_TARGET` from that address. Bound is not the same as routed;
  an unroutable address would accept connections and pass nothing. Excluded and
  listed in `unreachable_ips`.
- **The dedicated IP is already consumed.** A dedicated IP hosts exactly one
  instance, ever.
- **Ports are exhausted.** The node's free port count caps total instances
  regardless of how many IPs you added.
- **The node is offline.** No heartbeat within `PROXTREE_HEARTBEAT_TIMEOUT`
  (90s) and nothing is offered for provisioning.

`POST /v1/availability/check` returns a `detail.hint` that names the excluded
addresses, and the Paymenter storefront out-of-stock message carries that hint.

## How many customers can one IP serve?

A dedicated IP serves exactly **one** instance. An oversell IP serves up to its
`max_instances` value, set per IP with `PATCH /v1/ips/{id}`; when
`max_instances` is null the control plane approximates it with the node's
port-range size. In practice the node's free ports are the harder ceiling,
because ports are allocated node-wide and shared across all IPs on that node.

## Do I need to expose the control plane to the internet?

**No** — the data plane does not depend on it. The agent heartbeats outward to
`PROXTREE_CONTROL_PLANE_URL`, and the control plane pushes desired state to the
agent's own URL, so the agent needs no inbound path from the internet. Your
proxies keep serving if the control plane is unreachable.

Two things still need to reach the API: your operators, and whatever drives
provisioning. In a Paymenter deployment that means the addon host must reach the
control plane — so if Paymenter is on another machine, expose the API over TLS
to that machine only. Never expose the agent's control port (9090) publicly.

## Are credentials safe at rest?

Two different stores, with two different answers:

- **On the node**, the agent keeps credentials in a local SQLite file
  (`/opt/proxtree/var/proxtreed.db`), file mode 0600, directory 0700. Passwords
  are stored **as received, in plaintext** — the agent has to present them
  during authentication, so it cannot hold only a hash. Access control here is
  filesystem permissions on the proxy server.
- **On the control plane**, instance passwords and node tokens are encrypted
  with AES-256-GCM under `PROXTREE_MASTER_KEY` (a 32-byte base64 key). Node
  tokens are additionally stored as sha256 hashes, and API tokens are stored as
  hashes only.

Losing the master key means the encrypted credentials and node tokens cannot be
decrypted again. Node tokens can be recovered by rotating them; stored customer
passwords cannot, and those instances would have to have credentials reset.
Back the key up somewhere safe and separate from the database.

## What happens when a node goes offline?

Existing proxies **keep serving**. The agent is autonomous: it enforces
credentials, ports and expiry locally, and re-binds all non-expired instances
from its SQLite database at startup, so a reboot or a control-plane outage does
not stop customer traffic.

What stops is everything that needs the control plane to act on that node: new
provisioning returns `node_offline`, rotation acceptance returns `503` and stays
pending, and the node contributes no stock. The control plane flips a node to
`offline` after `PROXTREE_HEARTBEAT_TIMEOUT` (default 90s) without a heartbeat.

## What happens when a plan expires?

The agent tears it down locally. A janitor checks `expires_at` every second;
when it passes, the listener is closed, live connections are dropped and the
credential is deleted — with no control-plane round trip at the deadline.
Expiry is enforced even if the control plane is unreachable.

Suspension, resumption and termination are separate, deliberate billing actions:
the addon maps them to `suspend`, `resume` and `delete`, and renewal extends the
expiry. So an expired instance stops serving, while a suspended one keeps its
record so it can come back.

## Can I rotate a customer's IP?

Yes. `POST /v1/proxies/{id}/rotation` files a request, and the database enforces
**at most one pending request per instance** — a second one returns
`409 rotation_pending`. An operator resolves it with `accept`, `deny` or
`ignore`.

On accept, the control plane picks a replacement IP on the same node, preferring
addresses the instance has never used (tracked in `ip_history`) and excluding
IPs released within `PROXTREE_ROTATION_COOLDOWN` (default 10 minutes). The
instance gets a **new IP and a new port**, so the customer's connection details
change and must be redistributed.

If there is nowhere to move it, the request resolves as `no_slots` rather than
failing silently. If the node is offline the call returns `503 node_offline` and
the request stays pending.

The honest limitation: a node with a single usable IP has nowhere to rotate to,
so rotation cannot change anything until you add more addresses. Rotation is
only useful when the node holds a pool.

## Does SOCKS4 check credentials?

**No.** The SOCKS4/4a protocol has no credential mechanism — its USERID field is
informational and is not verified. An instance with `socks4` enabled accepts any
SOCKS4 CONNECT; access control rests entirely on the unguessable
`(IP, port)` allocation plus the per-instance connection limits.

That is a deliberate protocol tradeoff, not a bug, but it means SOCKS4 cannot be
the auth boundary for a paying customer. Enable `socks5` and/or `http` when
per-user authentication matters, and treat `socks4` as a compatibility option
for clients that speak nothing else.

## Can two agents share one host?

Yes, provided their port ranges do not overlap. Listeners bind `0.0.0.0:<port>`,
so a port is unique **per host**, not per IP — two agents on one machine with
overlapping `port_range_start`/`port_range_end` collide and the second bind
fails with `bind port N: address already in use`, surfacing as
`502 agent_sync_failed`.

Give each node a disjoint range with `PATCH /v1/nodes/{id}`, then provision.

## How do I add a new proxy server later?

1. Register the node: `POST /v1/nodes` with its `name`, `url` (the address the
   control plane will call, e.g. `http://10.0.0.5:9090`) and `location`. This
   returns the node token once.
2. Install the agent on that server with `--node-token` and `--cp-url`.
3. Add its addresses: `POST /v1/nodes/{id}/ips` accepts a single address or a
   CIDR block, and each IP's `mode` and `max_instances` are set with
   `PATCH /v1/ips/{id}`.
4. Confirm the node reads `online` in `GET /v1/nodes`, that the new addresses
   appear in `bound_ips`, and that none are listed as unreachable — only then
   are they sellable.

Full commands are in [Installation](./installation.md).

## What is the difference between the three token kinds?

All three are bearer tokens, and each has a role that scopes what it can do:

| Kind | Role | Can do | Used by |
| --- | --- | --- | --- |
| Admin API token | `admin` | Everything: nodes, IPs, IP modes, provisioning, rotation resolution, token management, audit log | operators, admin pages |
| Billing API token | `billing` | Availability check, provision, suspend / resume / delete / extend, credential reset, rotation request, status, rotations list | the Paymenter addon |
| Node token | `node` | Heartbeat only in the API; also the bearer for the agent's own control endpoints | `proxtreed` |

The node token is issued once by `POST /v1/nodes` and is the one that goes into
`--node-token`; a billing or admin token there will fail, and a node token in
the Paymenter addon will fail too. Every token is shown exactly once at
creation, and rotation keeps the previous token valid until the next rotation so
cutovers are zero-downtime.

## Can I run this without Paymenter?

Yes. The REST API **is** the contract — Paymenter is just one consumer of it.
Anything that can make authenticated HTTP calls can drive ProxTree: your own
panel, a shell script, a cron job. The addon exists to wire those calls to
Paymenter's cart, invoice and lifecycle events, not to add capability.

To go standalone, create an admin or billing token with `POST /v1/tokens`, then
call `POST /v1/availability/check` before `POST /v1/proxies` and use the
suspend / resume / delete / extend endpoints for lifecycle. Mutating calls
accept an `Idempotency-Key` header, so retries are safe. Endpoint-by-endpoint
detail is in the [HTTP API reference](../user-guide/api.md).
