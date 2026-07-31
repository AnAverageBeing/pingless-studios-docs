---
title: Admin Panel Guide
description: Walkthrough of every Bandwidth Monitor admin page in the Pterodactyl panel — Dashboard, Analytics, Nodes, Servers, Reports, Settings, and Events — with what each card, chart, table, and action does.
---

# Admin Panel Guide

The panel addon adds a **Bandwidth** section to the Pterodactyl admin area (`/admin/bandwidth`), with seven tabs: **Dashboard, Analytics, Nodes, Servers, Reports, Settings, Events**. This page walks through each of them.

All pages require a normal Pterodactyl admin session (web auth + 2FA + admin middleware). Charts are rendered with a bundled copy of Chart.js served from `public/ext/bandwidth/` — no external CDN calls, and the file survives panel frontend rebuilds.

::: info TABLE CONVENTIONS
Every analysis table in the addon shares the same toolkit:

- **Search bar** — live-filter rows across all columns.
- **Sortable headers** — click to toggle ascending/descending (numeric-aware).
- **Page-size dropdown** — 10 / 25 / 50 / 100 / All rows, with compact pagination.
- **Code chips** — numbers render as monospace chips so values are easy to scan.
- **Clickable names** — node, server, and user names link to their core Pterodactyl overview pages.
:::

---

## Dashboard

Route: `/admin/bandwidth` — the landing page. Deliberately minimal: four stat tiles and two charts.

### Stat tiles

| Tile | What it shows | Source |
| --- | --- | --- |
| **Nodes Online** | Online / total Pterodactyl nodes (`x / y`) | A node counts as online when its agent has registered and is heartbeating (`is_online` flag) |
| **Servers Monitored** | Total number of servers on the panel | Panel server count |
| **Inbound + Outbound Today** | Combined bytes since local midnight (in the configured quota timezone) | Summed from the hourly usage rollup table |
| **Servers Throttled / Exceeded** | Servers currently throttled plus servers with at least one exceeded quota, summed across all online nodes | The `throttled` and `quota_exceeded` counters each node reports in its heartbeat |

Each tile links to the relevant tab.

### Fleet Bandwidth chart (last 24h)

A dual-series Inbound/Outbound area chart of the whole fleet over the last 24 hours, in hourly buckets. Loaded from the session-authed JSON endpoint `GET /admin/bandwidth/api/timeseries?hours=24`, which reads the hourly/daily rollup tables (see [Architecture](../architecture/overview.md) for how data gets there).

### Top 10 Consumers chart (last 24h)

A donut chart of the ten heaviest servers by combined bytes over the last 24 hours, with share percentages in the tooltips. Loaded from `GET /admin/bandwidth/api/top-consumers?hours=24`. Both chart endpoints accept `hours` (1–2160), `node_id`, and (timeseries only) `server_id` filters.

---

## Analytics

Route: `/admin/bandwidth/analytics` — the deep-dive page. Everything that doesn't fit on the dashboard lives here.

### Fleet tiles

A second row of tiles: **Fleet Usage This Week**, **Fleet Usage This Month** (each with the In/Out split in the footer), and **Live Inbound / Outbound Rate** summed across all online nodes from their heartbeats.

### Period Comparison

| Cell | What it shows |
| --- | --- |
| **This week vs last week** | Totals side by side with a delta % (up/down caret) |
| **This month vs last month** | Same for calendar months |
| **Peak rates today** | Highest In/Out rates observed today |
| **Average per hour today** | Mean In/Out bytes per hour today |

### Consumption

Usage broken down per group, switchable between **By Node** and **By User** (server owner):

- **By Node** — node (with online dot), server count, **live ↓/↑ rates**, today (In/Out), month (In/Out), and a flagged badge (throttled + exceeded).
- **By User** — owner, server count, today (In/Out), month (In/Out).

Both tables use the shared search/sort/page-size toolkit and are sorted by monthly usage.

### Quota Watch

Current-period consumption vs quota with slim progress bars (green < 70 %, yellow < 90 %, red ≥ 90 %) and exact `used / quota` labels. Three tabs:

- **By Server** — per-server Day Inbound/Outbound and Month Inbound/Outbound bars, sorted by worst percentage.
- **By Node** / **By User** — the same bars aggregated per group (used and quota bytes summed, percentages recomputed).

Only servers with enforcement enabled and at least one quota above zero appear.

