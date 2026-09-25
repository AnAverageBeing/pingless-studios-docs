---
title: REST API
description: Complete reference for the ProxTree control-plane REST API — authentication, conventions, every endpoint, error codes, and the agent control channel.
---

# REST API

`control-planed` serves one JSON REST API over HTTP. The billing addon, operator
scripts, the admin pages and the node agents all use it; only the agents use a
separate, agent-implemented control channel (documented at the bottom).

- **Base URL** — `http://127.0.0.1:8080` by default (`PROXTREE_LISTEN_ADDR`, default `:8080`), optionally behind TLS termination.
- **JSON everywhere** — bodies and responses are `application/json`; request bodies decode up to 4 MiB (8 MiB on idempotency-wrapped endpoints).
- **Bearer authentication** — every endpoint except `GET /healthz` requires `Authorization: Bearer <token>`. See [Authentication](#authentication).
- **One error shape** — every non-2xx response is `{"error":{"code":"...","message":"..."}}`. See [Error codes](#error-codes).

## Roles

Every token carries exactly one role; the role decides which endpoints it may
call. A valid token with the wrong role gets `403 forbidden`.

| Role | Issued to | May call |
| --- | --- | --- |
| `admin` | Operators, the admin pages | Everything: node and IP management, token management, rotation resolution, audit, plus the whole billing surface. |
| `billing` | The Paymenter addon (and any other billing client) | Read nodes, check availability, and run the full proxy lifecycle: provision, list, status, suspend, resume, extend, delete, credential reset, rotation request. Cannot manage nodes, IPs, tokens or audit, and cannot resolve rotations. |
| `node` | Each node agent (`proxtreed`) | `POST /v1/nodes/heartbeat` only. |

## Authentication

Three kinds of credential exist and they are not interchangeable.

| Credential | Role | Created by | Stored as | Valid until |
| --- | --- | --- | --- | --- |
| Admin/billing API token | `admin` or `billing` | `POST /v1/tokens`, or the bootstrap token printed once on first start | SHA-256 hash in `tokens` | Revoked, or `expires_at` passes |
| Node token | `node` | `POST /v1/nodes` (returned once); re-issued by `POST /v1/nodes/{id}/token/rotate` | SHA-256 hash **and** AES-256-GCM ciphertext on `nodes` (the control plane must present it to the agent) | Rotated; the previous token also works until the next rotation |

**Bootstrap admin token.** On the first start with no usable admin token, `control-planed` generates one and prints it once to the log; it cannot be retrieved again. Store it, then create named tokens.

```text
BOOTSTRAP ADMIN TOKEN (shown once, store it safely): ptx_3f9a1c4e8b2d6071a5c9e3f48d1b0276a9c5e8f1
```

**Addon tokens.** Create a `billing` token with `POST /v1/tokens` (role `admin` or `billing`; optional RFC 3339 `expires_at`). Tokens are `ptx_` + 40 hex characters, returned exactly once in `api_token`; `GET /v1/tokens` lists metadata only, `POST /v1/tokens/{id}/revoke` revokes, and `POST /v1/tokens/{id}/rotate` issues a successor (`predecessor_id`) while the old token keeps working until revoked — zero-downtime cutover.

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"paymenter-prod","role":"billing","expires_at":"2027-01-01T00:00:00Z"}'
# {"token":{"id":"8b2f4d61-0a3c-4e57-9b12-6c8d0e2f3a45","name":"paymenter-prod","role":"billing",
#  "predecessor_id":null,"created_at":"2026-09-25T12:00:00Z","expires_at":"2027-01-01T00:00:00Z","revoked_at":null},
#  "api_token":"ptx_42d8b1f0c7a9e356042719bd8c5f1a6e903b7d24"}
```

**The header.** `Authorization: Bearer ptx_...` — a missing header is
`401 unauthorized`, an unknown/expired/revoked token is `401 invalid_token`, and
the `node` role token is accepted only on the heartbeat endpoint (everywhere
else it is `403 forbidden`).

## Conventions

### Idempotency

Every mutating endpoint (`POST`/`PATCH`/`DELETE`) accepts an optional
`Idempotency-Key` header, scoped to `(key, method + path)`, so the same key can
be reused on a different route.

| Situation | Result |
| --- | --- |
| First request with a key | Executes normally; its 2xx status and body are stored |
| Retry, same key, byte-identical body | Stored response replayed verbatim, with `Idempotency-Replayed: true` |
| Same key, different body | `422 idempotency_key_mismatch` |
| Retry while the original runs | Waits up to 30 s, then replays or returns `409 idempotency_in_progress` |
| Original returned non-2xx | Claim released, so a retry re-executes — errors are never replayed |

Only 2xx responses are stored, so a retry after a network failure or 5xx is
always safe. The addon should send a unique key (the order/service id) on every
provisioning and lifecycle call.

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/proxies \
  -H "Authorization: Bearer $BILLING_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: paymenter-service-1042-provision" \
  -d '{"ip_count":1,"protocols":["socks5"],"duration_seconds":2592000,"external_ref":"paymenter-service-1042"}'
```

### Pagination and limits

There is **no cursor or offset pagination**. Collection endpoints return a
fixed, capped window:

| Endpoint | Default window | Hard cap | Order |
| --- | --- | --- | --- |
| `GET /v1/nodes` | all nodes | none | `created_at`, then id |
| `GET /v1/proxies` | 200 | 200 | `created_at`, then id |
| `GET /v1/rotations` | 200 | 200 | `requested_at` descending |
| `GET /v1/audit` | 100 | 500 (`?limit=`) | id descending |

To cover a larger working set, narrow the query: `?external_ref=` on
`GET /v1/proxies`, `?node_id=` for one node, `?action=`/`?resource_type=` on audit.

### Timestamps, ids and errors

- Timestamps are RFC 3339 (`2026-09-25T12:00:00Z`); `expires_at` inputs must be
  RFC 3339 and in the future; outputs are UTC.
- Every resource id is a UUID; a path id that is not parseable is
  `400 bad_request`.
- `protocols` is a non-empty subset of `socks5`, `socks4`, `http`; duplicates
  are dropped, an unknown value is `422 invalid_protocols`.
- The error envelope is always:

```json
{ "error": { "code": "insufficient_capacity", "message": "not enough IP capacity on the selected node" } }
```

## Error codes

Every code, the statuses it comes with, and what to do about it.

| Code | Status | Meaning and operator action |
| --- | --- | --- |
| `unauthorized` | 401 | No bearer token sent. Fix the client. |
| `invalid_token` | 401 | Unknown, expired or revoked token. Check `GET /v1/tokens`; issue a new one. |
| `forbidden` | 403 | The token's role is not allowed here. Use an `admin` token, or route the action through an admin. |
| `bad_request` | 400 | Malformed JSON, missing field, unknown query value, or a path id that is not a UUID. |
| `not_found` | 404 | The addressed node, IP, instance, rotation or token does not exist. |
| `internal` | 500 | Unhandled server-side failure. Check `control-planed` logs. |
| `insufficient_capacity` | 422 | The selected node cannot satisfy the whole shape under lock — the stock race was lost. Addon: mark the product out of stock and retry on the next poll. Operator: add IPs, raise `max_instances`, or read the `note:` in the message for excluded addresses. |
| `node_offline` | 422, 503 | `422` on provisioning when the pinned node is not `online`; `503` when accepting a rotation and the node is not `online` (the request **stays pending**). Recover the node's heartbeat. |
| `agent_sync_failed` | 502 | The agent did not accept the desired state, so the control plane rolled the change back — nothing half-exists. Investigate the agent (`GET /v1/health` on the node URL, agent logs). Safe to retry with the same key. |
| `rotation_pending` | 409 | A rotation is already pending for this instance (one pending per instance). Resolve or wait out the existing request. |
| `rotation_not_pending` | 409 | Already resolved, or a concurrent resolve won. Re-read `GET /v1/rotations?status=pending`. |
| `unsatisfiable_plan` | 422 | The shape can never succeed — usually `ip_mode=dedicated` with `instances_per_ip > 1` (an exclusive IP hosts one instance). Fix the product; never treat as out of stock. |
| `ip_in_use` | 409 | Deleting an IP that still hosts active/suspended instances, or switching an IP to `dedicated` while it hosts more than one. Clear the instances first. |
| `node_in_use` | 409 | Deleting a node that still has capacity-holding instances. Terminate them, or re-issue with `?force=true`. |
| `instance_expired` | 422 | `resume` on an expired instance. Call `extend` first (extending revives it to `active`). |
| `invalid_state` | 409, 422 | The instance/rotation is not in a state that permits the action — suspending a non-active instance (`409`), or requesting rotation on a non-active instance (`422`). |
| `invalid_port_range` | 422 | Port range must satisfy `1 <= start < end <= 65535`. |
| `invalid_mode` | 422 | `mode` must be `dedicated` or `oversell`. |
| `invalid_max_instances` | 422 | `max_instances` must be `>= 1` or JSON `null` (null removes the cap). |
| `invalid_role` | 422 | `POST /v1/tokens` role must be `admin` or `billing`. |
| `invalid_protocol` | 422 | Availability `protocol` must be `socks5`, `socks4` or `http`. |
| `invalid_protocols` | 422 | Provisioning `protocols` must be a non-empty subset of those three. |
| `invalid_expiry` | 422 | Neither `expires_at` nor `duration_seconds` supplied, or `expires_at` is past. |
| `ip_exists` | 409 | An address in the request is already registered on that node. The whole bulk insert rolls back. |
| `already_revoked` | 409 | The token is already revoked. |
| `token_revoked` | 409 | Cannot rotate a revoked token — create a fresh one. |
| `idempotency_key_mismatch` | 422 | The key was used with a different body. Use a fresh key. |
| `idempotency_in_progress` | 409 | The original request with this key is still running (waited 30 s). Retry shortly. |

## Nodes

A node is one proxy server running `proxtreed`. Its `url` is the base URL of
that server's **agent control channel** (default `:9090`) — the address the
control plane calls to push state, not the control-plane API URL. The port in
that URL is reserved and never allocated as a proxy port. Registering a node
returns its agent token **exactly once**; hand it to the agent as
`PROXTREE_NODE_TOKEN`. The node starts `offline` and flips to `online` on its
first heartbeat.

### POST /v1/nodes

**Role:** admin. Registers a node and generates its agent token.

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `name` | string | yes | — | Human label |
| `url` | string | yes | — | `http(s)` URL of the agent control channel; validated, port reserved |
| `location` | string | no | `""` | Exact-match filter for provisioning and availability |
| `port_range_start` | int | no | `10000` | Allocatable port range lower bound |
| `port_range_end` | int | no | `60000` | Upper bound, `1 <= start < end <= 65535` |

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/nodes \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"de-fra-1","url":"http://10.0.0.5:9090","location":"de-fra"}'
# {"node":{"id":"7c9e6679-7425-40de-944b-e07fc1f90ae7","name":"de-fra-1","url":"http://10.0.0.5:9090",
#  "location":"de-fra","status":"offline","last_heartbeat_at":null,"port_range_start":10000,
#  "port_range_end":60000,"created_at":"2026-09-25T12:00:00Z","bound_ips":[],"ip_health":{}},
#  "token":"ptx_3f9a1c4e8b2d6071a5c9e3f48d1b0276a9c5e8f1"}
```

Errors: `400 bad_request` (missing name/url, bad URL), `422 invalid_port_range`,
`401`, `403`.

### GET /v1/nodes

**Role:** admin, billing. Returns `{"nodes":[...]}`, oldest first; each element is
the node shape above, including the agent's last `bound_ips` and `ip_health`.

### `GET /v1/nodes/{id}`

**Role:** admin, billing. Returns the node plus:

| Field | Meaning |
| --- | --- |
| `ips` | Registered `node_ips` rows |
| `active_instances` | Instances holding capacity (`active` + `suspended`) |
| `free_slots` | Free instance slots across allocatable IPs, capped by free node-wide ports |
| `ip_drift` | Registered addresses the agent has **not** reported as present on the server |
| `unreachable_ips` | Addresses bound but not routed by the provider |

`ip_drift` and `unreachable_ips` are operator to-do lists: those addresses are
excluded from allocation, which explains capacity that seems to have vanished.
Errors: `400`, `404 not_found`.

### `PATCH /v1/nodes/{id}`

**Role:** admin. Partial edit of `name`, `url`, `location`, `port_range_start`,
`port_range_end`; omitted fields are untouched. The URL must be a valid `http(s)`
URL and the resulting port range is re-validated. Token and status are **not**
editable here.

```bash
curl -sS -X PATCH http://127.0.0.1:8080/v1/nodes/7c9e6679-7425-40de-944b-e07fc1f90ae7 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"port_range_start":20000,"port_range_end":29999}'
# {"node":{...}}
```

Errors: `400`, `404`, `422 invalid_port_range`.

### `DELETE /v1/nodes/{id}`

**Role:** admin. Deletes the node and, by cascade, its IPs, instances,
credentials and history. Refused with `409 node_in_use` while capacity-holding
instances exist; `?force=true` deletes anyway and first makes a best-effort
final sync with an empty desired state so the agent tears everything down.

```json
{ "deleted": true, "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7" }
```

### `POST /v1/nodes/{id}/token/rotate`

**Role:** admin. Installs a fresh agent token; the previous one moves to the
`prev_*` columns and stays valid **until the next rotation**, so cutover is
zero-downtime (set `PROXTREE_PREV_NODE_TOKEN` on the agent, rotate, then restart
without it). The new plaintext token is returned once.

```json
{ "token": "ptx_8c1e4a72f5b903d6e2a8471c0f9b35d68e7a2c41" }
```

Errors: `400`, `404`.

### POST /v1/nodes/heartbeat

**Role:** node. Called by each agent every `PROXTREE_HEARTBEAT_INTERVAL`
(default `15s`); marks the node `online`, stamps `last_heartbeat_at`, persists
`bound_ips` and `ip_health`. The sweeper flips a node `offline` after
`PROXTREE_HEARTBEAT_TIMEOUT` (default `90s`) without one.

```json
{ "bound_ips": ["203.0.113.10","203.0.113.11"], "active_conns": 341, "instance_count": 57,
  "ip_health": { "203.0.113.10": { "reachable": true, "checked_at": "2026-09-25T12:00:00Z" } } }
