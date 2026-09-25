---
title: Proxy Engine
description: How the ProxTree node agent turns one (IP, port, credential) allocation into a SOCKS5, SOCKS4 or HTTP proxy pinned to that IP — dispatch, relays, limits, expiry and metrics.
---

# Proxy Engine

`proxtreed` is the node agent. It owns everything between a client's TCP
connection and the upstream server, and it asks the control plane nothing:
credential checks, port binding, connection limits and expiry are all local.

The engine is one package (`agent/internal/engine`) over three hand-written
protocol handlers (`agent/internal/proto`). One `net.Listener` per instance,
first-byte dispatch, one shared relay — so accounting, limits and bug fixes have
exactly one home. See the [Architecture overview](./overview) for how the agent
and control plane fit together.

## One listener per instance

An instance is one credential pair bound to one `(IP, port)` on one node, and it
gets its own listener: `net.Listen("tcp", fmt.Sprintf(":%d", in.spec.Port))`.

The empty host binds every interface (dual-stack — what the control plane calls
`0.0.0.0:<port>`). Two consequences follow:

- **Inbound is not IP-restricted.** The listener accepts from anywhere the
  firewall allows, deliberately: a customer's users are arbitrary clients on the
  public internet, so source-IP filtering would break the product. The
  **credential pair is the access control** — SOCKS5 username/password, or HTTP
  `Proxy-Authorization: Basic` (SOCKS4 is the documented exception, below).
