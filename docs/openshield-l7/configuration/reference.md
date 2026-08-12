---
title: Configuration Reference — OpenShield-L7
description: Every OpenShield-L7 config value — YAML path, type, default, semantics, when to change it, and common mistakes. Global config.yaml and per-site files.
outline: deep
---

# Configuration Reference

Every config value in OpenShield-L7, with its YAML path, type, default, and semantics. Field names are exact `snake_case` names from the config model (`crates/osc-core/src/config.rs`); defaults on this page match that source.

## File layout & parser rules

OpenShield-L7 reads configuration from a project root directory (`--root`, default `.`):

```text
<root>/config.yaml          -> global config (one file)
<root>/sites.d/<name>.yaml  -> site config  (one file per proxied site)
<root>/data/                -> runtime state (quota counters, snapshots)
```

- **Every field is optional at the parser level** — defaults below fill in. A site file with only `hostnames` + `origin.url` is valid.
- **Unknown fields are ignored** (forward compatibility — safe binary downgrades).
- Validation checks semantics and collects **all** problems into one error list instead of failing on the first. Run `openshield-l7 validate` to check every file without starting the proxy.
- Both file types hot-reload; see [Hot Reload](../user-guide/hot-reload.md).

---

## 1. Global config (`config.yaml`)

### Top level

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `listen_http` | list of `ip:port` | `["0.0.0.0:80"]` | Addresses that terminate cleartext HTTP. All are hostname-routed. |
| `listen_https` | list of `ip:port` | `["0.0.0.0:443"]` | Addresses that terminate TLS. SNI-routed to per-site certificates. |
| `admin` | map | see below | Admin API listener and tokens. |
| `data_dir` | string | `"data"` | Directory for runtime state (quota counters, challenge secret, snapshots). Relative to `--root` unless absolute. |
| `sites_dir` | string | `"sites.d"` | Directory holding one `<site>.yaml` per proxied site. Relative to `--root` unless absolute. |
| `global_acl` | map | empty | IP lists evaluated **before any per-site logic**. See [ACL semantics](#_4-acl-semantics). |
| `events` | map | see below | Telemetry bus tuning. |
| `log_level` | string | `"info"` | Log verbosity: `error` / `warn` / `info` / `debug` / `trace`. |

**When to change:** `listen_http`/`listen_https` when running behind another terminator or on non-standard ports; `data_dir`/`sites_dir` to relocate state; `log_level` to `debug` when diagnosing.

**Common mistakes:**

- Listen and directory changes apply to **new connections / next restart** — hot reload picks up the file but does not rebind sockets or move directories. Restart the process for those.
- `RUST_LOG` overrides `log_level` — if the env var is set, the config value is ignored.
- Privileged ports (80/443) need root or `CAP_NET_BIND_SERVICE`; validation passes regardless — the failure appears at bind time.

```yaml
listen_http:
  - "0.0.0.0:80"
listen_https:
  - "0.0.0.0:443"
data_dir: "data"
sites_dir: "sites.d"
log_level: "info"
```

### `admin`

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `admin.listen` | `ip:port` | `"127.0.0.1:9090"` | Bind address for the admin API. Keep it on loopback unless you know why not. |
| `admin.tokens` | list of token maps | `[]` | **At least one token is required.** |
| `admin.allow_hosts` | list of strings | `[]` | If non-empty, the admin API additionally requires the request's `Host` header to be in this list (defense in depth when the API is exposed beyond loopback). Checked before token auth. |

Each token entry:

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `admin.tokens[].name` | string | — | Free-form label (used in logs, never the secret). |
| `admin.tokens[].token` | string | — | The bearer secret. **Minimum 16 characters.** |
| `admin.tokens[].role` | enum | `operator` | `admin` = full control incl. global config/tokens; `operator` = manage sites/bans/reload; `readonly` = GET endpoints only. |

**When to change:** add a `readonly` token for dashboards; set `allow_hosts` if you must bind the API beyond loopback (prefer an SSH tunnel instead).

**Common mistakes:** shipping a token under 16 chars (validation fails); exposing the API on a public interface without `allow_hosts`; storing tokens in browser `localStorage` for a dashboard (XSS-readable — keep them server-side).

```yaml
admin:
  listen: "127.0.0.1:9090"
  allow_hosts: ["127.0.0.1:9090", "localhost:9090"]
  tokens:
    - name: root
      token: "9f2c1f7e-38c4-4c1e-9b2a-7d5e6a01c3f2"
      role: admin
    - name: dashboard
      token: "b74d0e55-1aa2-4f0e-8c9d-2e6f7b48d5aa"
      role: readonly
```

Generate tokens with `openshield-l7 gen-token --name <n>` — it prints the token plus a paste-ready YAML snippet. Tokens are re-read from the **live** config on every request, so rotation (via `PUT /api/v1/global` or a file edit) is instant for new requests.

### `global_acl`

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `global_acl.blacklist` | list of IP/CIDR | `[]` | Dropped before any site logic runs. |
| `global_acl.whitelist` | list of IP/CIDR | `[]` | If non-empty, **only** these ranges may pass. Wins over blacklist. |

Entries parse as CIDR (`"10.0.0.0/8"`) or plain IP (becomes `/32` or `/128`). IPv4 and IPv6 both work. See [ACL semantics](#_4-acl-semantics).

**When to change:** permanent infrastructure blocks (known-bad ranges), or a whitelist-only stance for an internal-only proxy.

**Common mistake:** setting a whitelist and locking yourself out — a non-empty whitelist denies *everything* else, including your own admin traffic through the proxy ports.

```yaml
global_acl:
  blacklist:
    - "203.0.113.0/24"
    - "198.51.100.7"
  whitelist: []          # e.g. ["10.0.0.0/8"] for an internal-only proxy
```

### `events`

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `events.channel_capacity` | int | `65536` | Broadcast channel capacity for the telemetry bus. Minimum `64`. Under congestion events are **dropped (and counted)** rather than blocking the data plane. |
| `events.recent_buffer` | int | `10000` | Per-site ring buffer of recent request events, backing `/api/v1/events/recent` and analytics. |
| `events.aggregate_retention_hours` | int | `168` (7 days) | Retention of the per-minute aggregate series (rps / bandwidth). Older data is gone — export to a TSDB if you need more. |

**When to change:** raise `recent_buffer` on busy sites whose analytics need deeper lookback; lower on RAM-tight boxes. Raise `channel_capacity` if you see dropped-event counts on a loaded SSE consumer.

**Common mistake:** treating SSE/events as an audit log — the bus is lossy under congestion by design.

```yaml
events:
  channel_capacity: 65536
  recent_buffer: 10000
  aggregate_retention_hours: 168
```

---

## 2. Site config (`sites.d/<name>.yaml`)

One file per proxied site. A site is a hostname set pointing at **one destination web server** — the proxy never hosts content itself.

### Top level

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `id` | string | `""` | Stable identifier used in API paths and metrics. Must match `[A-Za-z0-9._-]{1,64}` when set (it lands in file names and API paths). Leave empty in a new file: the loader assigns one and **rewrites the file** with it. |
| `enabled` | bool | `true` | Disabled sites keep their config file but do not proxy — requests get a 503 page (unknown hosts get 421). Toggle via API without deleting the file. |
| `hostnames` | list of strings | `[]` | **Required, at least one.** See [hostname semantics](#_3-hostname-semantics). |
| `origin` | map | — | Destination web server. |
| `tls` | map | disabled | HTTPS for this site. |
| `client_ip` | map | see below | How the real client IP is resolved and conveyed. |
| `protection` | map | see below | ACL, limits, WAF, challenge, bot, auto-mitigation. |
| `bandwidth` | map | see below | Monthly quota + speed caps. |

### `origin`

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `origin.url` | string | `""` | Absolute URL of the destination, e.g. `"http://10.0.0.5:8080"`. Scheme must be `http` or `https`; **no path and no userinfo (`user:pass@`) allowed**. **Required.** |
| `origin.host_header` | string or null | `null` | Host header sent to the origin. Default: the original client `Host`. Set e.g. `"localhost"` when the origin vhosts differently. |
| `origin.connect_timeout_ms` | int (ms) | `5000` | Upstream TCP connect timeout. |
| `origin.read_timeout_ms` | int (ms) | `30000` | Upstream read timeout. |
| `origin.keepalive_secs` | int (s) | `75` | Idle keep-alive lifetime for pooled upstream connections. |
| `origin.max_idle_per_host` | int | `32` | Max pooled idle upstream connections per site. |

Origin failures produce `502` with backoff; the proxy never panics on upstream garbage.

**When to change:** `host_header` for origins that vhost on a different name; raise `read_timeout_ms` for slow backends (long reports, uploads); `max_idle_per_host` for high-RPS sites to deepen the keep-alive pool.

**Common mistakes:** a path in `origin.url` (`http://host:8080/app` is rejected — the proxy forwards the client's path as-is); userinfo in the URL (rejected); forgetting to [lock down the origin's bind](../getting-started/installation.md#verify-the-install) so attackers can bypass the proxy entirely.

```yaml
origin:
  url: "http://10.0.0.5:8080"
  host_header: null
  connect_timeout_ms: 5000
  read_timeout_ms: 30000
  keepalive_secs: 75
  max_idle_per_host: 32
```

### `tls`

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `tls.enabled` | bool | `false` | Serve HTTPS for this site's hostnames using these certs (SNI-routed). Hosts without TLS config never get a certificate. |
| `tls.cert_path` | string | `""` | PEM certificate chain. Must exist at load time when enabled. |
| `tls.key_path` | string | `""` | PEM private key. Must exist at load time when enabled. |
| `tls.redirect_http_to_https` | bool | `true` | Cleartext requests for this site get `308` → `https://`. The Location keeps an explicit non-default port from the request's Host header (`host:8443` → `https://host:8443/...`); default ports (80/443) are dropped. |
| `tls.hsts_max_age` | int or null | `null` | If set, emit `Strict-Transport-Security: max-age=<n>` on HTTPS responses. |

**When to change:** enable per site as certs become available; set `hsts_max_age` (e.g. `15552000` = 180 days) only after HTTPS is proven working — HSTS is sticky.

**Common mistakes:** enabling with missing/typo'd cert paths (that site's validation fails; it never serves); setting `redirect_http_to_https: false` and wondering why cleartext works; unknown SNI aborts the handshake **by design** — there is no default cert.

Cert renewal: write the new files, then touch the site file (the watcher re-reads it) or `POST /api/v1/reload`. New TLS connections pick up the new cert — no restart. The SNI cert map is also rebuilt on an hourly timer, so out-of-band rotation goes live within an hour even with no reload at all.

```yaml
tls:
  enabled: true
  cert_path: "/etc/openshield-l7/certs/example.com/fullchain.pem"
  key_path: "/etc/openshield-l7/certs/example.com/privkey.pem"
  redirect_http_to_https: true
  hsts_max_age: 15552000
```

For local testing, `openshield-l7 gen-cert --host example.com --out ./certs/example.com` writes a self-signed pair — never for production.

### `client_ip`

Two halves: how the proxy *resolves* the real client IP (`trusted_proxies`), and how the *origin* learns it (`forward_mode` / `custom_header` / `transparent` / `proxy_protocol`).

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `client_ip.trusted_proxies` | list of IP/CIDR | `[]` | Peers whose `X-Forwarded-For` we trust (Cloudflare ranges, your CDN). Direct connections from untrusted peers have their inbound XFF **ignored entirely** — it is attacker-controlled. |
| `client_ip.forward_mode` | enum | `x_forwarded_for` | How to inform the origin about the client IP: `none`, `x_forwarded_for`, `x_real_ip`, `forwarded`, `custom`. See the [forward modes table](#forward-modes-what-the-origin-sees). |
| `client_ip.custom_header` | string or null | `null` | Header name used when `forward_mode: custom`. Required (non-empty) in that mode — validation fails otherwise. |
| `client_ip.transparent` | bool | `false` | Linux `IP_TRANSPARENT`: source the upstream connection **from the resolved client IP**. The origin sees the client directly — no headers, no PROXY protocol, zero origin config. Requires root/`CAP_NET_ADMIN` + policy routing; degrades gracefully to normal egress with a loud warning if privileges are missing. **IPv4-only** (IPv6 clients use normal egress). Full guide: [Transparent Client IP](../architecture/transparent-ip.md). |
| `client_ip.proxy_protocol` | enum | `off` | Prepend an HAProxy PROXY protocol header to each upstream connection: `off`, `v1` (text), or `v2` (binary). The origin must be configured to expect it. The advertised source is the trusted-proxy-**resolved** client IP (port `0` = unknown when the peer is a trusted proxy). |

**Resolution algorithm (trusted-proxy aware):** if the direct TCP peer is not in `trusted_proxies`, the client IP is the peer, full stop. If the peer is trusted, the XFF chain is walked **right-to-left**, skipping trusted hops; the first untrusted address is the client. If the whole chain is trusted, the **rightmost** parseable XFF entry wins (the least forgeable hop — appended by the trusted proxy closest to us; the leftmost entry is client-supplied verbatim), then `X-Real-Ip`, then the peer.

The resolved client IP — not the peer — is what ACLs, rate limits, bans, telemetry, transparent mode, and the PROXY-protocol source address use.

#### Forward modes: what the origin sees

Assume the resolved client IP is `203.0.113.9`, the client sent `X-Forwarded-For: 198.51.100.1` inbound, and the origin is nginx.

| `forward_mode` | Headers sent to origin | What nginx sees |
|---|---|---|
| `none` | `X-Forwarded-For`, `X-Real-Ip`, and `Forwarded` are **stripped entirely** | `$remote_addr` = the proxy's IP; no client-identifying headers at all. |
| `x_forwarded_for` (default) | `X-Forwarded-For: <inbound chain>, 203.0.113.9` (client IP appended; header created if absent) | Standard chain; nginx `$remote_addr` = proxy IP, realip module / logs pick the client from XFF. |
| `x_real_ip` | `X-Real-Ip: 203.0.113.9` | nginx `set_real_ip_from` + `real_ip_header X-Real-Ip;` restores the client IP. |
| `forwarded` | `Forwarded: for=203.0.113.9` | RFC 7239 header; origins parsing `Forwarded` see the client. |
| `custom` | `<custom_header>: 203.0.113.9` | Whatever your origin expects, e.g. `CF-Connecting-IP: 203.0.113.9`. |

**When to change:** match your origin's existing realip config; use `none` for maximum hygiene on origins that must not trust headers; `transparent` when you control the network path and want socket-level truth.

**Common mistakes:** trusting XFF without populating `trusted_proxies` (the inbound chain is ignored — correct — but operators then misread telemetry); enabling `proxy_protocol` against an origin that doesn't expect it (**every request fails** — the preamble precedes all request bytes); enabling `transparent` without the routing setup (site serves 502s — there is no auto-detection for a blackholed return path).

```yaml
client_ip:
  trusted_proxies:
    - "173.245.48.0/20"     # Cloudflare ...
    - "103.21.244.0/22"
  forward_mode: x_forwarded_for
  transparent: false
  proxy_protocol: off
```

Notes:

- `transparent: true` makes `forward_mode` and `proxy_protocol` redundant for IP visibility (the origin's socket table itself shows the client); combine it with `forward_mode: none` for the cleanest wire. They don't conflict if left on — just redundant.
- `proxy_protocol` applies on every upstream connect, before any request bytes.

### `protection`

Inspectors run in a fixed order per request — **ban check + IP ACL → connection limits → rate limits → WAF/bot rules** — cheap stateless drops first; first non-`Allow` verdict wins.

```yaml
protection:
  acl: {}              # per-site blacklist/whitelist
  rate_limit: {}       # request windows + ban escalation
  connections: {}      # concurrent in-flight caps
  request_limits: {}   # request shape enforcement
  waf: {}              # content/bot rules + custom_rules
  challenge: {}        # JS proof-of-work
  bot: {}              # scoring bands
  auto_mitigation: {}  # RPS-triggered tightening
```

#### `protection.acl`

Same shape as `global_acl`, evaluated after it (after the ban check):

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `protection.acl.blacklist` | list of IP/CIDR | `[]` | Blocked on this site. |
| `protection.acl.whitelist` | list of IP/CIDR | `[]` | If non-empty, only these ranges may use this site. Wins over blacklist. |

**When to change:** per-site lockdown (an admin panel host behind an office CIDR whitelist) without affecting other sites.

#### `protection.rate_limit`

Sliding-window request limits. Both windows are enforced; either tripping counts as a violation.

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `protection.rate_limit.enabled` | bool | `true` | Master toggle. |
| `protection.rate_limit.per_ip.requests` | int | `300` | Requests allowed per client IP per window. |
| `protection.rate_limit.per_ip.window_secs` | int | `60` | Per-IP window length. Must be > 0. |
| `protection.rate_limit.per_site.requests` | int | `5000` | Requests allowed for the whole site per window. |
| `protection.rate_limit.per_site.window_secs` | int | `10` | Per-site window length. Must be > 0. |
| `protection.rate_limit.action` | enum | `block` | `block` = 429 (403 for repeat hits); `challenge` = JS proof-of-work page instead (only honored when `challenge.mode` is not `off`; otherwise downgraded to 429). |
| `protection.rate_limit.ban_after_violations` | int | `0` | After this many violations inside one window, temp-ban the IP. `0` = never ban. Repeat offenders double the ban duration, capped at 24h. |
| `protection.rate_limit.ban_duration_secs` | int | `600` | Base ban length. |

**When to change:** tighten `per_ip` for login/API endpoints; enable `ban_after_violations` (e.g. `5`) once you're confident limits don't false-trip legit bursty users; use `action: challenge` to sift browsers from scripts instead of hard-blocking.

**Common mistakes:** setting `action: challenge` while `challenge.mode: off` (silently downgrades to 429); forgetting that the per-site window default is only 10s (5000/10s ≈ 500 rps sustained); window of `0` fails validation.

```yaml
protection:
  rate_limit:
    enabled: true
    per_ip:   { requests: 300,  window_secs: 60 }
    per_site: { requests: 5000, window_secs: 10 }
    action: block
    ban_after_violations: 5
    ban_duration_secs: 600
```

#### `protection.connections`

Concurrent in-flight request caps (not per-window).

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `protection.connections.per_ip` | int | `0` | Max concurrent in-flight requests per client IP. `0` = unlimited. |
| `protection.connections.per_site` | int | `0` | Max concurrent in-flight requests for the site. `0` = unlimited. |

**When to change:** set `per_ip` (e.g. `20`) to blunt connection-holding attacks and download managers hogging workers; `per_site` as a hard ceiling for a fragile origin.

**Common mistake:** confusing these with rate windows — a client under its req/s limit can still trip the concurrent cap with slow parallel requests. Over-limit verdicts carry rule id `conn.per_ip` / `conn.per_site`.

#### `protection.request_limits`

Request shape enforcement, before any content rules.

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `protection.request_limits.max_uri_bytes` | int | `8192` | Longer request targets are rejected. |
| `protection.request_limits.max_header_bytes` | int | `32768` | Total header section cap. |
| `protection.request_limits.max_body_bytes` | int | `16777216` (16 MiB) | Larger request bodies are rejected (`413`). Chunked bodies are cut off mid-stream once the cap streams past. |
| `protection.request_limits.body_inspect_bytes` | int | `65536` | How much of a request body the WAF buffers for inspection at most. Bodies are only buffered when `waf.inspect_body` is on and the content type is text-like. |
| `protection.request_limits.allowed_methods` | list of strings | `["GET","HEAD","POST","PUT","PATCH","DELETE","OPTIONS"]` | Uppercase method names. Anything else gets `405`. |
| `protection.request_limits.blocked_path_prefixes` | list of strings | `[]` | Path prefixes that are always blocked, e.g. `"/internal"`. |

**When to change:** shrink all caps for a paranoia profile; raise `max_body_bytes` for upload endpoints; add `/.git`, `/wp-admin` style prefixes on sites that never serve them.

**Common mistake:** lowering `max_body_bytes` below what a legit form/upload posts — rejections are early `413`s, visible in telemetry as such.

```yaml
protection:
  request_limits:
    max_uri_bytes: 8192
    max_header_bytes: 32768
    max_body_bytes: 16777216
    body_inspect_bytes: 65536
    allowed_methods: ["GET", "HEAD", "POST"]
    blocked_path_prefixes: ["/internal", "/debug"]
```

#### `protection.waf`

Content and bot inspection. Each toggle is one rule family; hits are recorded in telemetry by rule id (`sqli`, `xss`, `path_traversal`, `rce`, `scanner`, `bot`, `request.method`, `request.uri_len`, `request.path_blocked`, or your custom rule id).

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `protection.waf.sqli` | bool | `true` | SQL-injection pattern set over URI, query, and inspected body. |
| `protection.waf.xss` | bool | `true` | Cross-site scripting pattern set. |
| `protection.waf.path_traversal` | bool | `true` | `../` / encoded traversal pattern set. |
| `protection.waf.rce` | bool | `true` | Command-injection / RCE pattern set. |
| `protection.waf.scanner_block` | bool | `true` | Block known scanner/bad-bot user agents (sqlmap, nikto, masscan, ...). Rule id `scanner`. |
| `protection.waf.bad_bot` | bool | `true` | Heuristic bot scoring (header coherence, automation markers). Bands in `protection.bot`. |
| `protection.waf.inspect_body` | bool | `true` | Also inspect size-capped urlencoded/text bodies, not just the URI. |
| `protection.waf.custom_rules` | list of rule maps | `[]` | Your own regex rules. See below. |

All pattern matching is case-insensitive, applied to **percent-decoded input (decoded once)**, and uses the linear-time `regex` crate — no catastrophic backtracking on adversarial input. Known gap: double-encoded SQLi/XSS payloads evade the content rules (the decode-once design; see [Testing](../architecture/testing.md)).

Each custom rule:

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `…custom_rules[].id` | string | — | Rule id; appears in `rule_hits` telemetry. Required. |
| `…custom_rules[].name` | string | — | Human label. Required. |
| `…custom_rules[].enabled` | bool | `true` | Disabled rules are kept but skipped. |
| `…custom_rules[].target` | enum | — | What to match: `uri`, `query`, `body`, `user_agent`, `method`, or `!header "<name>"` for a named header's value. Required. |
| `…custom_rules[].pattern` | string | — | Regular expression, `regex` crate syntax (no backrefs/lookaround). Compiled once at load; an invalid regex fails validation of the whole file. Required. |
| `…custom_rules[].action` | enum | `block` | `block` = deny; `challenge` = PoW page (when challenge mode allows); `log` = allow the request but record the hit in telemetry. |

::: warning Target syntax
Unit targets are plain scalars (`target: uri`), but a header target carries a value, and YAML represents that as a **tag**: `target: !header "x-api-version"`. The JSON API uses the equivalent object form — `"target": {"header": "x-api-version"}` (exactly what `GET /sites/{id}` returns). Writing the map form (`target: {header: ...}`) in YAML is rejected by the parser.
:::

**When to change:** turn off a family that false-positives on your app (watch `rule_hits` first); add `log`-action custom rules to observe before you block.

**Common mistakes:** regex with backrefs/lookaround (fails validation — RE2-style syntax only); forgetting custom rules match decoded input; a bad regex anywhere in the file invalidates the whole file's reload (last good config keeps serving).

```yaml
protection:
  waf:
    sqli: true
    xss: true
    path_traversal: true
    rce: true
    scanner_block: true
    bad_bot: true
    inspect_body: true
    custom_rules:
      - id: no-curl
        name: Block curl user agents
        target: user_agent
        pattern: "(?i)^curl/"
        action: block
      - id: wp-login-foreign
        name: Watch wp-login POSTs
        target: uri
        pattern: "^/wp-login\\.php"
        action: log
      - id: api-version-gate
        name: Only API v2 on this host
        target: !header "x-api-version"
        pattern: "^1\\."
        action: block
```

#### `protection.challenge`

JS proof-of-work challenges with HMAC-signed clearance cookies. The server keeps **no** per-client state — everything is in the cookie.

Flow on a challenge verdict: the proxy serves a self-contained page with a fresh **self-authenticating seed** — 64 lowercase hex chars encoding `timestamp || random || HMAC tag`; the browser brute-forces a nonce such that `sha256(seed + nonce)` has `difficulty` leading zero hex nibbles, then POSTs `{seed, nonce}` to `/__osc_challenge/verify`. The verify endpoint rejects seeds the server never issued (HMAC mismatch) and seeds older than 10 minutes, so an offline solve can never mint clearance for an attacker-chosen seed. On success the client receives the clearance cookie `osc_clear` (HMAC-bound to site + client IP + expiry) and reloads; later requests skip challenges until expiry — including later `challenge`-action rule/limit verdicts.

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `protection.challenge.mode` | enum | `off` | `off` = never challenge (challenge verdicts degrade to blocks/429); `auto` = honor challenge verdicts from rules and limits (rate-limit action, bot score in the challenge band); `on` = challenge **every** request without a valid clearance cookie (the verify path excepted). |
| `protection.challenge.difficulty` | int | `4` | Leading zero hex nibbles required by the PoW. Each +1 multiplies expected work by 16. Effectively capped at 16. |
| `protection.challenge.ttl_secs` | int | `1800` | Clearance cookie lifetime. |

**When to change:** `auto` for most public sites; `on` for under-attack or extremely sensitive hosts; difficulty `5`–`6` during a flood (each step costs the client 16× more, you nothing).

**Common mistakes:** `mode: on` in front of APIs consumed by non-browser clients (they can't solve JS — they'll get 403s); expecting challenges while `mode: off`; very high difficulty locking out mobile devices.

The HMAC secret persists at `data/challenge.secret` (mode `0600`), so clearance cookies survive restarts. Delete it and every outstanding clearance is invalidated.

#### `protection.bot`

Heuristic bot scoring — additive weak signals (header presence/coherence, automation markers), so no single forged header clears or trips the detector. Runs when `protection.waf.bad_bot` is on.

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `protection.bot.enabled` | bool | `true` | Master toggle for scoring. |
| `protection.bot.challenge_score` | int (0–100) | `50` | Score ≥ this → JS challenge (when `challenge.mode` allows). |
| `protection.bot.block_score` | int (0–100) | `80` | Score ≥ this → hard block. |
| `protection.bot.allow_good_bots` | bool | `true` | Let verified-good crawler UAs (googlebot, bingbot) skip bot rules. **UA-match only — spoofable.** Pair with `trusted_proxies` + external PTR verification if you rely on it. |

**When to change:** widen the gap (`challenge_score: 40`, `block_score: 85`) to challenge more and block less; disable `allow_good_bots` on sites that should have no crawler traffic.

**Common mistake:** setting `challenge_score ≥ block_score` — the challenge band vanishes and everything suspicious eats a hard block.

#### `protection.auto_mitigation`

When a site's RPS crosses the threshold, all of that site's rate limits are multiplied by `factor` (i.e. tightened) for `duration_secs`, renewed while the flood continues. `mitigation` events fire on enter/exit, and `SiteStats.mitigation_active` reflects the state.

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `protection.auto_mitigation.enabled` | bool | `true` | Master toggle. |
| `protection.auto_mitigation.threshold_rps` | float | `800.0` | Site requests/sec that triggers mitigation. |
| `protection.auto_mitigation.duration_secs` | int | `300` | How long tightened limits stay on once triggered (renewed while hot). |
| `protection.auto_mitigation.factor` | float | `0.25` | Multiplier applied to rate limits while mitigating. `0.25` = limits at 25% of normal. |

**When to change:** lower `threshold_rps` on small origins; lower `factor` (e.g. `0.1`) when floods must be strangled harder.

**Common mistake:** a `threshold_rps` below your legit traffic peaks — the site will live in permanent mitigation. Watch `mitigation` events after tuning.

### `bandwidth`

| YAML path | Type | Default | Semantics |
|---|---|---|---|
| `bandwidth.monthly_quota_bytes` | int or null | `null` | Total bytes (up + down) the site may move per calendar month. `null` = unlimited. Counters persist under `data_dir/quotas/` (atomic tmp+rename) and reset on `quota_reset_day`. |
| `bandwidth.quota_action` | enum | `error_page` | What over-quota traffic gets: `error_page` = status 509 "Bandwidth Limit Exceeded"; `close` = the connection is closed without a response. |
| `bandwidth.quota_reset_day` | int or null | `null` → `1` | Day of month the quota window resets. Valid range **1–28** (safe in every month); other values fail validation. |
| `bandwidth.max_site_bps` | int or null | `null` | Sustained send-rate cap for the whole site, bytes/sec (token bucket shared by all connections). `null` = off. |
| `bandwidth.max_ip_bps` | int or null | `null` | Sustained send-rate cap per client IP, bytes/sec. `null` = off. |

Crossing the quota fires a `quota_exceeded` event once per window and sets `quota_used_bytes` / `quota_limit_bytes` / `quota_reset_at` in the site's stats. Speed caps throttle the response stream; they don't reject requests.

**When to change:** quotas for hosting-style "X GB/month" plans; `max_ip_bps` so one client can't saturate a download host.

**Common mistakes:** forgetting quotas count **both directions**; `quota_reset_day: 31` fails validation; expecting speed caps to affect request *rate* — they shape bytes, not rps.

```yaml
bandwidth:
  monthly_quota_bytes: 1099511627776    # 1 TiB
  quota_action: error_page
  quota_reset_day: 1
  max_site_bps: 52428800                # 50 MiB/s site-wide
  max_ip_bps: 2097152                   # 2 MiB/s per client
```

---

## 3. Hostname semantics

- Case-insensitive; a port suffix (`example.com:8080`) and a trailing dot are stripped before matching. IPv6 literals are not routed.
- Exact hostnames match first.
- `*.example.com` is a **suffix wildcard**: it matches `a.example.com` *and* `a.b.example.com` (any depth). The bare domain `example.com` is **not** matched — list it explicitly.
- Overlapping wildcards: the longest suffix wins, so `*.a.example.com` beats `*.example.com`.
- No hostname matches at all → `421` (no site context — bare-IP scanners land here).
- Two **enabled** sites claiming the same hostname are rejected: the first file (sorted order) wins, the second is logged and skipped; through the API the write fails with a conflict naming the other site. A disabled site's hostnames don't claim anything.

## 4. ACL semantics

Applies identically to `global_acl` and `protection.acl`:

1. The **resolved client IP** is tested (trusted-proxy aware, see `client_ip`), never the raw peer.
2. Whitelist wins over blacklist: an IP present in both is allowed.
3. If the whitelist is non-empty, **only** whitelisted ranges are allowed — everything else is denied.
4. `global_acl` runs before any per-site logic; `protection.acl` runs per site, after the ban check.

---

## 5. Full example site files

### Minimal — `sites.d/minimal.yaml`

```yaml
hostnames:
  - minimal.example.com
origin:
  url: "http://127.0.0.1:8080"
```

Everything else defaults: WAF on, per-IP 300 req/60s, per-site 5000 req/10s, `x_forwarded_for` to the origin, no TLS, no quotas.

### Typical — `sites.d/typical.yaml`

TLS, tighter rate limits with auto-ban, Cloudflare in front.

```yaml
hostnames:
  - www.example.com
  - example.com
origin:
  url: "http://10.0.0.5:8080"
  connect_timeout_ms: 4000
  read_timeout_ms: 20000
tls:
  enabled: true
  cert_path: "/etc/openshield-l7/certs/example.com/fullchain.pem"
  key_path: "/etc/openshield-l7/certs/example.com/privkey.pem"
  redirect_http_to_https: true
  hsts_max_age: 15552000
client_ip:
  trusted_proxies:
    - "173.245.48.0/20"
    - "103.21.244.0/22"
    - "103.22.200.0/22"
    - "103.31.4.0/22"
  forward_mode: x_forwarded_for
protection:
  acl:
    blacklist:
      - "203.0.113.0/24"
  rate_limit:
    enabled: true
    per_ip:   { requests: 200,  window_secs: 60 }
    per_site: { requests: 4000, window_secs: 10 }
    action: block
    ban_after_violations: 5
    ban_duration_secs: 900
  connections:
    per_ip: 20
    per_site: 0
  waf:
    sqli: true
    xss: true
    path_traversal: true
    rce: true
    scanner_block: true
    bad_bot: true
    inspect_body: true
  challenge:
    mode: auto
    difficulty: 4
    ttl_secs: 1800
  bot:
    enabled: true
    challenge_score: 50
    block_score: 85
    allow_good_bots: true
  auto_mitigation:
    enabled: true
    threshold_rps: 600
    duration_secs: 300
    factor: 0.25
```

### Paranoia — `sites.d/paranoia.yaml`

Challenge everything, strict shapes, small windows, monthly quota with speed caps.

```yaml
hostnames:
  - internal.example.com
origin:
  url: "http://127.0.0.1:9000"
  host_header: "localhost"
  connect_timeout_ms: 2000
  read_timeout_ms: 10000
tls:
  enabled: true
  cert_path: "/etc/openshield-l7/certs/internal/fullchain.pem"
  key_path: "/etc/openshield-l7/certs/internal/privkey.pem"
  redirect_http_to_https: true
  hsts_max_age: 31536000
client_ip:
  trusted_proxies: []
  forward_mode: none
protection:
  rate_limit:
    enabled: true
    per_ip:   { requests: 60,   window_secs: 60 }
    per_site: { requests: 1000, window_secs: 10 }
    action: challenge
    ban_after_violations: 3
    ban_duration_secs: 1800
  connections:
    per_ip: 5
    per_site: 500
  request_limits:
    max_uri_bytes: 2048
    max_header_bytes: 8192
    max_body_bytes: 1048576
    body_inspect_bytes: 16384
    allowed_methods: ["GET", "HEAD", "POST"]
    blocked_path_prefixes: ["/internal", "/.git", "/wp-admin"]
  waf:
    sqli: true
    xss: true
    path_traversal: true
    rce: true
    scanner_block: true
    bad_bot: true
    inspect_body: true
    custom_rules:
      - id: no-empty-ua
        name: Block empty user agents
        target: user_agent
        pattern: "^$"
        action: block
  challenge:
    mode: on
    difficulty: 5
    ttl_secs: 900
  bot:
    enabled: true
    challenge_score: 40
    block_score: 70
    allow_good_bots: false
  auto_mitigation:
    enabled: true
    threshold_rps: 200
    duration_secs: 600
    factor: 0.1
bandwidth:
  monthly_quota_bytes: 1099511627776    # 1 TiB
  quota_action: error_page
  quota_reset_day: 1
  max_site_bps: 52428800                # 50 MiB/s site-wide
  max_ip_bps: 2097152                   # 2 MiB/s per client
```

---

## See also

- **[Hot Reload](../user-guide/hot-reload.md)** — how file edits and API writes apply, and how failures are isolated.
- **[Admin API](../user-guide/api.md)** — the same config model as JSON, endpoint by endpoint.
- **[Transparent Client IP](../architecture/transparent-ip.md)** — `client_ip.transparent` requirements and routing setups.