```

Response `{"ok":true}`. Errors: `401`, `403`.

## Node IPs

Each registered address is `dedicated` or `oversell`.

| Mode | Capacity |
| --- | --- |
| `dedicated` | Exclusive. Exactly one instance while unused, never shared. `max_instances` is meaningless and dropped. |
| `oversell` | Shared. Up to `max_instances` instances on distinct ports; `max_instances` null means limited only by the node's port range. |

An address counts as capacity only when **both** gates pass: the agent reported
it in `bound_ips` (it exists on an interface), and its prober did not mark it
unreachable. An address not on the server is excluded and surfaced in
`ip_drift`; a bound-but-unrouted address is excluded and surfaced in
`unreachable_ips`. Both gates fail open until a node first reports.

### `POST /v1/nodes/{id}/ips`

**Role:** admin. Registers one `address` or a whole `cidr` (exactly one of the
two; expansion capped at 256 addresses, IPv4 network/broadcast skipped for
blocks larger than `/31`).

| Field | Type | Notes |
| --- | --- | --- |
| `address` | string | Single IP; mutually exclusive with `cidr` |
| `cidr` | string | CIDR block, expanded |
| `label` | string | Free-form operator label |
| `mode` | string | `dedicated` or `oversell` (default `oversell`) |
| `max_instances` | int\|null | Oversell cap, `>= 1`; null = port-space limited |

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/nodes/7c9e6679-7425-40de-944b-e07fc1f90ae7/ips \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"cidr":"203.0.113.8/30","label":"fra pool","mode":"oversell","max_instances":10}'
# {"ips":[{"id":"5a1c8e2b-7d4f-4b3c-9e6a-1f0d2c4b6a88","node_id":"7c9e6679-...","address":"203.0.113.9",
#   "label":"fra pool","mode":"oversell","max_instances":10,"created_at":"..."},
#  {"id":"9d3b7f12-4a8c-4d61-b0e5-2c7a9f1b3e46","address":"203.0.113.10", ...}]}
```

