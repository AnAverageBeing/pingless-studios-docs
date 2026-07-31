---
title: Webhooks & Alerts
description: Sentinel alert channels — Discord embeds, a generic JSON webhook, and SMTP email via the panel mailer — with per-channel minimum severity, cooldown and rate limiting.
---

# Webhooks & Alerts

Alerts are dispatched **panel-side only**. When an event batch arrives at `POST /api/sentinel/node/events`, the panel evaluates each event against the configured channels and sends notifications. Nodes never see webhook URLs, SMTP credentials or recipients — those secrets live exclusively in the panel database (`sentinel_settings` under the `alerts` key).

Three channels, configured under **Sentinel → Settings → Alert Channels**. Each has an enable switch, a destination, and a **minimum severity**: the channel only fires for events at or above that severity.

---

## Discord

Rich embed alerts to a Discord channel.

1. In Discord: channel settings → Integrations → Webhooks → **New Webhook**, copy the URL.
2. In the panel: Settings → Alert Channels → enable **Discord**, paste the URL, pick a `min_severity` (default `high`), save.

The URL is validated server-side and must match `https://(canary.|ptb.)?discord(app)?.com/api/webhooks/…` — a non-Discord URL is rejected with a validation error.

Each alert is an embed containing the event title, severity (color-coded), category and detector, the attributed server and node, process/path detail, actions taken, and a dry-run marker when applicable.

::: tip
Keep Discord at `high` or `critical`. At `medium` you will see every port scan and zip-bomb ratio hit — noisy on a busy fleet.
:::

## Generic JSON webhook

POSTs the event as JSON to any `http(s)://` endpoint — for Slack bridges, PagerDuty, Grafana OnCall, ntfy, or your own automation.

1. Enable **Webhook**, paste the endpoint URL, pick `min_severity` (default `high`), save.
2. Your endpoint receives a JSON POST per qualifying event with the event fields: `uuid`, `occurred_at`, `category`, `detector`, `severity`, `title`, server/node attribution, `process`, `path`, `evidence`, `actions_taken`, and `dry_run`.

Minimal receiver for testing:

```bash
# on any reachable host
python3 -m http.server 9000 &
# (or use a request-bin service to inspect the payload shape)
```

## SMTP email

Sends alert email through the panel's configured mailer — Sentinel uses whatever mail transport the panel already has (`MAIL_*` in the panel `.env`: SMTP, Mailgun, SES, …). There is no separate Sentinel SMTP configuration.

1. Make sure panel mail works first (a working "forgot password" email is the proof).
2. Enable **SMTP**, enter **recipients** as a space- or comma-separated list — every address is validated and the save fails on the first invalid one.
3. Pick `min_severity` (default `critical` — email is the noisiest channel to read, so it defaults to the quietest setting).

---

## Severity filtering, cooldown and rate limiting

Alerts are subject to three independent gates, in order:

1. **Per-channel `min_severity`.** An event below the channel's threshold is never sent there. Severity ranks: `low` < `medium` < `high` < `critical`; the threshold is inclusive.
2. **Cooldown.** Repeat notifications for the same target are suppressed within the cooldown window, so a miner re-firing every cooldown period does not produce a message per detection.
3. **Rate limit + batching.** Outbound alerts are rate-limited and batched so a detection storm (say, a fleet-wide volume scan finding hundreds of files) produces a digest rather than hundreds of Discord posts — and Discord's own webhook rate limits are not tripped.

**Muted servers** (`whitelist.servers`, or the mute toggle on the Servers tab) suppress alerts entirely while still recording events. **Dry-run** events are marked as such in the message rather than suppressed — you see exactly what would have been enforced.

---

## Recommended starting setup

| Channel | min_severity | Why |
| --- | --- | --- |
| Discord | `high` | kills, quarantines, escapes — the stuff you want to see same-day |
| Webhook | `high` | feed your automation/ticketing |
| SMTP | `critical` | only miners at full tilt, escapes, confirmed malware — things worth waking someone up |

Watch the feed for a week in dry-run, then adjust. If a channel feels noisy, raise its severity before you disable it — the graduated defaults are tuned so `high` and up is almost always actionable.
