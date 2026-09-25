---
title: Quick Start
description: Install ProxTree, register a node, add an IP and sell your first SOCKS5 proxy in six steps.
---

# Quick Start

This is the 30-second path: install the backend, register a node, point the
agent at the control plane, add an IP, and provision a proxy you can actually
curl through. Each step shows the real command and the response to expect.

## Prerequisites

- A Linux host with root (the installer needs it for PostgreSQL and systemd).
- A proxy server, or two if you want to try the split topology.
- Optionally, a Paymenter v1.5.7 install if you want to sell through billing
  rather than the API directly.

The proxy server needs at least one public IP assigned to an interface; one that
is only registered in the control plane is not enough — see step 5.

## 1. Install

Copy the backend release zip to the host, unpack it, and run the installer:

```bash
unzip ProxTree-Backend-1.0.0.zip
cd ProxTree-Backend-1.0.0
sudo sh install.sh
```

The installer is idempotent (safe to re-run) and, depending on what it finds:

- installs the static `control-planed` and `proxtreed` binaries;
- installs and starts PostgreSQL, then creates the `proxtree` database and role;
- applies the embedded migrations;
- writes `/etc/proxtree/control-planed.env` and `/etc/proxtree/proxtreed.env`
  (mode `0600`, they hold secrets);
- installs and starts both systemd units;
- probes `http://127.0.0.1:8080/healthz` and the agent's `/v1/health` and fails
  if either does not come up within 30 seconds.

On a single host this one command installs both components. For the split
topology, run it on the control-plane host and again on each proxy server with
`--only agent`.

## 2. Read the admin token

On first start with no admin token in the database, the control plane generates
one and prints it to the log exactly once:

```bash
journalctl -u control-planed | grep BOOTSTRAP
```

```text
BOOTSTRAP ADMIN TOKEN (shown once, store it safely): ptx_8c1f4a9e2b7d6c03a5e8fb1d4a9c7e2f5b8d3a61
```

Export it for the rest of this guide; without systemd the same line lands in
`$LOG_DIR/control-planed.log`:

```bash
export ADMIN_TOKEN=ptx_8c1f4a9e2b7d6c03a5e8fb1d4a9c7e2f5b8d3a61
```

::: danger Shown once, stored nowhere recoverable
The bootstrap token is printed only on the first start, and the control plane
stores only its SHA-256 hash — it cannot be read back. Save it now. If you lose
it, create a replacement with `POST /v1/tokens` while you still have a working
session, or insert one manually.
:::

## 3. Register a node

A node is a proxy server running `proxtreed`. Register it on the control plane
with the address the **control plane** will use to reach the agent — that is the
agent's control channel, not the control plane port:

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/nodes \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "node-fra-1",
    "url": "http://203.0.113.10:9090",
    "location": "fra",
    "port_range_start": 10000,
    "port_range_end": 60000
  }'
```

```json
{
  "node": {
    "id": "3f8c1e2a-6b4d-4f7e-9a11-5c2d8e0b7a34", "name": "node-fra-1", "url": "http://203.0.113.10:9090",
    "location": "fra", "status": "offline", "last_heartbeat_at": null, "port_range_start": 10000,
    "port_range_end": 60000, "created_at": "2026-09-25T12:00:00Z", "bound_ips": null, "ip_health": {} },
  "token": "ptx_1d4a9c7e2f5b8d3a61c1f4a9e2b7d6c03a5e8fb1"
}
```

```bash
export NODE_ID=3f8c1e2a-6b4d-4f7e-9a11-5c2d8e0b7a34
export NODE_TOKEN=ptx_1d4a9c7e2f5b8d3a61c1f4a9e2b7d6c03a5e8fb1
```

The `token` field is the **node token** and is returned once, here. The `url` is
where the agent is reachable: it must be an `http(s)` URL the control plane can
dial. The new node shows `status: "offline"` and empty `bound_ips` until the
agent starts heartbeating. `port_range_start` / `port_range_end` default to
`10000`–`60000` and define the node-wide port pool; the agent's own control port
is reserved automatically.

## 4. Configure the agent

On the proxy server, install just the agent and give it the node token and the
control-plane URL:

```bash
sudo sh install.sh --only agent \
  --node-token ptx_1d4a9c7e2f5b8d3a61c1f4a9e2b7d6c03a5e8fb1 \
  --cp-url http://127.0.0.1:8080