All rows insert in one transaction; any duplicate `(node_id, address)` fails the
whole call. Errors: `400 bad_request`, `404`, `409 ip_exists`,
`422 invalid_mode`, `422 invalid_max_instances`.

### `PATCH /v1/ips/{id}`

**Role:** admin. Partial update of `mode`, `label`, `max_instances`; only present
fields change, and JSON `null` for `max_instances` removes the cap. Switching to
`dedicated` clears `max_instances` and is refused with `409 ip_in_use` when the
IP already hosts more than one instance.

```bash
curl -sS -X PATCH http://127.0.0.1:8080/v1/ips/5a1c8e2b-7d4f-4b3c-9e6a-1f0d2c4b6a88 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"mode":"oversell","max_instances":20}'
# {"ip":{...}}
```

Errors: `400`, `404`, `409 ip_in_use`, `422 invalid_mode`,
`422 invalid_max_instances`.

### `DELETE /v1/ips/{id}`

**Role:** admin. Removes an IP; refused with `409 ip_in_use` while it hosts
active or suspended instances. Returns `{"deleted":true,"id":"..."}`.

## Availability

`POST /v1/availability/check` answers "can the current inventory fulfil this
shape?" and is what the addon polls for its stock column.

**Role:** admin, billing.

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `location` | string | `""` | Only consider nodes in this exact location |
| `ip_count` | int | — | Distinct IPs required; `>= 1` |
| `instances_per_ip` | int | `1` | Ports per IP, `1..100`; an IP with fewer free slots is not counted |
| `ip_mode` | string | `any` | `any`, `dedicated` or `oversell` — restricts the pool the answer is computed for |
| `protocol` | string | `""` | Validated (`socks5`/`socks4`/`http`) but does not change capacity math |
| `port_range_preference` | any | — | Accepted for forward compatibility; currently ignored |

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/availability/check \
  -H "Authorization: Bearer $BILLING_TOKEN" -H "Content-Type: application/json" \
  -d '{"location":"de-fra","ip_count":2,"instances_per_ip":2,"ip_mode":"oversell","protocol":"socks5"}'
