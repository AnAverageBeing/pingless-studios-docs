---
title: API Reference
description: Firewall-Plus REST APIs — the node daemon API (port 8472) and the Pterodactyl client API (/v1/firewall).
---

# API Reference

Two REST surfaces:

- **Node API** — the `firewall-plus` daemon on each Wings host (default `http://127.0.0.1:8472/api/v1`), called by the panel and by operators.
- **Client API** — panel-side endpoints under the Pterodactyl client API, used by the server firewall UI and any integrations.

---

## Node API

Base URL: `http://<node>:8472/api/v1` · Auth: `Authorization: Bearer <64-hex token>` (from `/etc/firewall-plus/token`) plus the `allowedIps` IP whitelist. Exceeding a rate limit returns `429` with `Retry-After`.

| Route | Rate limit (per source IP) |
|-------|---------------------------|
| `POST /firewall/apply` | 10/min |
| `POST /firewall/flush*`, `DELETE /smart/mitigation/*` | 5/min |
| `GET /health` | 60/min |
| Other protected routes | 30/min |

### Health

```http
GET /api/v1/health
```

Reports daemon version and capabilities — the panel uses this for the ONLINE/OFFLINE badge and version display:

```json
{
  "success": true,
  "data": { "input_jump_style": "per-port-dport-v2", "geoip_available": true },
  "meta": { "version": "1.0.4" }
}
```

### Firewall apply & lifecycle

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/firewall/apply` | Queue an atomic apply for a server (rules + ipsets + optional `smart` block). Processed serially by the queue worker with snapshot + rollback. |
| `GET` | `/api/v1/firewall/queue` | Inspect the apply queue (pending/processing entries). |
| `GET` | `/api/v1/firewall/status/:serverId` | Last apply status for a server (the panel polls this). |
| `POST` | `/api/v1/firewall/sync` | Push full desired state for reconciliation. |
| `GET` | `/api/v1/firewall/sync` | Inspect the node's current view of synced state. |
| `POST` | `/api/v1/firewall/verify` | Run drift verification — compares live iptables/ipset state against the stored desired config and reports differences. |
| `POST` | `/api/v1/firewall/flush/:serverId` | Remove all `FWP-*` chains and `fwp-*` ipsets for one server. |
| `POST` | `/api/v1/firewall/flush-rule-types/:serverId` | Flush only specific rule types for a server (used by emergency per-type disables). |

Apply payloads carry an `X-Correlation-ID` that shows up in node logs and panel audit entries — trace a single apply panel → queue → node with it:

```bash
journalctl -u firewall-plus | grep '<correlation-uuid>'
```

### SMART endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/smart/status/:serverId` | Monitor state for a server (baseline, current level, active mitigation). |
| `GET` | `/api/v1/smart/events` | Recent attack events from the node log (the panel syncs these every 2 minutes). |
| `POST` | `/api/v1/smart/events/ack` | Acknowledge events by id. |
| `POST` | `/api/v1/smart/event` | Record an externally-detected event (used by integrations/testing). |
| `DELETE` | `/api/v1/smart/mitigation/:serverId` | Manually clear the active mitigation for a server. |

### Metrics endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/metrics/:serverId/summary` | Aggregate counters (packets/bytes dropped, passed) for a server. 60/min. |
| `GET` | `/api/v1/metrics/:serverId/timeseries` | Time-bucketed series for charts. 30/min. |
| `GET` | `/api/v1/metrics/:serverId/rules` | Per-rule hit counters. 30/min. |
| `GET` | `/api/v1/metrics/:serverId/sources` | Top source IPs. 30/min. |
| `POST` | `/api/v1/metrics/batch` | Batch metric ingest. 20/min. |
| `POST` | `/api/v1/metrics/:serverId/reset` | Reset one server's counters. 10/min. |
| `POST` | `/api/v1/metrics/node/reset-all` | Reset all counters on the node. 5/min. |
| `GET` | `/api/v1/metrics/node/summary` | Node-wide aggregate. 30/min. |

---

## Client API (panel)

Base URL: `/api/client/servers/{server}/v1/firewall` — authenticated with a normal Pterodactyl **client API key**, subject to subuser permissions (`firewall.read`, `firewall.manage`, `firewall.abusedb`).

