# Webhooks

Bandwidth Manager can push real-time event notifications to Discord, Slack, or any HTTP endpoint. Configure once, and every quota warning, daemon crash, or container discovery lands in your chat — no polling required.

[[toc]]

## Supported Platforms

| Platform       | Transport     | Features                                        |
| -------------- | ------------- | ----------------------------------------------- |
| **Discord**    | Webhook URL   | Rich embeds, emoji per event, color-coded, timestamped, footer |
| **Slack**      | Webhook URL   | Block Kit messages, color attachment bars       |
| **Generic**    | HTTP POST     | JSON payload, custom headers, basic auth        |

All platforms receive the same event types. Only the **formatting** differs — Discord and Slack get platform-native rich messages; Generic receives raw JSON.

---

## Event Types

The daemon emits the following events. You can enable or disable each one individually in your configuration.

| Event               | Trigger                                                | Default |
| ------------------- | ------------------------------------------------------ | :-----: |
| `daemon_started`    | Daemon process starts (boot or manual `bandwidth start`) | on    |
| `daemon_stopped`    | Daemon process exits gracefully                         | on      |
| `container_found`   | A new Docker container is detected and managed          | on      |
| `container_removed` | A managed container no longer exists                   | on      |
| `quota_warning`     | A container reaches the **warning threshold** (default 80% of limit) | on |
| `quota_exceeded`    | A container hits its bandwidth limit — traffic is being shaped | on |
| `reset`             | Bandwidth counters are reset via `bandwidth reset`     | off     |
| `cleanup`           | `bandwidth cleanup` runs and removes data              | off     |
| `error`             | Any non-fatal runtime error (config parse, Docker API) | on      |
| `config_updated`    | Configuration is reloaded or reapplied                 | off     |
| `tc_failed`         | A `tc` (traffic control) command fails on an interface | on      |
| `docker_error`      | Docker API returns an error (socket unreachable, permission denied) | on |

::: tip Thresholds
The warning threshold is configurable: `bandwidth configure set notifications.warning_threshold 0.75` for 75%. The `quota_exceeded` event fires when traffic hits 100% of the configured limit.
:::

---

## Discord Setup

### Getting a Webhook URL

1. Open your Discord server
2. Go to **Server Settings** → **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Give it a name (e.g. "Bandwidth Manager")
5. Choose a channel (recommend a dedicated `#bandwidth-alerts` channel)
6. Click **Copy Webhook URL**

The URL looks like:

```
https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12
```

::: warning Keep it secret
The webhook URL is a password. Anyone with it can post messages to your server. Use environment variables instead of hardcoding it in config files.
:::

### Discord Configuration Example

```yaml
# /etc/bandwidth/config.yml
notifications:
  discord:
    enabled: true
    webhook_url: "${DISCORD_WEBHOOK_URL}"   # from environment variable
    events:
      daemon_started: true
      daemon_stopped: true
      container_found: true
      container_removed: true
      quota_warning: true
      quota_exceeded: true
      tc_failed: true
      docker_error: true
      error: true
      config_updated: false
      reset: false
      cleanup: false
    retry:
      max_retries: 5
      backoff_base: 2s
```

Then export the variable before starting the daemon:

```bash
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
bandwidth start
```

Or drop it in a systemd override:

```ini
# /etc/systemd/system/bandwidth.service.d/override.conf
[Service]
Environment="DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/..."
```

### How Discord Embeds Look