```

```json
{"available": true,
 "detail": {
   "required_ip_count": 2, "instances_per_ip": 2, "required_instances": 4, "ip_mode": "oversell",
   "best_node_free_slots": 42, "best_node_free_bundles": 12,
   "free_slots_by_location": { "de-fra": 42, "nl-ams": 17 },
   "free_bundles_by_location": { "de-fra": 12, "nl-ams": 4 },
   "nodes": [ { "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7", "name": "de-fra-1", "location": "de-fra", "free_slots": 42, "free_bundles": 12 } ],
   "protocol": "socks5", "unreported_ips": [], "unreachable_ips": []
 }}
```

The `detail` block, field by field:

| Field | Meaning |
| --- | --- |
| `required_ip_count` / `instances_per_ip` | The normalised shape you asked for (per-IP defaults to 1) |
| `required_instances` | `ip_count × instances_per_ip` |
| `ip_mode` | The normalised pool the answer was computed for (`""` = any) |
| `best_node_free_slots` | Raw free instance count on the best single node |
| `best_node_free_bundles` | **Shaped** units on the best node — IPs that can each take `instances_per_ip`. Divide by `ip_count` for the sellable plan count. A node with 42 free slots spread as 42 IPs × 1 cannot satisfy `ip_count: 5, instances_per_ip: 3`, and this field is what says so |
| `free_slots_by_location` / `free_bundles_by_location` | The same two counts summed per location |
| `nodes` | Per-node `free_slots` and `free_bundles` (only nodes matching `location`) |
| `protocol` | Echo of the requested protocol |
| `unreported_ips` | Registered addresses the agent has not reported as present; never sold |
| `unreachable_ips` | Addresses bound but not routed by the provider; never sold |
| `hint` | Present only when `available` is false — the actionable reason |

`available` is true iff at least one online node (matching `location`) can host
the whole shape: `ip_count` distinct IPs, each able to take `instances_per_ip`
instances. Provisioning targets a **single** node, so capacity on two nodes
cannot be combined.

::: warning A positive answer is a snapshot, not a reservation
This call takes no locks and provisioning re-verifies capacity under row locks.
A `true` here can still lose the race and return `422 insufficient_capacity` at
`POST /v1/proxies`. Always handle that — the addon marks the product out of stock
and retries on the next poll.
:::

Errors: `400 bad_request`, `422 unsatisfiable_plan` (impossible shape),
`422 invalid_protocol`.

## Provisioning

`POST /v1/proxies` provisions (sells) the whole shape on one node, atomically.

**Role:** admin, billing.

| Field | Type | Notes |
| --- | --- | --- |
| `node_id` | uuid | Pin a node; must be online and able to provide the full shape. Omit for automatic selection |
| `location` | string | Exact-match filter for automatic selection (the online node there with the most shaped capacity wins) |
| `ip_count` | int | Distinct IPs, `1..1000` |
| `instances_per_ip` | int | Ports per IP, `1..100` (default `1`) |
| `ip_mode` | string | `any` (default), `dedicated` or `oversell` |
| `protocols` | array | Non-empty subset of `socks5`, `socks4`, `http` |
| `expires_at` | string | RFC 3339, future. Alternative to `duration_seconds` |
| `duration_seconds` | int | `now + N seconds`. Alternative to `expires_at` |
| `external_ref` | string | Your order/service id; queryable via `GET /v1/proxies?external_ref=` |
| `limits.max_conns` / `limits.new_conn_rate` | int | `0` = unlimited (default) for each |

Exactly one of `expires_at` or `duration_seconds` is required.

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/proxies \
  -H "Authorization: Bearer $BILLING_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: paymenter-service-1042-provision" \
  -d '{"location":"de-fra","ip_count":2,"instances_per_ip":2,"ip_mode":"oversell","protocols":["socks5","http"],"duration_seconds":2592000,"external_ref":"paymenter-service-1042","limits":{"max_conns":500,"new_conn_rate":50}}'
```

