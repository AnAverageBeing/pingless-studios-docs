---
title: Testing & Benchmarks — OpenShield-L7
description: The OpenShield-L7 test battery — 215 unit tests, 77 e2e assertions, 8 attack scenarios with measured results, and how to reproduce with testing/run_all.sh.
outline: deep
---

# Testing & Benchmarks

OpenShield-L7 ships with an automated battery that builds the release binary, spins up real proxy instances and test origins on temp roots, runs the full e2e assertion suite, then floods the proxy with six attack tools on both loopback and the LAN address. Everything below is measured output from `testing/run_all.sh` (`testing/RESULTS.md`, generated 2026-08-12).

## Layers

| Layer | Command | Coverage |
|---|---|---|
| Unit tests | `cargo test --workspace` | **215 tests** across the seven crates — config validation, challenge crypto, client-IP resolution, limiters, WAF families, API handlers. |
| Lint | `cargo clippy --workspace --all-targets` | Clippy-clean. |
| E2E + attacks | `testing/run_all.sh` | 77 e2e assertions + 8 attack scenarios against a running proxy. Needs root (the transparent-mode case); uses only high ports on loopback + the LAN address. Exits non-zero on any failure. |

---

## E2E battery: 77 / 77 passed

The battery covers the whole surface of the proxy. Grouped summary of the 77 assertions (all PASS):

| Area | Assertions | Highlights |
|---|---|---|
| Routing | 1–9, 55 | Exact + deep wildcard hosts, bare domain not matched by wildcard, unknown host / bare IP → 421, disabled site → 503, case/port/trailing-dot tolerance, API delete → 421. |
| TLS | 10–15 | HTTP→HTTPS 308 with path+query preserved, SNI per-site certs, HSTS header, unknown SNI aborts the handshake. |
| Client IP | 16–22 | XFF default mode, untrusted inbound XFF discarded, trusted proxy chain walked + peer appended, `none` strips all client headers, `x_real_ip`, custom header, `X-Forwarded-Proto` set. |
| WAF | 23–27, 67 | Canonical payloads blocked with rule ids, **zero false positives** on benign lookalikes, double-encoded traversal blocked, scanner UA blocked, SQLi in POST body blocked. |
| Rate / conn limits | 28–32, 62–63 | Per-IP limit trips at the configured count (429) and recovers after the window; conn gauges stay exact under early-413 floods; per-IP conn cap under held connections; gauges released after completion. Bans outrank everything (huge POST from a banned IP → 403 `ban`, not 413). |
| PoW challenge | 33–41 | No-cookie request gets the PoW page; wrong nonce → 403; solved PoW → 200 + clearance cookie; clearance passes until expiry; garbage cookie still challenged; **forged seed → 403 despite solved nonce**; stale (11 min) seed → 403. |
| Quotas & speed caps | 42–44 | Monthly quota → 509 after crossing; counters visible in stats; `max_site_bps` measured at the configured rate (400 KiB/s vs cap 400 KiB/s). |
| Admin API & roles | 45–57 | Health unauthenticated; missing/bad token → 401; readonly GET ok, POST → 403; operator `PUT /global` → 403; site CRUD incl. PATCH disable/enable; invalid site → 400 with full `details`; `/global` redacts tokens and a `"***"` round-trip preserves them. |
| Hot reload | 58–60 | Invalid edit leaves other sites unaffected and keeps the broken site's last good config; reload reports the broken file; the fixed file hot-applies. |
| Bans | 61–65 | Manual ban blocks one IP only; list + DELETE lifts it; DELETE of a nonexistent ban → 404. |
| Stats / analytics / SSE | 66–68 | Global counters match generated traffic; analytics tops plausible; SSE emits request events. |
| Protocol behavior | 69–73 | HTTP/1.1 keep-alive ×50; WebSocket upgrade pass-through; PROXY protocol v1 and v2 deliver the client endpoint; trusted XFF feeds the PROXY source (port 0 = unknown). |
| Transparent mode | 74–75 | Origin sees the real client IP (`10.255.255.7`) with **no XFF header at all**; trusted XFF resolves through to the bound source. |
| CLI & shutdown | 76–77 | `validate` reports all configs valid; graceful SIGTERM mid-download drains in a bounded 5 s and exits 0. |

