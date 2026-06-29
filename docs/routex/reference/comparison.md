# Comparison: RouteX vs HAProxy vs Traefik vs Caddy

## TL;DR

| Proxy | Best For |
|-------|----------|
| **RouteX** | Game servers, DDoS protection, API-driven infrastructure, bandwidth-constrained environments |
| **HAProxy** | Enterprise HTTP routing, high-traffic websites, complex L7 rules |
| **Traefik** | Kubernetes/Docker ingress, cloud-native, auto-discovery |
| **Caddy** | Simple web servers, automatic HTTPS, small projects |

## Detailed Feature Matrix

### Protocol & Layer Support

| Feature | RouteX | HAProxy | Traefik | Caddy |
|---------|:------:|:-------:|:-------:|:-----:|
| TCP Proxying | ✅ Full | ✅ Full | ✅ Full | ❌ |
| UDP Proxying | ✅ Full session model | ⚠️ Limited | ✅ | ❌ |
| HTTP/HTTPS L7 | ❌ L4 only | ✅ Full parsing, header rewrite | ✅ Full | ✅ Full |
| HTTP/2, gRPC | ❌ | ✅ | ✅ | ✅ |
| TLS Termination | ⚠️ Passthrough only | ✅ Full offload | ✅ Full auto | ✅ Full auto Let's Encrypt |
| PROXY Protocol | ❌ | ✅ v1/v2 | ✅ v2 | ❌ |
| WebSocket | ✅ Transparent (L4) | ✅ | ✅ | ✅ |

### Security & DDoS Protection

| Feature | RouteX | HAProxy | Traefik | Caddy |
|---------|:------:|:-------:|:-------:|:-----:|
| iptables Rate Limiting | ✅ PPS, SYN, RST, connlimit | ❌ L7 only | ❌ | ❌ |
| Game Protocol Detection | ✅ MC Java/Bedrock, FiveM, GMod | ❌ | ❌ | ❌ |
| Behavioral Scoring | ✅ Per-IP threat score → auto-ban | ❌ | ❌ | ❌ |
| Connection Cycling Detection | ✅ Sliding window | ❌ | ❌ | ❌ |
| Payload Inspection | ✅ First-bytes byte matching | ❌ | ❌ | ❌ |
| Amplification Detection | ✅ Request/response ratio | ❌ | ❌ | ❌ |
| TCP Invalid State Drop | ✅ iptables | ❌ | ❌ | ❌ |
| Fragment Drop | ✅ iptables | ❌ | ❌ | ❌ |
| ACL (IP allow/deny) | ✅ Global + Per-proxy, live API | ✅ Extensive (IP, headers, paths) | ✅ IP whitelist middleware | ❌ |
| Rate Limiting (L7) | ✅ Token bucket per-IP | ✅ stick-table based | ✅ RateLimit middleware | ❌ |

### Load Balancing & Traffic Management

| Feature | RouteX | HAProxy | Traefik | Caddy |
|---------|:------:|:-------:|:-------:|:-----:|
| Algorithms | 5 (RR, LC, IP-hash, weighted, random) | 10+ | Round-robin | Round-robin |
| Sticky Sessions | ✅ Source IP with TTL | ✅ Cookie + IP based | ✅ Cookie based | ✅ |
| Health Checks | ✅ Active TCP probes | ✅ Active + Passive + Agent | ✅ | ✅ |
| Connection Draining | ✅ Bounded timeout | ✅ | ✅ | ✅ Graceful |
| Bandwidth Quotas | ✅ Hourly/Daily/Weekly/Monthly | ❌ | ❌ | ❌ |
| Auto-Suspend on Quota | ✅ | ❌ | ❌ | ❌ |
| Backend Max Connections | ✅ Per-upstream limit | ✅ | ❌ | ❌ |

### Observability

| Feature | RouteX | HAProxy | Traefik | Caddy |
|---------|:------:|:-------:|:-------:|:-----:|
| Metrics Formats | Prometheus + InfluxDB + CSV + JSON | Prometheus (exporter) | Prometheus + OpenTelemetry | Prometheus |
| Per-Connection Logging | ✅ Connect/close + byte counts + duration | ✅ Custom format | ✅ Access logs | ✅ |
| Event Stream | ✅ L7 block events API | ❌ | ❌ | ❌ |
| Web Dashboard | ❌ REST API only | ✅ HTML stats page | ✅ Dashboard UI | ❌ |

### Operations

| Feature | RouteX | HAProxy | Traefik | Caddy |
|---------|:------:|:-------:|:-------:|:-----:|
| Config Format | YAML (flat) | Custom DSL | YAML/TOML/KV/Labels | Caddyfile / JSON |
| Hot Reload | ✅ Per-proxy, inotify-based | ⚠️ Soft reload (drops conns) | ✅ | ✅ Graceful |
| API Management | ✅ 36 REST endpoints | ⚠️ Stats socket (text protocol) | ✅ API + Dashboard | ✅ Admin API |
| DNS Discovery | ❌ Static IP only | ✅ Dynamic resolution | ✅ Docker/Swarm/K8s/Consul | ❌ |
| Let's Encrypt | ❌ | ❌ | ✅ | ✅ Auto |
| Multi-Process | ❌ Single binary | ✅ nbproc | ❌ | ❌ |

### Maturity & Community

| Feature | RouteX | HAProxy | Traefik | Caddy |
|---------|:------:|:-------:|:-------:|:-----:|
| First Release | 2026 | 2001 | 2016 | 2015 |
| Language | Go | C | Go | Go |

## When to Choose RouteX

✅ **Game server hosting** — Built-in protocol detection catches bot attacks that generic proxies miss. Minecraft Bedrock unconnected ping validation is a unique feature.

✅ **DDoS mitigation for non-HTTP services** — Layered defense: iptables drops volumetrics at kernel level, L7 catches slow/app-layer attacks. No other proxy combines both.

✅ **API-driven infrastructure** — 36 REST endpoints for full programmatic control. Change ACL rules, eject backends, view bandwidth usage — all without editing config files.

✅ **Bandwidth-constrained environments** — Enforce hourly/daily/monthly quotas with auto-suspension. Track usage per proxy. Perfect for metered hosting or budget-conscious deployments.

✅ **Simple YAML config** — No custom DSL to learn. Flat structure. One file per proxy. IDE autocomplete and validation work out of the box.

## When to Choose HAProxy

✅ **Enterprise HTTP routing** — HAProxy's L7 capabilities are unmatched. Header rewriting, cookie-based persistence, URL routing, compression, caching.

✅ **Complex ACL rules** — HAProxy ACL can match on any combination of source/dest IP, ports, HTTP headers, cookies, URL paths, SSL fingerprints, GeoIP.

✅ **Extreme scale** — HAProxy handles millions of concurrent connections in production. Battle-tested at Facebook, Cloudflare scale.

## When to Choose Traefik

✅ **Kubernetes/Docker** — Native service discovery. Auto-configures routes from container labels. No config files needed for new services.

✅ **Let's Encrypt automation** — Automatic certificate provisioning and renewal. Zero manual TLS management.

✅ **Cloud-native ecosystem** — Integrates with Consul, Etcd, ZooKeeper, Marathon. OpenTelemetry tracing built in.

## When to Choose Caddy

✅ **Simple web servers** — Single binary. Automatic HTTPS. Caddyfile is the simplest config format available.

✅ **Reverse proxy with auto-HTTPS** — Point at a backend, Caddy handles cert provisioning automatically. Zero config TLS.

✅ **Developer environments** — Fast setup. No dependencies. Great for local development and small production deployments.