```json
{"node_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
 "instances": [
   { "id": "3f6c2a1e-9b7d-4c2f-8e1a-5d0b9c7e2f44", "ip": "203.0.113.9", "port": 10000, "protocols": ["socks5","http"], "status": "active", "username": "u_9f1c4a8e2b6d3071", "password": "Xq7vT2kLp9sW4mZaB1nD8eRf", "expires_at": "2026-10-25T12:00:00Z", "external_ref": "paymenter-service-1042", "max_conns": 500, "new_conn_rate": 50 },
   { "id": "b41e8c07-2d5a-4f93-8c61-7e0a3b9d5f12", "ip": "203.0.113.9", "port": 10001, "protocols": ["socks5","http"], "status": "active", "username": "u_3a7d0e5c8b1f6429", "password": "T4mN8qW2sZ6xK1vB7rL9pYcE", "expires_at": "2026-10-25T12:00:00Z", "external_ref": "paymenter-service-1042", "max_conns": 500, "new_conn_rate": 50 },
   { "id": "c92a1d63-5e0b-4c78-b4f2-8a1d6e3f7c90", "ip": "203.0.113.10", "port": 10002, "protocols": ["socks5","http"], "status": "active", "username": "u_c8e2f4a91d7b3065", "password": "K9pL3vR7wX1sT5mZ8qB4nDaC", "expires_at": "2026-10-25T12:00:00Z", "external_ref": "paymenter-service-1042", "max_conns": 500, "new_conn_rate": 50 },
   { "id": "d1f7b820-9c4e-4a15-8e73-2b6d0f9c4a37", "ip": "203.0.113.10", "port": 10003, "protocols": ["socks5","http"], "status": "active", "username": "u_5b1a9e7c3d2f8064", "password": "P2wQ6zN0xJ4vL8sR3tY7mEbG", "expires_at": "2026-10-25T12:00:00Z", "external_ref": "paymenter-service-1042", "max_conns": 500, "new_conn_rate": 50 }
 ]}
```

The plaintext `username`/`password` appear only here (and via credentials
reset). The first instance above connects as
`socks5://u_9f1c4a8e2b6d3071:Xq7vT2kLp9sW4mZaB1nD8eRf@203.0.113.9:10000`.

### What "atomic" means

```mermaid
sequenceDiagram
    participant C as Caller
    participant CP as control-plane
    participant DB as PostgreSQL
    participant A as proxtreed
    C->>CP: POST /v1/proxies
    CP->>DB: BEGIN, lock node_ips FOR UPDATE (id order)
    CP->>DB: re-verify capacity + eligibility, allocate ports, INSERT instance + credential + ip_history, COMMIT
    CP->>A: POST /v1/instances/sync (full desired state)
    alt agent confirms
        A-->>CP: {"ok":true,"applied":N,"errors":[]}
        CP-->>C: 201 with credentials
    else agent fails
        A-->>CP: {"ok":false,...}
        CP->>DB: compensating tx: DELETE the instances just created
        CP-->>C: 502 agent_sync_failed (nothing half-exists)
    end
```

One transaction locks every `node_ips` row of the candidate node `FOR UPDATE`
in deterministic id order, re-verifies capacity and IP eligibility under the
lock, allocates the lowest free ports node-wide, and inserts instance +
credential + `ip_history` rows. Only then does the control plane push the full
desired state. If the agent cannot apply it, a compensating transaction deletes
exactly what was created (audited as `proxy.provision_compensated`) and the call
fails with `502 agent_sync_failed`. Nothing half-exists.

### Worked example: three ports on one IP

`ip_count: 1, instances_per_ip: 3` yields three proxies sharing one address on
three distinct ports — the common "more sessions, one egress IP" shape.

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/proxies \
  -H "Authorization: Bearer $BILLING_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-2201-provision" \
  -d '{"node_id":"7c9e6679-7425-40de-944b-e07fc1f90ae7","ip_count":1,"instances_per_ip":3,"ip_mode":"oversell","protocols":["socks5"],"duration_seconds":86400,"external_ref":"order-2201"}'