### Predictions

Projected usage and quota risk, in three tabs:

- **By Server** — the classic quota-risk table: direction, period, quota, used, projected total, projected exceed date, exceed action. Only servers projected to cross an active quota this period appear.
- **By Node** / **By User** — **quota-independent** projections for every group with traffic: `used → projected` for **tomorrow, this week, and this month**, so you can capacity-plan even where no quotas are configured.

::: info HOW THE PREDICTION MATH WORKS
The primary signal is a **linear projection** over the current period:

```
rate_avg  = used / elapsed_seconds_in_period
projected = used + rate_avg * remaining_seconds_in_period
```

For week and month quotas a **secondary signal** is added: the server's average daily usage over its last 7 daily rollup rows, extrapolated over the remaining days (`used + avg_daily * remaining_days`). A quota-risk row appears if either signal crosses the quota.

When the primary projection exceeds the quota, the projected exceed date is the moment the linear trend crosses it: `period_start + (quota / used) * elapsed`. Dates are displayed in the configured quota timezone.
:::

::: warning PROJECTIONS ARE ESTIMATES
A linear projection assumes the current burn rate continues. A server that pushed its monthly quota in the first two days will show an early "exceed date" even if it then idles. Treat predictions as an early-warning signal — enforcement itself is driven by real counters, not projections.
:::

All analysis payloads are batched (grouped SUM queries, no per-row queries) and cached for 60 seconds.

---

## Nodes

Route: `/admin/bandwidth/nodes` — pairing and node health. Every Pterodactyl node gets a card; a pairing token row is generated automatically the first time the page loads.

### Node card

Each card shows the node name (linked to the core node page) with a **minimal live status dot** beside it — green and pulsing when online, red when offline. A failed health check only flips a node offline after 3 consecutive failures, so one bad probe cannot mark a healthy node down.

Under the header, a **live network panel** shows the node's current **Inbound** and **Outbound** rates plus a dual-series sparkline of roughly the last few minutes. The sparkline is fed every 3 seconds by the session-authed endpoint `GET /admin/bandwidth/nodes/{node}/live`, which proxies the agent's `/api/v1/stats` with a 3-second cache — genuinely live, not heartbeat-stale.

Below that, the info rows: **API URL** (auto-set at registration, default port `8480`), **Agent Version**, **Last Seen**, **Containers**, and **Throttled / Exceeded** (heartbeat counters). These refresh from the database every 15 seconds via `GET /admin/bandwidth/nodes/poll`.

### Card actions

- **View Token** — shows the node's 64-hex pairing token in a modal without rotating it. This is a POST-only endpoint, so the secret is never exposed via a browser-navigable GET. The panel stores the token bcrypt-hashed for verification plus an encrypted copy so you can re-view it.
- **Reset Token** — rotates the token. The old token is dead immediately. After a reset you must update `/etc/bandwidth-node/token` on the node and restart the agent (`systemctl restart bandwidth-node`). The agent detects the 401 and re-registers automatically once its token file is corrected.
- **API URL** — edit the URL the panel dials for this node. Must start with `http://` or `https://`. Leave empty to clear the override; it is repopulated at the next registration.
- **Health** — runs a live `GET /api/v1/health` probe against the agent right now and updates the card.

### Install instructions

The **Install Instructions** button opens a modal with the pairing procedure: copy the token, run `node-module/install.sh` as root on the Wings host, answer the prompts (panel URL, token, listen address, port — default `8480`). The installer writes `/etc/bandwidth-node/config.yaml` and `/etc/bandwidth-node/token` (both `0600`), installs the `bandwidth-node` systemd unit, starts it, and waits for registration. The node card flips to **Online** once the agent registers and heartbeats.

::: tip FIREWALL
The node API listens on port `8480` by default. The panel must be able to reach it (for stats pulls, limits pushes, and unthrottle calls) — open it from the panel host only. The agent calls out to the panel on its normal web port; nothing else is needed inbound.
:::

---

## Servers

Route: `/admin/bandwidth/servers` — per-server limits, 25 per page.

### The table

Every column except On Exceed and Actions is **sortable** (click the header to toggle the arrow; default is name A→Z):

