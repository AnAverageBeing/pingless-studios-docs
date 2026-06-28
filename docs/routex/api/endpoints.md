# API Reference

Base URL: `http://localhost:9000`

Authentication: `X-API-Key` header or `?api_key=` query parameter.

## Health & Version

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | `{"status":"ok"}` |
| GET | `/api/version` | None | Version + build info |

## Metrics (`metrics:read`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/metrics?format=json\|prometheus\|influx\|csv` | Global metrics |
| GET | `/metrics/proxy/{name}` | Per-proxy metrics |

## Proxies (`proxies:read` / `*`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/proxies` | List all proxies |
| GET | `/api/proxies/{name}` | Proxy detail |
| POST | `/api/proxies/{name}/enable` | Enable proxy |
| POST | `/api/proxies/{name}/disable` | Disable proxy |
| POST | `/api/proxies/{name}/reload` | Reload from disk |
| GET | `/api/proxies/{name}/connections` | Active connections |
| DELETE | `/api/proxies/{name}/connections/{id}` | Kill connection |
| GET | `/api/proxies/{name}/upstreams` | Upstream health |
| POST | `/api/proxies/{name}/upstreams/{ip}/eject` | Force-eject |
| POST | `/api/proxies/{name}/upstreams/{ip}/readmit` | Force-readmit |

## iptables (`*`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/iptables/rules` | Active rules |
| POST | `/api/iptables/validate` | Validate config |
| POST | `/api/iptables/flush/{proxy}` | Flush & recreate |
| POST | `/api/iptables/orphan-sweep` | Remove orphans |

## L7 (`*`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/l7/banned` | Banned IPs |
| DELETE | `/api/l7/banned/{ip}` | Unban |
| POST | `/api/l7/banned/{ip}?duration=30m` | Manual ban |
| GET | `/api/l7/events?limit=100` | Block events |

## ACL (`*`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/acl/global` | Global rules + stats |
| POST | `/api/acl/global/rules` | Add rule |
| DELETE | `/api/acl/global/rules?cidr=...` | Remove rule |
| PUT | `/api/acl/global/rules` | Replace all |
| GET | `/api/acl/proxy/{name}` | Per-proxy rules |
| POST | `/api/acl/proxy/{name}/rules` | Add proxy rule |
| DELETE | `/api/acl/proxy/{name}/rules?cidr=...` | Remove proxy rule |
| PUT | `/api/acl/proxy/{name}/rules` | Replace all proxy |

## Bandwidth (`metrics:read`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bandwidth/proxy/{name}` | Usage snapshot |
| POST | `/api/bandwidth/proxy/{name}/reset` | Reset counters |

## System (`*`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/reload` | Reload all configs |