```

When the control plane is elsewhere, `--cp-url` is its reachable API URL (for
example `https://cp.example.com`), and the node `url` must be reachable too.

::: warning Three tokens, three different jobs
Do not mix these up — a mismatch shows up as `401` on every call.

| Token | Created by | Used for |
| --- | --- | --- |
| Admin / API token | bootstrap or `POST /v1/tokens` | Calling the control plane API (admin and billing roles). |
| Node token | `POST /v1/nodes` | The agent's bearer token; the control plane presents it when calling the agent, so it is stored encrypted as well as hashed. |
| Paymenter addon token | `POST /v1/tokens` with role `billing` | The addon's calls only: availability, provision, lifecycle. |

`--node-token` expects the node token from step 3. Passing a control-plane API
token instead yields `401` on every sync and heartbeat.
:::

The installer refuses a `--cp-url` that points at the agent's own listen port on
localhost, because the agent cannot heartbeat to itself. If it cannot find a
control plane at the URL you gave, it scans common ports, prints the correct
`--cp-url`, then continues — the agent still enforces credentials, ports and
expiry on its own. The node flips to `online` within a heartbeat or two (default
interval `15s`):

```bash
curl -sS http://127.0.0.1:8080/v1/nodes/$NODE_ID -H "Authorization: Bearer $ADMIN_TOKEN"
```

## 5. Add an IP

Register the address or address block the node is allowed to sell:

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/nodes/$NODE_ID/ips \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "address": "203.0.113.10", "label": "fra-pool-1", "mode": "oversell", "max_instances": 5 }'
```

```json
{
  "ips": [
    { "id": "9b2a7d14-0c3e-4a6f-b8d1-2e5c7a90f431", "node_id": "3f8c1e2a-6b4d-4f7e-9a11-5c2d8e0b7a34",
      "address": "203.0.113.10", "label": "fra-pool-1", "mode": "oversell", "max_instances": 5,
      "created_at": "2026-09-25T12:05:00Z" }
  ]
}
```

`mode` is `oversell` (shared, up to `max_instances` instances on distinct ports)
or `dedicated` (exclusive, one instance; `max_instances` is ignored). You can
also pass `"cidr": "203.0.113.0/28"` instead of a single `address`; the block is
expanded into individual addresses, skipping network and broadcast for IPv4
prefixes shorter than `/31`, capped at 256 addresses per call.

::: warning The address must actually exist on the server
Registering an address in the control plane does not put it on the proxy server.
The agent reports the addresses present on its interfaces on every heartbeat
(`bound_ips`), and an address missing from that report is excluded from stock —
it will never be allocated. This is deliberate: a listener bound to a
non-existent address accepts TCP connections and then fails every outbound dial,
so the control plane would otherwise sell a proxy that looks alive and passes
nothing. A second gate is reachability: the agent dials `PROXTREE_PROBE_TARGET`
(default `1.1.1.1:53`) every `PROXTREE_PROBE_INTERVAL` (default `60s`) from each
candidate address, and an address that is bound but not routed by the provider
is also excluded and named in `unreachable_ips`. Both checks fail open until the
node has reported, so a fresh install still works.
:::

## 6. Sell your first proxy

Ask the control plane whether the inventory can satisfy the shape you want to
sell — here `ip_count: 1` with `instances_per_ip: 3`, so three proxies on three
ports:

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/availability/check \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "location": "fra", "ip_count": 1, "instances_per_ip": 3, "ip_mode": "oversell", "protocol": "socks5" }'
```

```json
{
  "available": true,
  "detail": {
    "required_ip_count": 1, "instances_per_ip": 3, "required_instances": 3, "ip_mode": "oversell",
    "best_node_free_slots": 41, "best_node_free_bundles": 5, "protocol": "socks5",
    "free_slots_by_location": { "fra": 41 }, "free_bundles_by_location": { "fra": 5 },
    "unreported_ips": [], "unreachable_ips": [],
    "nodes": [ { "id": "3f8c1e2a-6b4d-4f7e-9a11-5c2d8e0b7a34", "name": "node-fra-1", "location": "fra", "free_slots": 41, "free_bundles": 5 } ]
  }
}
```

