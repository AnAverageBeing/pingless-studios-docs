---
title: Quick Start — OpenShield-L7
description: From zero to a protected, proxied site in 30 seconds — config.yaml, one sites.d file, gen-token, and the first API calls.
---

# Quick Start

The 30-second path: one global config, one site file, one token, and a live request event. Assumes a [built binary](./installation.md) (`cargo build --release`).

---

## 1. Create the project root

```bash
mkdir -p myproxy/sites.d && cd myproxy
```

## 2. `config.yaml` — global config

```yaml
listen_http:
  - "0.0.0.0:80"
listen_https:
  - "0.0.0.0:443"
admin:
  listen: "127.0.0.1:9090"
  tokens:
    - name: bootstrap
      token: "paste-a-long-random-string-here"   # >= 16 chars
      role: admin
```

Generate a real token (prints the token plus a ready-to-paste YAML snippet):

```bash
openshield-l7 gen-token --name bootstrap
```

## 3. `sites.d/example.yaml` — one site

Point it at any web server you have running (here: `http://10.0.0.5:8080`):

```yaml
hostnames:
  - example.com
origin:
  url: "http://10.0.0.5:8080"
```

That's a complete site. Everything else has working defaults: WAF on, per-IP 300 req/60s and per-site 5000 req/10s limits, `X-Forwarded-For` to the origin, no TLS, no quotas.

## 4. Validate, then run

```bash
openshield-l7 validate          # all configs valid (config.yaml + 1 site file(s) ...)
openshield-l7 run               # needs root or CAP_NET_BIND_SERVICE for 80/443
```

::: tip First-run shortcut
If `config.yaml` is missing, `run` writes a documented default and generates one admin token, printed **once** to the console. You can skip steps 2–3 entirely and edit the generated files afterward.
:::

## 5. Push a request through

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: example.com" http://127.0.0.1/
# 200
```

## 6. Talk to the admin API

```bash
TOKEN="paste-a-long-random-string-here"

curl -s http://127.0.0.1:9090/api/v1/health
# {"status":"ok"}

curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9090/api/v1/stats/global
# {"uptime_secs":61,"version":"0.1.0","sites_total":1,"sites_enabled":1,
#  "total_requests":3,"blocked":0,"challenged":0,"bytes_up":936,"bytes_down":10420,
#  "active_connections":0,"rps_1m":0.05}
```

## 7. Watch a request event live

```bash
curl -sN -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9090/api/v1/events/stream
```

In another shell, repeat the `curl` from step 5 — a frame appears within a second:

```text
data: {"kind":"request","ts_ms":1723000000123,"site":"example-com","client_ip":"127.0.0.1","peer_ip":"127.0.0.1","method":"GET","host":"example.com","path":"/","status":200,"action":"allowed","rule_hits":[],"latency_us":1843,"bytes_up":312,"bytes_down":10420,"user_agent":"curl/8.5.0","referer":"","conn_bumped_ip":false,"conn_bumped_site":false}
```

## 8. Feel the hot reload

Edit `sites.d/example.yaml` while it runs — changes hot-apply within a second. Break the YAML on purpose: the site keeps running on its last good config and a `config_reload` event on the stream reports the failure. Details: [Hot Reload](../user-guide/hot-reload.md).

---

## What's next

- **[Configuration Reference →](../configuration/reference.md)** — TLS, rate limits, WAF rules, challenges, quotas.
- **[Admin API →](../user-guide/api.md)** — Create sites, ban IPs, pull analytics without touching files.
- **[Transparent Client IP →](../architecture/transparent-ip.md)** — Make the origin see the real client IP with zero origin config.
