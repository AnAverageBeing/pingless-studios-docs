---
title: Alerts & Notifications
description: Configure Protection's Discord, SMTP email and generic webhook alert channels — payload formats, severity gating, batching, and rate limiting.
---

# Alerts & Notifications

Protection can deliver every finding to three kinds of channel: **Discord**, **email (SMTP)**, and a **generic JSON webhook**. Channels are independent and each has its own minimum-severity gate.

Your `general.name` ([installation name](../configuration/reference.md#general)) appears in every alert, so you instantly know which node fired.

::: tip VERIFY FIRST
After configuring any channel, run `protection test-alert` — it sends a synthetic **critical** event through every enabled channel (bypassing the severity gates) and reports `✓ <channel>: delivered` or `✗ <channel>: <error>`.
:::

---

## Severity gating

Each channel has a `min_severity` (`info` → `low` → `medium` → `high` → `critical`). A finding only reaches the channel if its severity is at least that level. A common setup:

```yaml
alerts:
  discord:
    min_severity: medium   # see most things in chat
  smtp:
    min_severity: high     # only page email for serious stuff
```

A finding is also only alerted if a matching [rule](./actions-rules.md) includes the `alert` action (the default `catch-all` rule alerts everything at `low`+).

---

## What's in an alert

Every channel renders the same set of attribution fields (omitted when a detector couldn't gather them), so you can tell *what* was hit, *where*, and *by which detector* without opening the logs:

| Field | Content |
| --- | --- |
| **Installation** | Your `general.name` — which node fired. |
| **Severity** | `info` / `low` / `medium` / `high` / `critical`. |
| **Category** | `miner`, `portscan`, `ddos`, `zipbomb`, `exploit`, `abuse`, `malware`, or `system`. |
| **Detector** | The detector that raised the finding (e.g. `miner`, `onaccess`). |
| **Container** | Docker container name (containerised threats only). |
| **Docker ID** | Container ID, trimmed to the conventional 12-char short form. |
| **Pterodactyl Server** | The server UUID/identifier derived from the container. |
| **Process** | Process name and PID, e.g. `xmrig (pid 621221)`. |
| **Path** | File path, for file-based findings (zip bombs, malware). |
| **Evidence** | The detector's evidence map (remote endpoint, ratios, matched rule, …). |

---

## Discord

Rich, markdown-formatted embeds, colour-coded by severity, with your installation name as the embed author and in the footer.

```yaml
alerts:
  discord:
    enabled: true
    webhook_url: "https://discord.com/api/webhooks/123/abc"
    username: Protection
    min_severity: medium
```

**Setup:** Discord → Server Settings → Integrations → Webhooks → New Webhook → Copy URL.

The embed includes a severity badge (🚨 CRITICAL / 🔴 HIGH / 🟠 MEDIUM / 🟡 LOW / 🔵 INFO), a category emoji (⛏️ 🌊 🔭 💣 🐚 🛡️), a markdown description with the target in bold, the evidence map as a fenced `yaml` code block (values truncated at 300 characters), and the inline attribution fields from the table above.

::: details Example payload (abridged)
```json
{
  "username": "Protection",
  "embeds": [{
    "author": { "name": "node-fra-01" },
    "title": "⛏️ 🔴 HIGH — Connection to mining pool port",
    "description": "> Process \"xmrig\" (pid 621221) inside a container is connected to pool.example:3333.\n\n**Target:** `container web-07`\n\n**Evidence**\n```yaml\nremote: pool.example:3333\n```",
    "color": 15158332,
    "fields": [
      { "name": "Installation", "value": "`node-fra-01`", "inline": true },
      { "name": "Severity", "value": "🔴 HIGH", "inline": true },
      { "name": "Category", "value": "⛏️ `miner`", "inline": true },
      { "name": "Detector", "value": "`miner`", "inline": true },
      { "name": "Container", "value": "`web-07`", "inline": true },
      { "name": "Docker ID", "value": "`07ed098c54bc`", "inline": true },
      { "name": "Pterodactyl Server", "value": "`a1b2c3d4`", "inline": true },
      { "name": "Process", "value": "`xmrig (pid 621221)`", "inline": true }
    ],
    "footer": { "text": "protection • node-fra-01" },
    "timestamp": "2026-07-29T14:03:12Z"
  }]
}
```
:::

---

## Email (SMTP)

Plain-text email to one or more recipients, authenticated or via an open relay.

```yaml
alerts:
  smtp:
    enabled: true
    host: smtp.example.com
    port: 587                 # 587 = STARTTLS, 465 = implicit TLS
    username: alerts@example.com
    password: "app-password"
    from: alerts@example.com
    to: [admin@example.com, oncall@example.com]
    tls: true
    min_severity: high
```

Two TLS modes are supported:

| Mode | Config |
| --- | --- |
| **Implicit TLS** | `port: 465` with `tls: true` — the connection is TLS from the first byte. |
| **STARTTLS** | Any other port (typically `587`) — starts plain and upgrades via STARTTLS automatically when the server advertises it. |

Leave `username` empty to send through an unauthenticated relay.

The subject is formatted as:

```text
[protection][HIGH] Connection to mining pool port on node-fra-01
```

The body contains the description, the attribution fields (including the installation name), the evidence map, and the UTC timestamp.

::: warning APP PASSWORDS
For Gmail/Workspace and most providers, use an **app password**, not your account password. Set `port: 465` with `tls: true` for implicit TLS, or `port: 587` for STARTTLS.
:::

---

## Generic Webhook

Sends the full event as JSON to any endpoint — wire Protection into a SIEM, PagerDuty, n8n, or your own automation.

```yaml
alerts:
  webhook:
    enabled: true
    url: "https://hooks.example.com/protection"
    method: POST              # defaults to POST when empty
    headers:
      Authorization: "Bearer s3cret"
      X-Source: protection
    min_severity: medium
```

Payload shape:

```json
{
  "installation": "node-fra-01",
  "event": {
    "time": "2026-07-29T14:03:12Z",
    "detector": "miner",
    "category": "miner",
    "severity": 3,
    "title": "Connection to mining pool port",
    "description": "Process \"xmrig\" (pid 621221) …",
    "pid": 621221,
    "process": "xmrig",
    "container_id": "07ed098c54bc…",
    "container": "web-07",
    "server": "a1b2c3d4",
    "path": "/var/lib/pterodactyl/volumes/x/payload",
    "evidence": { "remote": "pool.example:3333" }
  }
}
```

`pid`, `process`, `container_id`, `container`, `server`, `path` and `evidence` are omitted when empty.

::: info SEVERITY ENCODING
In the JSON payload, `severity` is numeric: `0`=info, `1`=low, `2`=medium, `3`=high, `4`=critical.
:::

---

## Batching

On a busy node a single incident can trip dozens of findings at once — and dozens of pings. Batching collapses a burst into **one digest alert**:

```yaml
alerts:
  batch:
    enabled: false   # opt-in
    threshold: 10    # alerts inside `window` that trigger digest mode
    window: 1m
```

How it works:

1. Alerts flow individually until `threshold` events accumulate inside `window`.
2. At that point individual alerts pause and everything up to the end of the window is collected.
3. On the next alert after the window ends, a single **digest** summarizing the burst is sent instead — then normal per-event alerting resumes.

The digest is a synthetic event: detector `engine`, category `system`, severity equal to the **highest** severity in the burst, title `N security events (batched)`, and a description counting each `category: title` combination. Every channel renders it like any other event, so it lands on Discord, email and webhook alike. Webhook example:

```json
{
  "installation": "node-fra-01",
  "event": {
    "time": "2026-07-29T14:04:31Z",
    "detector": "engine",
    "category": "system",
    "severity": 4,
    "title": "23 security events (batched)",
    "description": "12× miner: Connection to mining pool port; 8× ddos: Outbound UDP flood; 3× portscan: Port scan in progress",
    "evidence": { "batched_events": "23" }
  }
}
```

Batching is disabled by default. The defaults (`threshold: 10`, `window: 1m`) apply the moment you set `enabled: true`.

---

## Rate limiting

`limits.max_alerts_per_minute` is a global, optional cap on how many alerts Protection dispatches per minute across all channels:

```yaml
limits:
  max_alerts_per_minute: 30   # 0 = disabled (default)
```

Once the limit is reached within a rolling one-minute window, further alerts are **dropped** (and a warning is logged, at most once per minute, so the log itself doesn't flood). This is a safety valve for pathological situations; prefer [batching](#batching) and higher `min_severity` gates for everyday noise control, and leave this at `0` unless you need a hard ceiling.

---

## Cooldown & de-duplication

Repeated findings about the same threat on the same target collapse into one alert within the `general.cooldown` window (default 5 minutes), so you don't get spammed while a miner is being dealt with. See [Actions & Rules — Cooldown](./actions-rules.md#cooldown) for exactly how events are de-duplicated.

## Next steps

- **[Actions & Rules →](./actions-rules.md)** — pair alerts with enforcement.
- **[Configuration Reference →](../configuration/reference.md#alerts)** — all alert fields.