---

## Attack simulation: 8 / 8 passed

Six attack tools against the running proxy, on loopback (`127.0.0.1:18080`) and the LAN address (`192.168.1.103:18080`), while benign traffic flows to a neighboring site.

| Attack | Target | Mitigation observed | Verdict |
|---|---|---|---|
| HTTP flood | loopback | **152,735 rps**, 918,247 requests → 100% 429; benign site 100% 200 (p95 2.3 ms); RSS 43 MB → 61 MB | PASS |
| HTTP flood | LAN | **144,576 rps**, 579,467 requests → 100% 429; benign 100% 200 (p95 2.4 ms) | PASS |
| Random-Host flood | loopback | **150,426 rps** → 100% 421; legitimate site's request count untouched | PASS |
| Random-Host flood | LAN | **137,801 rps** → 100% 421; legitimate site untouched | PASS |
| POST flood | loopback | Content-Length over cap → 413; chunked cut off after 1 MB streamed; sustained 25/25 413s; RSS growth 0.8 MB | PASS |
| Slowloris | loopback | 300 trickling connections held 12 s; benign 100% 200 (p95 1.5 ms); post-attack status 200 | PASS |
| WAF sweep | loopback | Canonical 100% (72/72), single-encoded 100%, double-encoded 35% (known gap), false positives 0/20 | PASS |
| XFF spoofing | loopback | Untrusted rotation: 10× 429 (limiter holds — spoofed XFF ignored); trusted rotation: 0× 429 (per-IP buckets); trusted single-IP: 5× 429; telemetry shows the resolved IP | PASS |

### Performance sanity (loopback, protections ON)

- Proxied throughput (Rust fast origin): **67,666 rps** — p50 0.66 ms, p99 1.88 ms, max 8 ms.
- 541,881 requests, **0 errors**, all `200`.
- Reference: the Python test origin alone caps at ~9,458 rps — it is the bottleneck in every python-origin measurement, not the proxy.

### Known limitations (documented, measured)

- **Slowloris-class trickling**: there is no header-read timeout; half-open connections are held indefinitely. Cost per connection is tiny (async runtime) and benign traffic is unaffected (verified above), but a header/read deadline would be cheap hardening.
- **Double-encoded SQLi/XSS evade the content rules**: the WAF percent-decodes once (documented design); only the path-traversal family treats leftover `%2e`/`%00` sequences as evasion markers — which is why double-encoded traversal still scores ~35% overall in the sweep.
- The Python test origin (`testing/origin.py`) caps ~9k rps; every python-origin number above is origin-bound, not proxy-bound.

---

## Reproduce

```bash
# unit tests + lint
cargo test --workspace
cargo clippy --workspace --all-targets

# the full battery (needs root; idempotent; fresh temp root each run)
sudo testing/run_all.sh
```

What `run_all.sh` does:

1. Builds the release binary plus two Rust harness tools (`testing/bin/perfclient`, `testing/bin/fastorigin`).
2. Prepares fresh config roots (`testing/prep_roots.py`) and starts test origins (`testing/origin.py`, HTTP and PROXY-protocol modes).
3. Runs the 77-assertion e2e suite (`testing/e2e.py`).
4. Starts an attack proxy on `0.0.0.0:18080` and fires the attack tools in `testing/attacks/` — `http_flood.py`, `random_host_flood.py`, `post_flood.py`, `slowloris.py`, `waf_sweep.py`, `xff_spoof.py` — on loopback and the LAN address, while `perfclient` measures benign impact.
5. Renders `testing/RESULTS.md` (`render_results.py`), tears down all processes/routes on exit, and exits non-zero on any failure.

Artifacts from each run are kept under `/tmp/osc-l7-run.*` (printed at the end).