```

The response carries three instances, all with the same `ip` and three different
`port` values. Prefer to omit `node_id` unless you are deliberately pinning one.

Errors: `400 bad_request`, `404 not_found` (bad or missing `node_id`),
`422 invalid_protocols`, `422 invalid_expiry`, `422 node_offline`,
`422 insufficient_capacity`, `422 unsatisfiable_plan`, `502 agent_sync_failed`.

## Lifecycle

`suspend`/`resume`/`extend` all run in a transaction, push the change to the
agent, and roll back (with `502 agent_sync_failed`) if the agent cannot apply
it. A 2xx therefore means the change is live on the node.

| Method | Path | Role | Semantics |
| --- | --- | --- | --- |
| `POST` | `/v1/proxies/{id}/suspend` | admin, billing | Stops serving but keeps the record **and** its capacity. Only `active` instances. |
| `POST` | `/v1/proxies/{id}/resume` | admin, billing | Returns it to `active`. Only `suspended`; past `expires_at` it is `422 instance_expired`. |
| `DELETE` | `/v1/proxies/{id}` | admin, billing | Frees the IP/port and removes the row, in two phases (below). |
| `POST` | `/v1/proxies/{id}/extend` | admin, billing | Changes `expires_at`. Extending an `expired` instance revives it to `active`. |

**Suspend** keeps the `(IP, port)` allocation, so a resume restores the
customer's binding; `409 invalid_state` if not active. **Resume** is the flip
side: `409 invalid_state` if not suspended, `422 instance_expired` if past
expiry (extend first).

**Delete** is two phases on purpose: phase 1 marks the instance `expired` and
confirms the agent tore the listener down (on failure the status is restored and
`502 agent_sync_failed` is returned); phase 2 deletes the rows and frees the IP
and port. The agent never enforces an instance the control plane has forgotten.

```json
{ "instance": { "id": "3f6c2a1e-9b7d-4c2f-8e1a-5d0b9c7e2f44", "status": "suspended" } }
```

**Extend** is renewal. `expires_at` must be RFC 3339 and in the future.

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/proxies/3f6c2a1e-9b7d-4c2f-8e1a-5d0b9c7e2f44/extend \
  -H "Authorization: Bearer $BILLING_TOKEN" -H "Content-Type: application/json" \
  -d '{"expires_at":"2026-11-25T12:00:00Z"}'
# {"instance":{...}}
```

Errors: `400 bad_request` (not RFC 3339), `422 invalid_expiry` (past), `404`,
`502 agent_sync_failed`.

## Credentials

`POST /v1/proxies/{id}/credentials/reset` generates a fresh username and
password, replaces the stored credential, and pushes the change to the agent
**before** returning success. The old pair stops working immediately — it dies
the moment this call returns 2xx. On agent failure the previous credential row
is restored (`502 agent_sync_failed`).

**Role:** admin, billing.

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/proxies/3f6c2a1e-9b7d-4c2f-8e1a-5d0b9c7e2f44/credentials/reset \
  -H "Authorization: Bearer $BILLING_TOKEN"
# {"proxy_instance_id":"3f6c2a1e-9b7d-4c2f-8e1a-5d0b9c7e2f44",
#  "username":"u_4b8d1f6a9c2e5073","password":"Zk3pW8vN1sQ6mXaT4bR7yD2e"}
```

The plaintext password is returned only here and at provisioning (username `u_` + 16 hex characters, password a 24-character URL-safe random string). Errors: `400`, `404`, `502 agent_sync_failed`.

## Rotation

A two-party flow: a client files a request, an admin resolves it. At most **one
pending request per instance** is guaranteed by a partial unique index.

### `POST /v1/proxies/{id}/rotation`

**Role:** admin, billing. Files a pending request; only `active` instances may
request one (`422 invalid_state` otherwise). The body is optional.

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/proxies/3f6c2a1e-9b7d-4c2f-8e1a-5d0b9c7e2f44/rotation \
  -H "Authorization: Bearer $BILLING_TOKEN" -H "Content-Type: application/json" \
  -d '{"reason":"customer reports IP blocked by target site"}'
# {"rotation":{"id":"b3e1f8a2-4c6d-4e9f-9a1b-2d5c7e8f0a11","proxy_instance_id":"3f6c2a1e-...",
#  "status":"pending","reason":"customer reports IP blocked by target site","requested_at":"2026-09-25T12:00:00Z",
#  "resolved_at":null,"resolved_by":null}}
```

Errors: `404`, `409 rotation_pending`, `422 invalid_state`.

### GET /v1/rotations

**Role:** admin, billing. Returns `{"rotations":[...]}`, newest first, capped at
200, enriched with the instance's current binding and node — each item is the
rotation row plus `instance_ip`, `instance_port`, `node_id` and `node_name`.
Filter with `?status=pending` (or `accepted`, `denied`, `ignored`, `no_slots`);
an unknown value is `400 bad_request`.

### `POST /v1/rotations/{id}/resolve`

**Role:** admin. Resolves a pending request with `action`: `accept`, `deny` or
`ignore`.

| Action | Effect |
| --- | --- |
| `accept` | Moves the instance to a new `(IP, port)` on the same node and resolves `accepted` |
| `deny` | Resolves `denied`; no change to the instance |
| `ignore` | Resolves `ignored`; no change to the instance |

