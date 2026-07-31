---
title: Webhooks & Alerts
description: Panel Firewall webhook notifications — Discord-compatible alerts for attacks, mitigations, applies, and rollbacks, with HMAC secrets and SSRF protection.
---

# Webhooks & Alerts

Panel Firewall can POST JSON events to Discord-compatible webhook URLs when things happen — attacks detected, mitigations applied/cleared, firewall applied or rolled back. Webhooks are managed in **Admin → Panel Firewall → Webhooks** and synced to the daemon on save.

---

## Setup

1. In Discord: **Server Settings → Integrations → Webhooks → New Webhook**, copy the URL.
2. In the panel: **Admin → Panel Firewall → Webhooks → Add webhook**.
3. Paste the URL, pick the events you care about, optionally set a secret, save.
4. The panel pushes the webhook set to the daemon (`POST /api/v1/webhooks/sync`). Done — the next event fires a delivery.

::: warning URL restrictions (SSRF protection)
Webhook URLs must be **HTTPS** and resolve to **public IP addresses only**. The panel resolves *all* A records, rejects the URL if any is private/reserved (loopback, RFC-1918, link-local, cloud metadata `169.254.169.254`), and pins the validated IP for the actual request so DNS-rebinding can't redirect it at your internal network. If your Discord URL is rejected, that's why.
:::

---

## Events

| Event | Fired when |
|---|---|
| `attack_detected` | SMART EWMA detector flags an anomaly (includes level, confidence, metrics) |
| `mitigation_enabled` | A mitigation level (L1–L3) is applied |
| `mitigation_disabled` | Mitigation cleared — cooldown expired or SMART disabled |
| `firewall_applied` | A successful transactional apply |
| `firewall_rollback` | Manual rollback, or the 60s confirm window expired |
| `reconcile_drift` | The reconcile loop finds kernel state diverging from desired state |

The panel also dispatches its own hooks on apply, confirm, and manual rollback, so events still fire for panel-initiated actions even if the daemon is mid-transaction.

## Payload

Each delivery is a JSON POST with the event name, timestamp, severity, and a details object (e.g. anomaly metrics and confidence for attacks, checkpoint id for applies). If a **secret** is set, the payload is HMAC-signed so your receiver can verify authenticity.

```json
{
  "event": "attack_detected",
  "at": 1754000000,
  "actor": "daemon:smart",
  "details": {
    "level": 2,
    "confidence": 0.71,
    "anomalies": [{ "metric": "cps_in", "confidence": 0.71 }]
  }
}
```

---

## Delivery behavior

- **Retries** — failed deliveries are retried with backoff before being marked failed
- **Rate limited** — a flood of events can't flood your Discord channel
- **Logged** — every attempt lands in the daemon's `webhook_log`; view it in the admin UI or via `GET /api/v1/webhooks/log` (`at`, `event`, `url`, `statusCode`, `outcome`)

---

## Troubleshooting

::: details No deliveries at all
Check the webhook log in the admin UI. `outcome=failed` with a DNS error means the URL didn't resolve; `statusCode=401/404` means the Discord webhook was deleted or the URL is wrong — regenerate it.
:::

::: details "URL rejected" when saving
The URL failed the SSRF guard: not HTTPS, or it resolves to a private/reserved IP. Discord webhooks are public HTTPS — if a Discord URL is rejected, check the host's DNS (`dig discord.com`) for hijacked/filtered records.
:::

::: details Deliveries stopped after an import
Webhook **secrets are never exported** (bundles show `[REDACTED]`). After importing a bundle on a new install, re-enter the secrets manually.
:::