::: warning Use the `/v1/` prefix
The canonical namespace is `/api/client/servers/{server}/v1/firewall/...`. The unprefixed `/firewall/...` routes are a **deprecated** back-compat alias that emits RFC 8594 headers (`Deprecation: true`, `Sunset: Fri, 01 Jan 2027 00:00:00 GMT`, and a `Link: ...; rel="successor-version"`). New code must use `/v1/`.
:::

**Response envelope** on every endpoint:

```json
{ "success": true, "data": { }, "error": null, "meta": { } }
```

Every response includes an `X-Correlation-ID` header — include it in bug reports; it's stored in the audit log and forwarded to the node on applies.

### Rate limits (per user + server)

| Bucket | Limit | Covers |
|--------|-------|--------|
| `firewall-apply` | 3/min | `POST .../firewall/apply` |
| `firewall-mutations` | 20/min | Rule/preset/SMART mutations, event ack |
| `firewall-lists` | 30/min | Whitelist/blacklist add & delete |
| `firewall-list-uploads` | throttled separately | Bulk list imports |

### Read endpoints (`firewall.read`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/firewall` | Dashboard payload (state, counts, sync status). |
| `GET` | `/firewall/apply/status` | Poll the in-flight apply. |
| `GET` | `/firewall/stats` | Traffic/drop stats. |
| `GET` | `/firewall/logs` | Activity + SMART event log for the server. |
| `GET` | `/firewall/smart` | SMART config and status. |
| `GET` | `/firewall/rules` | List rules. |
| `GET` | `/firewall/whitelist` · `/firewall/blacklist` | List entries. |
| `GET` | `/firewall/presets` | System + user presets. |
| `GET` | `/firewall/metrics/summary` · `/timeseries` · `/rules` · `/sources` | Chart data for the dashboard. |

### Mutations (`firewall.manage` + ToS accepted)

Mutations additionally pass through `firewall.tos` (Terms must be accepted), `firewall.emergency` (blocked while emergency mode is on), and `firewall.owner_addon` checks.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/firewall/tos/accept` | Accept the Terms of Service. |
| `PUT` | `/firewall/enabled` | Toggle Firewall-Plus for this server (`addon_enabled`). Off = node flush job. |
| `POST` | `/firewall/rules` | Create a rule. |
| `PUT` | `/firewall/rules/{id}` | Update a rule. |
| `PATCH` | `/firewall/rules/{id}/enabled` | Enable/disable a rule without deleting it. |
| `DELETE` | `/firewall/rules/{id}` | Delete a rule. |
| `POST` | `/firewall/apply` | Queue an apply to the node (`firewall-apply` throttle, 3/min). |
| `PUT` | `/firewall/smart` | Update SMART settings (requires admin SMART grant). |
| `PUT` | `/firewall/smart/webhook` | Set the per-server owner Discord webhook. |
| `POST` | `/firewall/smart/events/{id}/ack` | Acknowledge a SMART event. |
| `POST` | `/firewall/whitelist` · `/blacklist` | Add an entry. |
| `POST` | `/firewall/whitelist/bulk` · `/blacklist/bulk` | Bulk import (paste/upload many entries). |
| `DELETE` | `/firewall/whitelist/{id}` · `/blacklist/{id}` | Remove an entry. |
| `POST` | `/firewall/presets` | Save a user preset. |
| `POST` | `/firewall/presets/{preset}/apply` | Instantiate a preset's rules. |
| `DELETE` | `/firewall/presets/{preset}` | Delete a user preset. |
| `POST` | `/firewall/metrics/reset` | Reset the server's metric counters. |

### AbuseIPDB endpoints (`firewall.abusedb`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/firewall/abusedb/status` | Whether a key is configured and the feature is enabled. |
| `POST` | `/firewall/abusedb/verify-key` | Validate & store the user's AbuseIPDB API key. |
| `DELETE` | `/firewall/abusedb/key` | Remove the stored key. |
| `POST` | `/firewall/abusedb/check` | Run a lookup against an IP. |
| `POST` | `/firewall/abusedb/saved` | Save a lookup. |
| `GET` | `/firewall/abusedb/saved` · `/saved/{id}` | List / show saved lookups. |
| `DELETE` | `/firewall/abusedb/saved/{id}` | Delete a saved lookup. |

Grant subusers access in the server's **Users** tab: **Firewall → Read / Manage / AbuseDB Access**. Manage implies read.