`free_bundles` counts IPs that can take the whole shape; `free_slots` counts
individual instances. A node with three free slots spread over three different
IPs cannot host a `1 × 3` shape, which is why the two numbers are reported
separately. This check is a non-locking snapshot — provisioning re-verifies
capacity under a row lock. Provisioning is atomic: either every instance is
created and the agent confirms, or nothing exists.

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/proxies \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-1042" \
  -d '{
    "location": "fra",
    "ip_count": 1,
    "instances_per_ip": 3,
    "ip_mode": "oversell",
    "protocols": ["socks5"],
    "duration_seconds": 2592000,
    "external_ref": "order-1042"
  }'
```

```json
{
  "node_id": "3f8c1e2a-6b4d-4f7e-9a11-5c2d8e0b7a34",
  "instances": [
    { "id": "c4e6a0b8-1f2d-4c3a-9e7b-6a5d4c3b2a10", "ip": "203.0.113.10", "port": 10000, "protocols": ["socks5"],
      "status": "active", "username": "u_4b1d9c2e7a05f381", "password": "QmFzZTY0VXJsUGFzc3dvcmQxMjM",
      "expires_at": "2026-10-25T12:10:00Z", "external_ref": "order-1042", "max_conns": 0, "new_conn_rate": 0 },
    { "id": "d5f7b1c9-2a3e-4d5b-8f0c-7b6e5d4c3b21", "ip": "203.0.113.10", "port": 10001, "protocols": ["socks5"],
      "status": "active", "username": "u_7c2a5e9b1d4f0382", "password": "WnJzVTlYcU5tS2hEdjRi" },
    { "id": "e6a8c2d0-3b4f-4e6c-9a1d-8c7f6e5d4c32", "ip": "203.0.113.10", "port": 10002, "protocols": ["socks5"],
      "status": "active", "username": "u_9d3b6f0c2e5a1493", "password": "bE9vUjN4WnF0TWFnYmNH" }
  ]
}
```

Three instances on one IP, three ports, three credential pairs. The username and
password are shown **only in this response** (and again, as a new pair, on
`POST /v1/proxies/{id}/credentials/reset`); the control plane stores the password
encrypted, not in the clear. `max_conns` and `new_conn_rate` of `0` mean
unlimited. `duration_seconds` and `expires_at` are alternatives — supply one.

Prove it works by routing a request through the proxy. The target below echoes
the source IP it saw, which should be the IP you were allocated:

```bash
curl --socks5 u_4b1d9c2e7a05f381:QmFzZTY0VXJsUGFzc3dvcmQxMjM@203.0.113.10:10000 \
  https://api.ipify.org
```

```text
203.0.113.10
```

An HTTP-mode instance is the same thing over the other protocol
(`curl -x http://user:pass@203.0.113.10:10000 https://api.ipify.org`). If you
enabled `socks4` on an instance, remember it has no authentication — the
credentials above are ignored and any SOCKS4 client can connect to that port.

::: tip Selling through Paymenter instead
Everything above maps onto the Paymenter addon: a **Server** row holds the
control-plane URL and a `billing`-role API token, product fields carry
`ip_count`, `instances_per_ip`, `ip_mode`, the protocol checkboxes and the
limits, and stock is derived from the same shaped capacity you just checked.
See [Paymenter Addon](../user-guide/paymenter) for the wiring.
:::

## Where to go next

- [Installation](./installation) — installer flags, distro support and upgrades.
- [FAQ](./faq) — common questions and setup pitfalls.
- [Configuration Reference](../configuration/reference) — every control-plane and agent variable.
- [HTTP API](../user-guide/api) — roles, endpoints, idempotency and error codes.
- [CLI Reference](../user-guide/cli) — `control-planed` and `proxtreed` commands and flags.
- [Paymenter Addon](../user-guide/paymenter) — stock gating, lifecycle and the client dashboard.
- [Operations](../user-guide/operations) — rotation queue, node health and capacity.
- [Architecture Overview](../architecture/overview) — components, trust boundaries and data flow.
- [Proxy Engine](../architecture/proxy-engine) — protocols, limits and the expiry janitor.
- [Provisioning](../architecture/provisioning) — reservation, agent sync and compensation.