On accept, the control plane locks the node's IP rows and picks a replacement:
it excludes the instance's current IP, any IP the instance released within
`PROXTREE_ROTATION_COOLDOWN` (default `10m`), and any IP without free capacity.
IPs the instance has **never** used (from `ip_history`) are preferred over
previously used ones. The current port is explicitly excluded, so the new
binding is genuinely new — new IP **and** new port. On agent failure everything
is rolled back and the request is re-opened to `pending`.

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/rotations/b3e1f8a2-4c6d-4e9f-9a1b-2d5c7e8f0a11/resolve \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"accept"}'
# {"rotation":{"status":"accepted","resolved_at":"2026-09-25T12:20:41Z","resolved_by":"admin:ops",...},
#  "instance":{"id":"3f6c2a1e-...","ip":"203.0.113.11","port":10007,"status":"active",...}}
```

`rotation` is always returned; `instance` is returned by `accept`.

**`no_slots` and offline behaviour.** If no eligible replacement IP exists the
request does not fail — it resolves to `no_slots` with HTTP 200. Read
`rotation.status`: `no_slots` means "add IPs or wait out the cooldown", not
"retry the call". If the node is not `online`, the call returns
`503 node_offline` and the request deliberately **stays pending**, so it can be
resolved once the node recovers — never a silent failure.

Errors: `400 bad_request` (bad action), `404 not_found`,
`409 rotation_not_pending`, `502 agent_sync_failed`, `503 node_offline`.

## Status and metrics

### `GET /v1/proxies/{id}/status`

**Role:** admin, billing. Combines the control-plane record with live agent
data, degrading gracefully when the agent is unreachable — the call still
returns 200.

```json
{"instance": { "id": "3f6c2a1e-9b7d-4c2f-8e1a-5d0b9c7e2f44", "ip": "203.0.113.9", "port": 10000, "status": "active" },
 "node": { "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7", "name": "de-fra-1", "location": "de-fra", "status": "online" },
 "live": { "reachable": true, "bound_ips": ["203.0.113.9","203.0.113.10"],
   "load": { "active_conns": 341, "goroutines": 1204 },
   "instance": { "id": "3f6c2a1e-9b7d-4c2f-8e1a-5d0b9c7e2f44", "port": 10000, "ip": "203.0.113.9",
     "active_conns": 12, "bytes_in": 9382210, "bytes_out": 51230011, "uptime_seconds": 86399,
     "last_seen": "2026-09-25T12:00:00Z" }}}
```

`live` is `null` when the node token cannot be decrypted;
`{"reachable":false,"error":"..."}` when the agent call fails; otherwise
`{"reachable":true,...}`. `live.instance` is `null` when the agent does not know
that instance id.

### GET /v1/proxies

**Role:** admin, billing. Returns `{"instances":[...]}`, oldest first, capped at
200. Filters: `?external_ref=<id>` (the billing order id — use this to reconcile
a sale), `?node_id=<uuid>`, `?status=active|suspended|expired`. Errors: `400`
(non-UUID `node_id`, unknown status).

## Audit

`GET /v1/audit` returns `{"entries":[...]}`, newest first, capped at 500.
**Role:** admin. Filters: `?action=proxy.provision`, `?resource_type=node`,
`?limit=N` (default 100, clamped 1..500).

```json
{"entries": [
  { "id": 1042, "actor": "billing:paymenter", "action": "proxy.provision", "resource_type": "node",
    "resource_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "detail": { "instance_ids": ["3f6c2a1e-9b7d-4c2f-8e1a-5d0b9c7e2f44"], "ip_count": 2, "protocols": ["socks5"] },
    "ip": "10.0.0.9", "created_at": "2026-09-25T12:00:00Z" }
]}
```

Actions include `node.create`, `node.update`, `node.delete`, `node.token_rotate`,
`ip.create`, `ip.update`, `ip.delete`, `proxy.provision`,
`proxy.provision_compensated`, `proxy.suspend`, `proxy.resume`, `proxy.delete`,
`proxy.extend`, `credential.reset`, `credential.reset_compensated`,
`rotation.request`, `rotation.accepted`, `rotation.denied`, `rotation.ignored`,
`rotation.no_slots`, `rotation.compensated`, `token.create`, `token.revoke`.

::: info Audit is transactional
Provisioning, credential and rotation actions are written to `audit_log` **in
the same transaction** as the change they describe. Either the change and its
audit row both commit, or neither does — which is why a failed provision leaves
`proxy.provision_compensated` rather than a `proxy.provision` claiming success.
:::

## Agent control channel

This is the API the **agent implements** and the **control plane consumes** —
the reverse of everything above. It lives on each node's own URL (default
`:9090`); the billing addon never calls it directly. Every request requires
`Authorization: Bearer <node token>`, compared in constant time;
`PROXTREE_PREV_NODE_TOKEN` is accepted during rotation windows, and
`PROXTREE_MTLS_CA` additionally requires a verified client certificate. The
agent's error shape is a single `error` string (`{"error":"unauthorized"}`).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/health` | Liveness: `{"status","version","uptime_seconds"}` |
| `POST` | `/v1/instances/sync` | Replace the node's whole desired instance set |
| `GET` | `/v1/status` | Per-instance metrics, `bound_ips`, `load`, `ip_health`, `unreachable_ips` |
| `GET` | `/v1/metrics` | Prometheus text (default), `?format=json`, `?format=influx` |

