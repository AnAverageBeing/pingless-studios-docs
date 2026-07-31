---
title: Quick Start
description: The five-minute path — install the Sentinel panel addon, pair one node, watch the first detections arrive, and switch off dry-run when you are ready to enforce.
---

# Quick Start

This is the fastest safe path from zero to a working Sentinel deployment: panel addon, one paired node, first events in the feed, then live enforcement. Budget about five minutes per node after the panel is installed.

::: warning
Sentinel ships with `dry_run: true` by default. Detections are logged and reported, but **nothing is killed, paused, stopped or suspended** until you turn dry-run off. Keep it on while you tune, then disable it in step 5.
:::

---

## 1. Install the panel addon (2 minutes)

Blueprint:

```bash
cd /var/www/pterodactyl
blueprint -i pterodactylsentinel-v1.0.0
```

Or standalone:

```bash
sudo PTERODACTYL_DIRECTORY=/var/www/pterodactyl bash standalone/install.sh
```

Open your panel's admin area — you should see **Sentinel** in the sidebar with the Dashboard, Detections, Nodes, Servers, Scans, Intel, Quarantine and Settings tabs.

## 2. Create a node token (30 seconds)

Go to **Sentinel → Nodes**, find the Pterodactyl node you want to protect, and click **Create token**. Copy the 64-hex token — you will paste it into the node installer.

## 3. Install the agent on the node (2 minutes)

On the Wings node, as root:

```bash
sudo bash node-module/install.sh
```

Answer the four prompts (panel URL, token, listen address `0.0.0.0`, port `8481`). The installer writes `/etc/sentinel/config.yaml` and `/etc/sentinel/token` (both `0600`), installs `sentinel-node.service`, starts it, and waits for registration.

Allow the panel to reach the node's API:

```bash
sudo ufw allow from <panel-ip> to any port 8481 proto tcp
```

Verify:

```bash
curl -s http://127.0.0.1:8481/api/v1/health
```

Back in **Sentinel → Nodes**, the card flips to **online** with the agent version and a current last-seen time.

## 4. See your first events (1 minute)

The agent is already scanning: process and connection detectors tick every 5 seconds, container scans every 3 minutes, volume scans every 15 minutes.

To see the detector output immediately, run a one-off pass on the node (no enforcement, nothing shipped):

```bash
sentinel scan
```

```text
[
  {
    "uuid": "3f6c…",
    "category": "abuse",
    "detector": "abuse",
    "severity": "high",
    "title": "hosting abuse service detected",
    "server_uuid": "d8321c4e-…",
    "process": "/usr/bin/xmrig -o pool.minexmr.com:4444",
    ...
  }
]
1 finding(s)
```

Live detections flow to **Sentinel → Detections** within seconds, attributed to the exact server. The Dashboard tiles update on the next page load.

## 5. Go live: disable dry-run

When you are comfortable with what Sentinel flags on your fleet:

1. Open **Sentinel → Settings → General**.
2. Set **Dry run** to off and save.
3. The panel bumps `config_version` and pushes the new config to every online node; each node applies it atomically and confirms in **Nodes → config version**.

Enforcement now follows the built-in rules: miners and abuse tooling at high severity get their processes killed; critical detections stop the container and suspend the server (panel-side, via `SuspensionService`); malware is quarantined. Review and adjust the policy under **Settings → Enforcement Rules** before or after going live.

---

## Next steps

- Tune thresholds per detector: [Configuration Reference](../configuration/reference.md).
- Learn every tab: [Admin Panel](../user-guide/admin-panel.md).
- Wire up Discord/webhook/email alerts: [Webhooks & Alerts](../user-guide/webhooks.md).
- Understand the pipeline: [Architecture](../architecture/overview.md).
