---
title: Admin Panel
description: A tour of every Sentinel admin tab — Dashboard, Detections, Nodes, Servers, Scans, Intel, Quarantine, and the six Settings sub-tabs.
---

# Admin Panel

Sentinel adds an admin-only section to the Pterodactyl panel with eight tabs. There are no end-user pages — server owners never see Sentinel; all visibility and control sits with admins.

---

## Dashboard

The fleet overview, in the same visual language as the bandwidth addon: neutral tiles, `<code>` number chips, sortable/searchable/paginated tables, and names that link through to the core server/node overview pages.

- **Fleet tiles** — nodes online, servers monitored, events in the last 24 h broken down by severity, active quarantines, and servers currently suspended-by-Sentinel.
- **Events-by-category chart** — where your detections concentrate (miner, abuse, malware, …).
- **Recent critical events** — the newest critical-severity events with one-click drill-in.
- **Top flagged servers** — the repeat offenders, ranked by flag count.

Use it as the daily health check: a sudden critical-events spike or a node dropping offline is visible at a glance.

---

## Detections

The full event feed across the fleet — every event every node has ever shipped (within the retention window, default 30 days).

- **Filters** — by node, server, category, severity and detector. Combine them to answer questions like "all high+ `malware` events on node 3 this week".
- **Detail modal** — the complete event: title, server/container attribution, process and PID, file path, the arbitrary `evidence` map the detector attached (ratios, cmdlines, matched indicators, connection counts), `actions_taken`, and whether it fired under `dry_run` or for a muted server (`evidence.muted`).
- **Per-event actions** — whitelist the path or server, quarantine the file, or suspend/unsuspend the server, directly from the event.

Muted servers still record events here (with the muted marker) — muting suppresses actions and alerts, never visibility.

---

## Nodes

One pairing card per Pterodactyl node. This is where the fleet is onboarded.

- **Token lifecycle** — **Create token** generates the 64-hex pairing token; it is viewable again later (the panel keeps an encrypted copy alongside the bcrypt verification hash); **Reset token** mints a new pair and kills the old one instantly — the node goes offline until re-paired by re-running `install.sh`.
- **API URL** — the address the panel uses to call back into the node's agent (`http(s)://host:8481`), learned at registration and editable if the node's address changes.
- **Live status** — online/offline, agent version, last-seen timestamp, and the detectors the node reported in its last heartbeat.
- **Config version + push status** — the node's applied `config_version` versus the panel's current one, and the result of the last push. A node behind on versions reconciles itself on the next heartbeat; you can also force a push.
- **Health** — the panel proxies the node's `/api/v1/status` for per-detector state, spool depth and last config-apply result without SSHing in.
- **Install instructions** — the exact `install.sh` invocation for that node.

---

## Servers

A per-server security view across the fleet.

- **Per-server page** — the server's event history, flag count and detection types (from `sentinel_flagged_servers`), scan history, and its quarantined files.
- **Mute / whitelist toggle** — mutes the server: local actions and alerts stop, events keep recording with `evidence.muted: true`. The same list as `whitelist.servers` in the config.
- **Manual actions** — **Scan now** (on-demand volume/container scan on that server), **Suspend** / **Unsuspend**, plus node-executed containment: **pause**, **stop**, and **kill process** via `POST /api/v1/servers/{uuid}/action` on the node.

Suspension from here is the same panel-authoritative path the rules engine uses — it goes through Pterodactyl's `SuspensionService`.

---

## Scans

On-demand and scheduled scan runs, fleet-wide.

- **Trigger a scan** — per server, per node, or across the whole fleet; `quick` or `full`. The panel allocates a `scan_id` and calls `POST /api/v1/scans` on the target node(s); the scan runs asynchronously and the node POSTs the result back when done.
- **Run history** — every row of `sentinel_scans`: type, status (`running` / `completed` / `partial` / `failed`), stats (files scanned, duration), findings, who triggered it, and start/finish times.
- **Findings** — path, reason, hash and severity per finding, linking into Detections and Intel.

Re-POSTing a scan that is already running is a no-op (`already_running`), so mashing the button cannot stack scans.

---

## Intel

The central threat-intel database (`sentinel_hashes`).

- **Pending vs confirmed** — a hash starts **pending** when nodes submit it. When it reaches the confirm threshold (default: 3 distinct nodes), it flips to **confirmed** and is distributed to every node's blocklist on the next config sync. Each row shows the report count and which nodes reported it.
- **Manual add / confirm / delete** — admins can add a hash directly, confirm a pending one immediately (bypassing the threshold), or delete a bad entry.
- **Bulk import** — import a hash list from an uploaded file or a URL, for seeding the fleet from an external blocklist or a previous deployment.
- **Threshold** — the confirm threshold is edited under Settings → Intel & Limits.
- **Feed status** — the external hashlist URL (if configured), last update, and the current `hashes_version` / `yara_version` being distributed.

The confirmed set plus the YARA rule bundle ship with every config push; nodes hot-reload both.

---

## Quarantine

The cross-node quarantine ledger (`sentinel_quarantines`) — every file any node has quarantined, with original path, quarantine path, file hash, status and the event that caused it.

- **Restore** — returns the file to its original path on the node (`POST /api/v1/quarantine/{id}/restore`). Use this for false positives.
- **Delete** — destroys the quarantined copy permanently (`POST /api/v1/quarantine/{id}/delete`).
- **Status filter** — `quarantined`, `restored`, `deleted`.

Restore/delete are admin-initiated and executed by the node; an unknown ID returns a 404.

---

## Settings

The tabbed editor for the entire panel-managed config. Every save validates, normalizes, bumps `config_version`, and pushes to all online nodes; offline nodes reconcile on their next heartbeat.

### General

`scan_interval_seconds`, `cooldown_seconds`, `dry_run`, `log_level`. This is where you flip dry-run off to go live.

### Detectors

Per-detector enable switches and every knob from the [Configuration Reference](../configuration/reference.md) — thresholds, ports, pattern lists (edited one-per-line), watch paths, intervals. Also the YARA rule bundle editor (max 200 KB), distributed to nodes on save.

### Enforcement Rules

The rules engine editor: ordered rules of name → categories → minimum severity → actions, with add/remove/reorder. Categories: `miner`, `portscan`, `ddos`, `zipbomb`, `exploit`, `abuse`, `malware`, `fim`, `vuln`, `scan` (plus `*` node-side). Actions: `alert`, `quarantine_file`, `delete_file`, `kill_process`, `pause_container`, `stop_container`, `suspend_server`. Up to 50 rules; every category/action is validated server-side.

### Alert Channels

Discord webhook, generic JSON webhook, and SMTP recipients — each with an enable switch and a per-channel minimum severity. These are panel-side only; they are never pushed to nodes. See [Webhooks & Alerts](./webhooks.md).

### Intel & Limits

`intel.confirm_threshold`, `intel.external_hashlist_url`, `intel.update_interval_hours`, plus `limits.max_events_per_minute` and `limits.spool_max_events`.

### Node Overrides

Per-node JSON override trees, deep-merged over the global config for that one node — for raising a threshold on one noisy node or enabling an expensive detector on one beefy one. Clearing the override reverts the node to the global tree. Format and semantics: [Configuration Reference → Per-node overrides](../configuration/reference.md#per-node-overrides-settings-node-overrides).