| Column | Meaning |
| --- | --- |
| **Server** | Name (link to the standard Pterodactyl server page) + UUID |
| **Node** | Hosting node (link to the node page) |
| **Limits** | `custom` (override exists and enforcement is on), `disabled` (override exists, enforcement off), or `default` (no override — the global defaults apply) |
| **Speed (In / Out)** | Effective speed caps in Mbps; `0` = unlimited |
| **Inbound quotas (d/w/m)** | Effective inbound quotas in GiB: day / week / month; `0` = unlimited |
| **Outbound quotas (d/w/m)** | Same for outbound |
| **On Exceed** | `throttle`, `suspend`, or `none` |

"Effective" means: the override row if one exists, otherwise the global defaults. There is no partial override — saving an override stores a complete set of values for that server. Sorting is SQL-side with `COALESCE(override, default)`, so mixed default/custom fleets sort correctly.

### Edit modal

The **Edit** button opens a modal with the full limits set for that server:

- **Enforce bandwidth limits for this server** — master switch. Unchecked means no speed caps and no quota enforcement for this server (events and tc rules are cleared on the node).
- **Use global defaults** — deletes the per-server override; the server follows Settings again. Checking it disables the rest of the form.
- **Inbound / Outbound speed cap (Mbps, 0 = unlimited)** — hard rate caps enforced with `tc` on the server's veth.
- **Inbound / Outbound quotas (GB, 0 = unlimited)** — six fields: daily, weekly, monthly, per direction. Quotas are in **GiB** (1024³ bytes) and reset at calendar boundaries.
- **On quota exceed** — `throttle` (drop to the throttle speeds), `suspend` (suspend the Pterodactyl server, then hold at 1 Mbps), or `none` (record an event only).
- **Throttle inbound / outbound speed (Mbps)** — the speeds applied when the action is `throttle`. Minimum 1.

**Save & Push to Node** validates the values (integers, speeds/quotas 0–1000000, throttle speeds 1–1000000), bumps the panel's `config_version`, and queues a limits push to the server's node when it is online. No-op saves (unchanged values) skip the bump and the push.

::: info HOW SERVERS LEARN ABOUT CHANGES
Saving limits pushes the new set to the node immediately (queued job). Independently, every node sees the bumped `config_version` in the heartbeat response and pulls the full limits set itself — so a node that was offline when you saved catches up as soon as it comes back.
:::

### Unthrottle

The unlock button next to **Edit** removes an active throttle on that server immediately, by calling `POST /api/v1/servers/{uuid}/unthrottle` on its node. The override holds until the underlying quota period resets — then normal quota evaluation resumes. If the server was **suspended for quota** by the addon, this button also lifts the suspension and the name tag (see below). It fails with an error message if the node is offline (the call is made without retries so the page never hangs on a dead node).

---

## Quota Suspension Tagging

An optional, off-by-default feature controlled from **Settings → Quota suspension tagging**.

When enabled, a server the addon suspends for exceeding a quota is renamed to **`(Bandwidth Quota Exceeded) <original name>`** and its description gets the same prefix — so the reason is visible everywhere in the panel (server lists, dashboards, Discord/notifications that include the name).

The tag is **removed automatically** when the suspension ends, by whichever path comes first:

- **Manual unsuspend** — an admin (or API) unsuspends the server; a listener restores the original name/description.
- **Period reset** — when the quota period rolls over and the node reports `restored`, the panel unsuspends the server and strips the tag automatically.
- **Unthrottle** — the Servers page unthrottle action lifts both the throttle and the suspension + tag.
- **Safety net** — the per-minute poll job sweeps any leftover tags on servers that are no longer suspended.

Safety properties:

- **Only addon suspensions are touched.** The tag is tracked in a dedicated `bandwidth_quota_suspensions` table (original name + description). Servers suspended by hand, by other addons, or by the panel itself have no marker row and are never renamed or reverted.
- **Admin edits survive.** If someone renames the server while it is tagged, only the `(Bandwidth Quota Exceeded)` prefix is stripped on revert — their new name is kept.
- **Deletion is clean.** The marker row cascade-deletes with the server.

---

## Reports

Route: `/admin/bandwidth/reports` — usage reports and projections.

### Filters

| Filter | Effect |
| --- | --- |
| **From / To** (required) | Date range. Reversed ranges are swapped automatically; ranges are capped at 366 days to keep reports responsive |
| **Node** | Restrict to one node, or all |
| **Server** | Restrict to one server, or all |
| **Direction** | Both, Inbound only, or Outbound only (controls which series the chart draws) |
| **Mode** | `Usage report` or `Projection` |