`POST /v1/instances/sync` carries the **entire** desired set plus `probe_ips`
(the control plane's registered inventory for that node). The agent stores it in
one SQLite transaction, then creates, recreates or removes listeners to match;
syncs are idempotent and serialized. Response
`{"ok":true,"applied":1,"errors":[]}` — any per-instance error makes `ok=false`,
and the control plane treats the sync as failed (a silently unbound instance
would otherwise be sold as working).

```json
{"instances": [ { "id": "3f6c2a1e-9b7d-4c2f-8e1a-5d0b9c7e2f44", "port": 10000, "ip": "203.0.113.9",
   "protocols": ["socks5","http"], "username": "u_9f1c4a8e2b6d3071", "password": "Xq7vT2kLp9sW4mZaB1nD8eRf",
   "expires_at": "2026-10-25T12:00:00Z", "max_conns": 500, "new_conn_rate": 50 } ],
 "probe_ips": ["203.0.113.9", "203.0.113.10"]}
```

`GET /v1/metrics` emits one sample per instance with labels `{instance_id, port,
ip}`:

| Metric | Type | Meaning |
| --- | --- | --- |
| `bytes_in_total` | counter | Bytes received from clients (upload) |
| `bytes_out_total` | counter | Bytes sent to clients (download) |
| `active_conns` | gauge | Currently open client connections |
| `conns_total` | counter | Total accepted client connections |
| `uptime_seconds` | gauge | Seconds since the listener was created |

```text
# HELP active_conns Currently open client connections.
# TYPE active_conns gauge
active_conns{instance_id="3f6c2a1e-9b7d-4c2f-8e1a-5d0b9c7e2f44",port="10000",ip="203.0.113.9"} 12
```

`?format=json` returns
`{"instances":[{"instance_id","port","ip","bytes_in_total","bytes_out_total","active_conns","conns_total","uptime_seconds"}]}`;
`?format=influx` returns InfluxDB line protocol under the `proxtree` measurement
with tags `instance_id`, `port`, `ip`. The path is configurable via
`PROXTREE_METRICS_PATH` (default `/v1/metrics`).

## Worked example

One end-to-end sequence: register a node, add an oversell IP block, check
availability, provision 2 IPs × 2 ports, reset credentials, request and resolve
a rotation, extend, then delete. Requires `curl` and `jq`.

```bash
#!/usr/bin/env bash
set -euo pipefail

CP="http://127.0.0.1:8080"
TOKEN="ptx_replace_me_with_a_bootstrap_admin_token"
NODE_AGENT_URL="http://10.0.0.5:9090"

# req METHOD PATH [JSON] [IDEMPOTENCY-KEY]
req() {
  local method="$1" path="$2" data="${3:-}" idem="${4:-}"
  local args=(-fsS -X "$method" "$CP$path" -H "Authorization: Bearer $TOKEN")
  [ -n "$data" ] && args+=(-H "Content-Type: application/json" -d "$data")
  [ -n "$idem" ] && args+=(-H "Idempotency-Key: $idem")
  curl "${args[@]}"
}

# 1. Register the node; the node token is shown exactly once.
NODE=$(req POST /v1/nodes "{\"name\":\"de-fra-1\",\"url\":\"$NODE_AGENT_URL\",\"location\":\"de-fra\"}")
NODE_ID=$(jq -r '.node.id' <<<"$NODE")
NODE_TOKEN=$(jq -r '.token' <<<"$NODE")
echo "node $NODE_ID registered; node token: $NODE_TOKEN"

# Bring the node online by heartbeating as the agent would (it does this every 15s).
curl -fsS -X POST "$CP/v1/nodes/heartbeat" -H "Authorization: Bearer $NODE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bound_ips":["203.0.113.9","203.0.113.10"],"active_conns":0,"instance_count":0}' | jq .

# 2. Add an oversell block: 203.0.113.8/30 -> .9 and .10, up to 10 instances each.
req POST "/v1/nodes/$NODE_ID/ips" \
  '{"cidr":"203.0.113.8/30","mode":"oversell","max_instances":10,"label":"fra pool"}' | jq '.ips[].address'

# 3. Check availability for the shape we are about to buy.
AVAIL=$(req POST /v1/availability/check \
  '{"location":"de-fra","ip_count":2,"instances_per_ip":2,"ip_mode":"oversell","protocol":"socks5"}')
jq -e '.available' <<<"$AVAIL" >/dev/null || { echo "out of stock: $(jq -r '.detail.hint' <<<"$AVAIL")"; exit 1; }

# 4. Provision 2 distinct IPs x 2 ports = 4 instances, idempotently.
PROV=$(req POST /v1/proxies \
  '{"location":"de-fra","ip_count":2,"instances_per_ip":2,"ip_mode":"oversell","protocols":["socks5","http"],"duration_seconds":2592000,"external_ref":"order-2201","limits":{"max_conns":500,"new_conn_rate":50}}' \
  "order-2201-provision")
FIRST=$(jq -r '.instances[0].id' <<<"$PROV")
jq -r '.instances[] | "\(.username):\(.password)@\(.ip):\(.port)"' <<<"$PROV"

# 5. Reset the first instance's credentials; the old pair dies immediately.
req POST "/v1/proxies/$FIRST/credentials/reset" | jq .

# 6. Request a rotation for the first instance.
ROT_ID=$(req POST "/v1/proxies/$FIRST/rotation" \
  '{"reason":"customer reports IP blocked by target site"}' | jq -r '.rotation.id')

# 7. Resolve it as an admin. Inspect .rotation.status: accepted or no_slots.
req POST "/v1/rotations/$ROT_ID/resolve" '{"action":"accept"}' \
  | jq '{status: .rotation.status, ip: .instance.ip, port: .instance.port}'

# 8. Extend the first instance by 60 days (renewal).
NEW_EXPIRY=$(date -u -d '+60 days' +%Y-%m-%dT%H:%M:%SZ)
req POST "/v1/proxies/$FIRST/extend" "{\"expires_at\":\"$NEW_EXPIRY\"}" | jq '.instance.expires_at'

# 9. Delete the first instance; its IP/port is freed for resale.
req DELETE "/v1/proxies/$FIRST" | jq .
```

## See also

- [Quick Start](/proxtree/getting-started/quick-start) — install to a working proxy in six steps.
- [Configuration Reference](/proxtree/configuration/reference) — every variable and installer flag.
- [CLI Reference](/proxtree/user-guide/cli) — `control-planed` and `proxtreed` commands.
- [Paymenter Addon](/proxtree/user-guide/paymenter) — the billing client that consumes this API.
- [Operations](/proxtree/user-guide/operations) — the rotation queue, node health and capacity.
- [Provisioning](/proxtree/architecture/provisioning) — the locking and compensation model in depth.