Each event maps to a Discord [rich embed](https://discord.com/developers/docs/resources/message#embed-object) with:

| Embed Field     | Content                                                |
| --------------- | ------------------------------------------------------ |
| **Title**       | Event name + affected container/interface (if applicable) |
| **Description** | Human-readable summary (e.g. "web-app reached 90% of its 50 Mbps RX limit") |
| **Color**       | Event-specific color (see below)                       |
| **Emoji**       | Event-specific icon in the embed title                 |
| **Timestamp**   | ISO 8601 timestamp of the event                        |
| **Footer**      | "Bandwidth Manager v2.4.1 · AnAverageBeing"            |

**Event Colors:**

| Event               | Color  | Emoji | Hex       |
| ------------------- | :----: | :---: | --------- |
| `daemon_started`    | Green  | 🟢    | `#57F287` |
| `daemon_stopped`    | Yellow | 🟡    | `#FEE75C` |
| `container_found`   | Blue   | 🔵    | `#5865F2` |
| `container_removed` | Gray   | ⚫    | `#80848E` |
| `quota_warning`     | Orange | 🟠    | `#FAA61A` |
| `quota_exceeded`    | Red    | 🔴    | `#ED4245` |
| `reset`             | Purple | 🟣    | `#9B59B6` |
| `cleanup`           | Teal   | 🧹    | `#1ABC9C` |
| `error`             | Red    | ❌    | `#ED4245` |
| `config_updated`    | Blue   | 🔧    | `#3498DB` |
| `tc_failed`         | Red    | 🚫    | `#E74C3C` |
| `docker_error`      | Red    | 🐳    | `#E74C3C` |

::: info Rate limits
Discord allows 30 messages per minute per webhook. The daemon batches events that occur within the same second and respects this limit. If you have many containers, increase the `quota_warning` threshold or reduce enabled events.
:::

---

## Slack Setup

### Slack Configuration Example

```yaml
# /etc/bandwidth/config.yml
notifications:
  slack:
    enabled: true
    webhook_url: "${SLACK_WEBHOOK_URL}"
    events:
      quota_warning: true
      quota_exceeded: true
      daemon_stopped: true
      error: true
      tc_failed: true
      docker_error: true
    channel: "#bandwidth-alerts"    # override if different from webhook default
    username: "Bandwidth Bot"       # custom display name
```

Slack messages use [Block Kit](https://api.slack.com/block-kit) formatting with:

- A colored attachment bar (matching the event severity)
- Bold title with event type
- Markdown body with container name, current usage, and limit
- Timestamp in the footer

```
 ┌─────────────────────────────────────────────────────────┐
 │ 🔴 quota_exceeded                                       │
 │                                                         │
 │ Container `api-worker` has reached its 100 Mbps limit.  │
 │ Current: 100.2 Mbps | Limit: 100 Mbps                   │
 │                                                         │
 │ Bandwidth Manager v2.4.1 · Jun 30, 2026 09:18:44 UTC   │
 └─────────────────────────────────────────────────────────┘
```

---

## Generic HTTP Webhooks

Send JSON payloads to an arbitrary HTTP endpoint.

```yaml
# /etc/bandwidth/config.yml
notifications:
  generic:
    - name: "internal-monitoring"
      enabled: true
      url: "https://monitoring.internal.example.com/hooks/bandwidth"
      method: POST
      headers:
        Authorization: "Bearer ${MONITORING_API_TOKEN}"
        X-Event-Source: "bandwidth-manager"
      events:
        quota_warning: true
        quota_exceeded: true
        error: true
      retry:
        max_retries: 3
        backoff_base: 5s
```

Payload format:

```json
{
  "event": "quota_exceeded",
  "timestamp": "2026-06-30T09:18:44Z",
  "daemon_version": "2.4.1",
  "data": {
    "container": "api-worker",
    "interface": "eth0",
    "direction": "rx",
    "current_mbps": 100.2,
    "limit_mbps": 100,
    "usage_pct": 100.2
  }
}
```

You can configure multiple generic endpoints — each is a list item under `notifications.generic`.

---

## Testing Webhooks

After configuring webhooks, verify they work:

```bash
bandwidth webhook test
```

This sends a synthetic `test` event to **all** enabled webhooks and reports delivery status:

```
$ bandwidth webhook test
  Discord: ✔ Delivered (HTTP 204) — 312ms
  Slack:   ✔ Delivered (HTTP 200) — 287ms
  Generic (monitoring): ✘ Failed — connection refused

  Hint: Check that the monitoring endpoint is reachable from this host.
  Try: curl -X POST https://monitoring.internal.example.com/hooks/bandwidth
```

To test only a specific platform:

```bash
bandwidth webhook test --platform discord
bandwidth webhook test --platform slack
bandwidth webhook test --platform generic
```

::: tip Testing in CI/CD
`bandwidth webhook test` exits with code 0 only if **all** configured webhooks succeed. You can use this in deployment scripts to verify webhook connectivity after provisioning.
:::

---

## Retry Behavior

When a webhook delivery fails, the daemon retries with exponential backoff.

| Setting         | Default | Description                                               |
| --------------- | :-----: | --------------------------------------------------------- |
| `max_retries`   | `5`     | Maximum delivery attempts per event                       |
| `backoff_base`  | `2s`    | Initial delay; doubles each attempt (`2s → 4s → 8s → …`)  |
| `max_backoff`   | `60s`   | Cap on backoff delay (hardcoded)                          |

**Retry sequence example (max_retries: 5):**

```
Attempt 1: immediate      → HTTP 503 (server error)
Attempt 2: after 2s       → connection timeout
Attempt 3: after 4s       → HTTP 503
Attempt 4: after 8s       → HTTP 429 (rate limited)
Attempt 5: after 16s      → HTTP 204 ✔
```

If all retries fail, the event is **dropped** and an error is logged:

```
2026-06-30T09:18:44Z ERROR Discord webhook failed after 5 attempts — event 'quota_exceeded' dropped
```

::: warning No persistent queue
The current version does **not** persist failed webhook events to disk. A daemon restart clears the retry queue. For durable delivery, route events through the Generic webhook to a message broker (RabbitMQ, NATS, Redis Streams).
:::

---

## Troubleshooting

### 1. Check Daemon Logs

Webhook delivery attempts (success and failure) are logged at `info` and `error` levels:

```bash
bandwidth logs --level info | grep webhook
```

```
2026-06-30T09:18:44Z INFO  Webhook 'discord' delivered (204, 312ms)
2026-06-30T09:19:01Z ERROR Webhook 'slack' failed: HTTP 403 (invalid token)
```

### 2. Verify URL with curl

Replicate exactly what the daemon sends:

```bash
# Discord
curl -X POST "$DISCORD_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"content": "Bandwidth Manager test — ignore me"}'

# Slack
curl -X POST "$SLACK_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"text": "Bandwidth Manager test — ignore me"}'

# Generic
curl -X POST "https://your-endpoint/hooks/bandwidth" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MONITORING_API_TOKEN" \
  -d '{"event": "test", "data": {}}'
```

If `curl` gets a different response than the daemon does, check:

- Environment variable resolution (`${VAR}` syntax in config)
- Network access from the daemon's host (Docker containers may have different network views)
- TLS certificate validity (the daemon uses the system trust store)

### 3. Firewall

The daemon makes **outbound** HTTPS connections to:

| Platform    | Destination                             | Port |
| ----------- | --------------------------------------- | :--: |
| Discord     | `discord.com`                           | 443  |
| Slack       | `hooks.slack.com`                       | 443  |
| Generic     | Whatever you configured                 | Any  |

If your firewall restricts outbound traffic, whitelist these destinations.

### 4. Discord Returns HTTP 401

- The webhook URL is wrong or has been revoked
- Re-copy it from **Server Settings → Integrations → Webhooks**
- If the webhook was deleted, create a new one and update your config

### 5. Discord Returns HTTP 429 (Rate Limited)

- You're sending more than 30 messages/minute
- Reduce the number of enabled events
- Increase the polling interval: `bandwidth configure set daemon.poll_interval 10s`
- Consider batching: adjust `notifications.batch_window` (default `1s`)

### 6. Slack Returns HTTP 403

- The webhook URL might be for a deprecated "legacy" integration
- Create a new Slack App → Incoming Webhooks → install to workspace

### 7. Generic Endpoint Times Out

- The daemon's HTTP client has a 10-second timeout
- If your endpoint takes longer, use a queue-worker pattern:
  - Point the Generic webhook at a lightweight receiver (nginx, Express, FastAPI)
  - The receiver acknowledges immediately and enqueues the event
  - A worker processes events asynchronously

---

## Configuration Reference

```yaml
notifications:
  # Global retry settings (override per-platform)
  retry:
    max_retries: 5
    backoff_base: 2s
  # Batch events within this window
  batch_window: 1s

  discord:
    enabled: true
    webhook_url: "${DISCORD_WEBHOOK_URL}"
    events:
      daemon_started: true
      daemon_stopped: true
      container_found: true
      container_removed: true
      quota_warning: true
      quota_exceeded: true
      reset: false
      cleanup: false
      error: true
      config_updated: false
      tc_failed: true
      docker_error: true

  slack:
    enabled: false
    webhook_url: "${SLACK_WEBHOOK_URL}"
    channel: "#alerts"
    username: "Bandwidth Manager"
    events:
      quota_exceeded: true
      error: true

  generic:
    - name: "opsgenie"
      enabled: false
      url: "https://api.opsgenie.com/v2/integrations/bandwidth/events"
      method: POST
      headers:
        Authorization: "GenieKey ${OPSGENIE_API_KEY}"
      events:
        quota_exceeded: true
        daemon_stopped: true
```

::: tip Environment Variables
Always use `${ENV_VAR}` syntax for secrets instead of hardcoding URLs and tokens. The daemon resolves these at startup. Unknown variables are left as literal strings (which will cause webhook failures) — check `bandwidth config` to verify resolution.
:::