### Usage report mode

Produces:

- **Four summary boxes** — Total Inbound, Total Outbound, average per hour (In + Out), and peak rates (In / Out) observed in the range.
- **Bandwidth chart** — bucketed In/Out series over the range. Ranges up to 7 days are shown in hourly buckets; longer ranges switch to daily buckets. Hourly and daily rollup tables are stitched at the aggregation boundary, so ranges spanning old and recent data never show gaps.
- **Per-server totals table** — inbound, outbound, and combined bytes per server for the range, sorted heaviest first and capped at 500 rows.
- **Export CSV** — downloads `bandwidth-report-<from>-to-<to>.csv` with columns `server_id, server_name, server_uuid, rx_bytes, tx_bytes, total_bytes`. Cell values starting with `=`, `+`, `-` or `@` are quote-prefixed to neutralize spreadsheet formula injection.

### Projection mode

Ignores the historical range and renders a table of **current period projections** per server: for each of day / week / month, the used → projected GiB for inbound and outbound, using the same linear math as the Analytics predictions. Use it for capacity planning ("who will blow their monthly quota at the current rate?") without waiting for a warning.

---

## Settings

Route: `/admin/bandwidth/settings` — global defaults, tagging, collection, and retention. Saving bumps `config_version` and pushes the new defaults to every online node.

### Default limits

Applied to every server that has no per-server override, and prefilled by the addon's server-build integration for new servers:

| Setting | Default | Notes |
| --- | --- | --- |
| Default inbound / outbound speed (Mbps) | `0` | 0 = unlimited |
| Default inbound / outbound quotas (GB) — daily, weekly, monthly | `0` | 0 = unlimited; six fields |
| On quota exceed | `throttle` | `throttle` / `suspend` / `none` |
| Throttle inbound / outbound (Mbps) | `5` | Applied on exceed when action is `throttle`; minimum 1 |

### Quota suspension tagging

| Setting | Default | Notes |
| --- | --- | --- |
| Tag servers suspended for quota | off | When enabled, quota suspensions rename the server to `(Bandwidth Quota Exceeded) <name>` and prepend the same tag to its description. See [Quota Suspension Tagging](#quota-suspension-tagging) |

### Collection & retention

| Setting | Default | Notes |
| --- | --- | --- |
| Quota period timezone | `UTC` | Day/week/month quota boundaries are evaluated in this timezone — on the panel (reports, predictions) and pushed to every node in the limits payload |
| Node heartbeat interval (seconds) | `60` | 15–3600. Sent to nodes at registration; also used as the panel-side stats poll interval |
| Hourly data retention (days) | `90` | Max 3650 |
| Daily data retention (days) | `730` | Max 7300 |

::: warning TIMEZONE CHANGES MOVE QUOTA BOUNDARIES
Changing the quota timezone re-anchors what "midnight", "Monday 00:00", and "the 1st" mean for every quota counter. The node agents preserve already-accumulated counters when the period start moves backwards, but a boundary that legitimately passed is treated as a rollover. Change it during a quiet window.
:::

---

## Events

Route: `/admin/bandwidth/events` — the enforcement audit log, 50 rows per page, newest first.

### Filters

Type (dropdown of types actually present), direction (Inbound/Outbound), node, server, and a from/to date range. The **Reset** button clears all filters.

### Event types

| Type | Meaning | Label color |
| --- | --- | --- |
| `quota_exceeded` | A quota counter reached its limit (includes direction, period, and used/quota bytes in the message) | red |
| `throttled` | tc rules were re-applied at throttle speed (or 1 Mbps pending suspension) | yellow |
| `suspended` | The panel suspended the Pterodactyl server after a node suspend callback | red |
| `restored` | A quota period reset (or limits were removed) and normal speeds were restored | green |
| `speed_applied` | A limits change actually changed the enforced speed on a running server | default |

Each row shows the time, server, node, period, direction, and a human-readable message (e.g. `tx month quota exceeded: 1181116006/1073741824 bytes used`). Events for servers that no longer exist keep their row with the server shown as `—`.

---

## Next steps

- **[API Reference →](./api.md)** — the full panel ↔ node protocol, if you want to script against it.
- **[Architecture →](../architecture/overview.md)** — how data flows from veth counters to these charts.
- **[Enforcement →](../architecture/enforcement.md)** — exactly what happens on the node when a cap or quota bites.