- **A port is node-wide, not per-IP.** `1.2.3.4:10000` and `5.6.7.8:10000` on one
  host are the same socket, so ports are allocated node-wide; see
  [Port allocation](./provisioning#port-allocation).

The accept loop is the gate every connection passes:

```go
// acceptLoop (abridged)
c, err := in.ln.Accept()
if time.Now().After(in.spec.ExpiresAt) { c.Close(); continue } // hard expiry gate
if in.bucket != nil && !in.bucket.allow() { c.Close(); continue }
if in.sem != nil { select { case in.sem <- struct{}{}: default: c.Close(); continue } }
```

### The reconcile model

The control plane never sends incremental commands. It pushes the node's **entire
desired state** to `POST /v1/instances/sync`, and `Engine.Reconcile` makes reality
match it. Three operations, no others:

| Operation | Trigger | Behaviour |
|---|---|---|
| Create | Desired ID not running | Bind `0.0.0.0:<port>`, start the accept loop |
| Recreate | Running ID whose spec changed | Close listener and tracked connections synchronously (freeing the port), then rebind |
| Remove | Running ID absent from the desired set | Close listener and connections, drop it |

"Spec changed" is field-by-field (`Instance.matches`): port, IP, username,
password, `max_conns`, `new_conn_rate`, expiry, and the protocol set
(order-insensitive). Any change tears the instance down and recreates it — a
credential pair or source IP cannot be swapped under a live connection. Reconcile
is serialized by an engine mutex, so concurrent syncs are safe and idempotent;
the listener closes **synchronously** so a replacement can rebind the port
immediately, while draining handler goroutines happens in the background.

## First-byte dispatch

All three protocols are detected on the same socket. The handler peeks one byte
through a `bufio.Reader` and never un-reads it — the reader is handed to both the
protocol handler and the relay, so the peeked byte is not lost.

```mermaid
flowchart TD
    PEEK["Peek first byte"] --> D5{"0x05?"}
    D5 -->|"yes"| E5{"socks5 enabled?"}
    E5 -->|"yes"| H5["ServeSOCKS5 -> relay"]
    E5 -->|"no"| CLOSE["Close immediately"]
    D5 -->|"no"| D4{"0x04?"}
    D4 -->|"yes"| E4{"socks4 enabled?"}
    E4 -->|"yes"| H4["ServeSOCKS4 -> relay"]
    E4 -->|"no"| CLOSE
    D4 -->|"no"| DA{"ASCII letter?"}
    DA -->|"yes"| EA{"http enabled?"}
    EA -->|"yes"| HA["ServeHTTP"]
    EA -->|"no"| CLOSE
    DA -->|"no"| CLOSE
```

| First byte | Protocol | Handler | On success |
|---|---|---|---|
| `0x05` | SOCKS5 (RFC 1928) | `proto.ServeSOCKS5` | Returns upstream, engine relays |
| `0x04` | SOCKS4 / SOCKS4a | `proto.ServeSOCKS4` | Returns upstream, engine relays |
| ASCII letter `A-Z` / `a-z` | HTTP | `proto.ServeHTTP` | CONNECT returns upstream; forward proxy serves in place |
| Anything else | — | — | Socket closed, no reply |

The test is a letter, not "any printable byte", because every HTTP method in use
starts with one: a stray `0x16` (TLS ClientHello aimed at a proxy port), `0x03`
or NUL is closed with no response. A protocol not enabled on the instance is
closed **identically to garbage** — an `http`-only instance does not tell a
SOCKS5 client "not offered here", it just closes.

## SOCKS5 (RFC 1928 + 1929)

`ServeSOCKS5` runs the whole handshake. Every instance carries a credential pair,
so username/password is the **only** method selected — no-auth (`0x00`) is never
offered, even if the client asks first.

1. **Greeting.** `VER = 0x05`, `NMETHODS`, then `NMETHODS` method bytes. A
   version other than `0x05` closes the connection with no reply.
2. **Method selection.** `NMETHODS == 0`, or a list without `0x02`
   (username/password), gets `0x05 0xFF` (no acceptable methods) and close.
   Otherwise the reply is `0x05 0x02` and the handshake continues.
3. **RFC 1929 subnegotiation.** `VER = 0x01`, `ULEN`, `UNAME`, `PLEN`, `PASSWD`.
   The pair is compared with the instance credential in constant time (length
   check, then `crypto/subtle.ConstantTimeCompare`). Mismatch writes `0x01 0x01`
   (failure) and closes; success writes `0x01 0x00`.
4. **Request.** `VER`, `CMD`, `RSV`, `ATYP`, address, port. All three address
   forms are accepted: `ATYP = 0x01` for a 4-byte IPv4 address, `0x04` for a
   16-byte IPv6 address, and `0x03` for a domain (1 length byte, then the name;
   an empty name is rejected).
5. **Command.** Only `CONNECT` (`0x01`) is implemented. `BIND` (`0x02`) and
   `UDP ASSOCIATE` (`0x03`) get reply code `0x07` (command not supported) and the
   connection closes. There is no UDP relay path anywhere in the engine.
6. **Dial and reply.** The engine dials from the instance's assigned IP (see
   [Outbound IP pinning](#outbound-ip-pinning)). Success writes `0x05 0x00` plus
   `BND.ADDR`/`BND.PORT` from the *upstream socket's local address* — the
   instance's assigned IP and its ephemeral source port, not the client's view of
   the proxy. The connection then goes to the shared relay.

| Reply | Meaning | When sent |
|---|---|---|
| `0x00` | Succeeded | Dial succeeded, with bound address/port |
| `0x01` | General server failure | Any dial error that is not refusal, DNS failure or timeout |
| `0x04` | Host unreachable | `*net.DNSError`, or a dial timeout |
| `0x05` | Connection refused | Dial failed with `ECONNREFUSED` |
| `0x07` | Command not supported | `CMD` is not `CONNECT` |
| `0xFF` | No acceptable methods | Client offers no methods, or none is `0x02` |

Authentication failure is not a SOCKS5 reply: it is the subnegotiation status
byte `0x01 0x01`, written before any request is read. Error replies carry
`0.0.0.0:0` as the bound address.

## SOCKS4 / 4a

`ServeSOCKS4` handles the older protocol including the SOCKS4a domain form.

1. An 8-byte header: `VN = 0x04`, `CD`, 2-byte destination port, 4-byte
   destination IPv4 address. A different `VN` closes the connection.
2. The **user-id** follows as a NUL-terminated string (capped at 256 bytes). It
   is read and discarded.
3. If the destination IP is `0.0.0.x` with `x != 0`, the request is SOCKS4a: a
   NUL-terminated domain (capped at 512 bytes) follows the user-id and replaces
   the address. Name resolution happens with the instance's source IP bound, so
   lookups leave from the right interface.
4. Only `CD = 0x01` (CONNECT) is supported. Any other command gets the 8-byte
   rejection `VN = 0x00`, `CD = 0x5B`, and close.
5. A successful dial replies `VN = 0x00`, `CD = 0x5A` (granted) with the
   upstream's bound port and IPv4 address when IPv4, otherwise zeros. Every
   failure is `0x5B`.

::: warning SOCKS4 has no authentication mechanism
SOCKS4 predates credentials. It carries a **user-id** field and nothing else: no
password, no challenge, no verification. This implementation reads it only to
advance past it. There is nothing to compare it against — the instance has a
username *and* a password, and SOCKS4 can transmit only the former.

The consequence: **an instance that enables `socks4` accepts any SOCKS4 CONNECT
from anyone who can reach the port.** Access control rests only on the allocation
being unguessable (an IP and a port in a 10 000–60 000 range) plus the
instance-level limits — `max_conns`, `new_conn_rate`, `expires_at` — which the
engine enforces before dispatch. An attacker who learns the `ip:port` has a
working open proxy; the credential pair does not stop them.

The tradeoff is deliberate: SOCKS4 exists for old clients that cannot speak
SOCKS5. **When per-user authentication matters, enable `socks5` and/or `http` on
the instance instead.** Reserve `socks4` for plans whose customer explicitly
needs it, and treat the port as the shared secret.
:::

## HTTP proxy

`ServeHTTP` implements both halves of an HTTP proxy. Authentication is checked
before the method is inspected, and that ordering is the contract.

**Authentication.** Every request needs a valid
`Proxy-Authorization: Basic <base64(user:pass)>`, parsed, base64-decoded, split on
the first colon, and compared to the instance credential in constant time.
Failure gets a 407 (headers abridged):

```text
HTTP/1.1 407 Proxy Authentication Required
Proxy-Authenticate: Basic realm="proxtree"
```

The rule that matters: because the check precedes the method branch, **CONNECT
never succeeds without auth when the instance has credentials.** No path
establishes a tunnel for an unauthenticated client.

**CONNECT tunnelling.** For `CONNECT host:port`, the authority must include a
port; without one the client gets `400 Bad Request` with a one-line plain-text
body, and a dial failure gets `502 Bad Gateway`. On success the client receives
`HTTP/1.1 200 Connection Established` and the raw connection goes to the shared
relay — nothing inside the tunnel is parsed, so HTTPS, WebSocket and SSH work
unchanged.

**Forward proxying.** Any other method with an **absolute** `http://` request URI
is served in place:

```bash
curl -x http://user:pass@198.51.100.7:10000 http://example.com/
```

A missing URL, a non-absolute URL, or a non-`http` scheme gets `400 Bad Request`
("forward proxy requires an absolute http:// request URI"); a host with no port
defaults to `:80`. Before forwarding, the request is sanitised:

| Step | Why |
|---|---|
| Clone the request and clear `RequestURI` | `Request.Write` then emits the origin form (`GET /path`) from the URL, not the client's absolute form |
| Delete every header whose lowercased name starts with `proxy-` | The client's `Proxy-Authorization` (and other hop-by-hop proxy headers) must not reach the origin |
| Dial from the instance's assigned IP | Same pinning as the other protocols |

The upstream response is written back verbatim. Client keep-alive is supported
with a loop: the next request is read from the same connection with an idle
deadline equal to the handshake timeout (30 s default), and **each request is
re-authenticated** — a client cannot authenticate once and then send
unauthenticated requests on that connection. An idle timeout, or the first failed
re-auth, ends the connection. Only plain `http://` traffic is forward-proxied.

## The shared relay

All three protocols converge on one function: `ServeSOCKS5` and `ServeSOCKS4`
return a connected upstream after their handshake, and so does a successful HTTP
CONNECT.

```go
// agent/internal/engine/relay.go (abridged)
go func() { _, _ = io.Copy(upstream, io.MultiReader(br, client)); closeWrite(upstream) }()
go func() { _, _ = io.Copy(client, upstream); closeWrite(client.Conn) }()
wg.Wait()
```

Three details carry weight:

- **`io.MultiReader(br, client)`** drains bytes the handshake reader already
  buffered before reading the socket, so a payload sent in the same segment as
  the handshake (pipelined HTTP, a tunnel's first bytes) is not dropped.
- **Half-close propagation.** On EOF in one direction, `closeWrite` shuts only
  the peer's write side (`CloseWrite` on a `*net.TCPConn`, with a full-close
  fallback), so protocols that key on EOF — HTTP/1.0 responses, echo servers —
  keep working.
- **`countingConn`** wraps the client socket: `Read` (client to proxy, upload)
  accumulates `bytes_in`, `Write` (proxy to client, download) accumulates
  `bytes_out`. Because the handlers *and* the relay read and write through this
  one wrapper, every byte is counted exactly once.

**Why a single core matters.** Three copy loops would mean three accounting paths
to keep numerically identical, three places a limit could be forgotten, and three
half-close implementations to fix when one is subtly wrong. One relay means one
answer to "how many bytes did this customer move" and one place `max_conns` is
honoured.

## Outbound IP pinning

Every outbound connection of an instance leaves from the instance's assigned
address, so the customer's traffic egresses from the IP they bought:

```go
// agent/internal/engine/instance.go
in.dialer = net.Dialer{LocalAddr: &net.TCPAddr{IP: net.ParseIP(spec.IP)}, Timeout: 15 * time.Second}
```

`LocalAddr` makes the kernel bind the source address of every dial — including
the DNS lookups a SOCKS5 or SOCKS4a domain target needs. When a plan says
`198.51.100.7`, every request from that credential appears to the destination as
coming from `198.51.100.7`, not the node's primary address. It is a hard failure,
not a preference: if the address is not on a local interface the kernel refuses
the bind and every dial fails. The agent reports that plainly at sync time:

```text
level=WARN msg="instance ip is not assigned to a local interface; attempting anyway" id=... ip=...
```

Why reachability is *also* probed separately is covered in
[Reachability probing](#reachability-probing).

## Connection limits

Two optional per-instance limits, both enforced in the accept loop before a
connection is registered.

**`max_conns` — a semaphore.** A buffered channel of capacity `max_conns`,
claimed with a non-blocking send and released when the handler returns. `0` means
unlimited (no channel is created). A semaphore rather than a counter because the
slot must be released on every exit path, including teardown mid-handshake.

**`new_conn_rate` — a token bucket.** A **`float64` connections-per-second**
rate. Tokens accumulate at that rate up to a burst of `max(rate, 1)`; each
accepted connection consumes one, and a connection is refused when fewer than one
token is available. Two properties follow:

- **Fractional rates work.** `0.5` averages one new connection every two seconds,
  not "one per second and never more" — the bucket refills at `rate * elapsed`.
- **A sub-1 rate still admits an event once full.** The burst floor of 1 means
  `new_conn_rate: 0.1` does not wedge a client out forever; it lets one
  connection through per ten seconds once the bucket has refilled.

`0` disables the limiter. **A refused connection is closed immediately** — no
SOCKS5 reply code, no HTTP 407, no error body. The limit is a resource-exhaustion
control, and emitting a protocol-level error would require parsing a handshake
before deciding whether to serve it. The client sees a fast connect-then-close,
usually reported as a connection error, and rejected connections are not counted
because the limits are checked before the connection joins the tracking map — so
a rate-limited connection neither inflates metrics nor holds a `max_conns` slot.

## Expiry enforcement

When `expires_at` passes, the instance stops existing on the node — without a
round trip to the control plane.

A janitor goroutine ticks every second (`engine.Options.JanitorInterval`) and,
under the engine lock: deletes the instance from the running map, closes the
listener and every tracked connection, then deletes the credential row from the
local SQLite store. Independently, the accept loop checks
`time.Now().After(in.spec.ExpiresAt)` at the gate, so the window between the
deadline and the next janitor tick cannot accept traffic.

Expiry is enforced locally by design. The control plane also sweeps
(`ExpireInstances`, every `PROXTREE_SWEEP_INTERVAL`, default 10 s) to keep
`proxy_instances.status` truthful for capacity accounting — an `expired` instance
frees its slot and port for reallocation. But a node whose control plane is
unreachable, or one rebooting into a stale database, still stops serving on the
exact deadline: a customer's plan ends when it ends, and that cannot depend on
the availability of a different machine. Because the desired state only ever
contains `active`, non-expired instances, an expiry the agent enforces locally
disappears from the next sync's payload too.

## Local credential store

The desired set is mirrored into an embedded SQLite database (pure-Go
`modernc.org/sqlite`, no cgo), so a reboot does not lose the node:

```sql
CREATE TABLE IF NOT EXISTS instances (
    id            TEXT PRIMARY KEY,
    port          INTEGER NOT NULL,
    ip            TEXT NOT NULL,
    protocols     TEXT NOT NULL,           -- JSON array: ["socks5","http"]
    username      TEXT NOT NULL,
    password      TEXT NOT NULL,
    expires_at    INTEGER NOT NULL,        -- unix milliseconds
    max_conns     INTEGER NOT NULL DEFAULT 0,
    new_conn_rate REAL NOT NULL DEFAULT 0,
    synced_at     INTEGER NOT NULL DEFAULT 0
);
```

The file is created (and chmod'd, even if it already existed) with mode `0600`,
and its directory with `0700`. The connection string sets `busy_timeout(5000)`,
`journal_mode(WAL)` and `foreign_keys(1)`; the pool is capped at one connection
because SQLite has a single writer, and serializing writes in Go avoids
`SQLITE_BUSY` between concurrent transactions.

**Why passwords are stored as received.** The agent terminates
username/password authentication itself, in both SOCKS5 and HTTP. To compare a
presented password it must hold the same plaintext the customer was given. A hash
is useless for RFC 1929 or Basic auth — not a hash skipped for convenience, but a
case where a hash cannot work. The control plane stores credentials with
AES-256-GCM (`password_enc`); the agent cannot do better than plaintext in a
`0600` file, and the file permissions are the control that matters.

**How reconciliation stays in step.** The sync carries the whole desired set, and
the store's `Reconcile` applies it in one transaction: upsert every desired
instance (port, IP, protocols, credentials, expiry, limits, `synced_at`), then
delete every row whose ID is not in the set. There is no partial update to get
wrong and nothing to garbage-collect — the table is, at all times, the last
desired state the control plane sent.

## Boot restore and autonomy

At startup `proxtreed` opens the SQLite store, starts the engine (and its expiry
janitor), then calls `Engine.Restore`. That lists every stored instance, deletes
rows already past `expires_at`, and binds a listener for each survivor — logging
and continuing past any bind failure so one bad port does not strand the rest.
Only then does it start the reachability prober, the control-channel HTTP server,
and (if `PROXTREE_CONTROL_PLANE_URL` is set) the heartbeat client.

The effect: **a node reboot serves customers again without contacting the control
plane.** Listeners come up from the local database with the port, IP, credentials
and expiry the control plane last pushed.

While the control plane is unreachable, everything below keeps working: serving
existing instances (listeners and handlers are local), credential enforcement
(compared against the local SQLite row), `max_conns` / `new_conn_rate` (the accept
loop), expiry (janitor plus gate check, no round trip), boot restore after a
reboot (desired set on local disk), the agent's own `/v1/health`, `/v1/status` and
`/v1/metrics`, and reachability probing (results wait in memory until heartbeats
resume). The heartbeat client retries with exponential backoff from
`PROXTREE_HEARTBEAT_INTERVAL` (default 15 s) up to a 2-minute cap, and logs a
recovery line when the control plane returns. Anything needing new state stops:
provisioning, suspend/resume/extend/delete, credential reset and rotation are
control-plane operations, and the inventory lives there.

## Reachability probing

Being assigned to an interface is necessary but **not sufficient**. A provider
can fail to route an address to the server: the kernel still accepts the bind,
the listener still accepts connections, and every outbound dial from that address
silently dies — a proxy that looks alive and passes nothing, sold to a customer
who paid for it. The prober (`agent/internal/health`) verifies reachability
instead of assuming it, by opening a TCP connection with the candidate address as
the **source**:

```go
// agent/internal/health/prober.go
dialer := net.Dialer{LocalAddr: &net.TCPAddr{IP: parsed}, Timeout: p.timeout}
conn, err := dialer.DialContext(ctx, "tcp", p.target)
```

The default target is `1.1.1.1:53` (`PROXTREE_PROBE_TARGET`), re-checked every
60 s (`PROXTREE_PROBE_INTERVAL`) with a 4-second per-dial timeout, and the first
round runs immediately at startup. Port 53 answers on nearly every network, which
is why it is the default: the probe asks "can this address reach the internet",
not "is this host up".

**What gets probed.** The union of the control plane's registered inventory for
the node (sent with every sync as `probe_ips`) and any IP an instance currently
serves (`ProbeTargetIPs`). Including the inventory — not just addresses in use —
is what lets an address be verified *before* it can be sold. Results for IPs no
longer in the probed set are dropped.

**How results surface.** Each is a `{ip, reachable, checked_at, error}` record,
exposed as a map keyed by address:

- `GET /v1/status` returns `ip_health` (the map) and `unreachable_ips`.
- Every heartbeat carries the same `ip_health` map; the control plane stores it
  as `nodes.ip_health` (jsonb).
- The control plane uses it as a hard eligibility gate: an IP not reported
  reachable is excluded from `free_slots` / `free_bundles`, returned in
  `unreachable_ips`, shown in the admin Nodes page, and named in an availability
  or provisioning `hint`.
- Failures are logged on transition only — reachable to unreachable — so an
  unroutable address does not repeat the same warning every minute:

```text
level=WARN msg="instance IP cannot reach the network; it will not be sold" ip=... target=1.1.1.1:53 error=...
```

**Why an unreachable address must never be sold.** The control plane's
allocatability predicate requires both gates: the agent reported the address in
`bound_ips`, *and* the prober did not find it unreachable. Both fail open when a
node has never reported, so a fresh install keeps working while an unreachable
address can never reach a customer. Selling one produces the worst support ticket
there is: the proxy connects, the credentials are right, and no request ever
succeeds.

## Metrics

`GET /v1/metrics` renders a snapshot of every running instance. The format comes
from `?format=`:

| Query | Format | Content type |
|---|---|---|
| (none) or `?format=prometheus` | Prometheus text exposition | `text/plain; version=0.0.4` |
| `?format=json` | JSON object | `application/json` |
| `?format=influx` | InfluxDB line protocol | `text/plain` |

The same five series exist in every format, per instance:

| Series | Type | Meaning |
|---|---|---|
| `bytes_in_total` | counter | Bytes received from clients (upload direction) |
| `bytes_out_total` | counter | Bytes sent to clients (download direction) |
| `active_conns` | gauge | Currently open client connections |
| `conns_total` | counter | Total accepted connections since the listener started |
| `uptime_seconds` | gauge | Seconds since the listener was created |
```text
# HELP active_conns Currently open client connections.
# TYPE active_conns gauge
active_conns{instance_id="9c2f...",port="10431",ip="198.51.100.7"} 3
```

**JSON.**

```json
{"instances":[{"instance_id":"9c2f...","port":10431,"ip":"198.51.100.7","bytes_in_total":1048576,"bytes_out_total":8388608,"active_conns":3,"conns_total":412,"uptime_seconds":86400}]}
```

**Influx line protocol.** One line per instance, measurement `proxtree`,
timestamped at scrape time, with `instance_id`, `port` and `ip` as tags:

```text
proxtree,instance_id=9c2f...,port=10431,ip=198.51.100.7 bytes_in_total=1048576i,bytes_out_total=8388608i,active_conns=3i,conns_total=412i,uptime_seconds=86400i 1758800000000000000
```

Every control-channel endpoint requires the node bearer token, so a scrape job
must send `Authorization: Bearer <node token>`. The path is configurable with
`PROXTREE_METRICS_PATH` (default `/v1/metrics`).

[Installation →](../getting-started/installation) · [Provisioning →](./provisioning) · [API reference →](../user-guide/api)
