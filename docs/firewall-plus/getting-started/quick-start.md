---
title: Quick Start
description: Get Firewall-Plus protecting your first Pterodactyl server in under five minutes.
---

# Quick Start

Assumes the panel extension is installed, the node daemon is running on your Wings host, and the scheduler cron + queue worker are active. If not, start with [Installation](./installation).

## 1. Add the node (admin)

1. On the Wings host, grab the token: `sudo cat /etc/firewall-plus/token`
2. Panel → **Admin → Firewall → Nodes → Add Node**
3. Select the Wings node, enter the FQDN (**plain HTTP** — do not enable HTTPS for the firewall port), paste the token
4. Wait for the health check — the node shows **ONLINE** with its version

## 2. Enable Firewall-Plus on a server (server owner)

1. Open the server → **Firewall** tab
2. Toggle **Firewall-Plus for this server** on
3. Accept the Terms of Service (required before any mutation)

Rules are never pushed to a node until this per-server toggle is on. Turning it off queues a flush of that server's chains.

## 3. Add rules and apply

1. In the **Rules** tab, add a rule — e.g. a **SYN limit** scoped to your game port, or pick a **game preset** from the Presets tab
2. Optionally add trusted IPs to the **Whitelist** or attackers to the **Blacklist**
3. Click **Apply firewall**

The apply is queued (`ApplyFirewallRulesJob`), sent to the node, and applied atomically via `iptables-restore` with a snapshot + automatic rollback. The UI polls apply status until it lands.

## 4. Verify on the node (optional, root)

```bash
iptables -L FWP-<serverId> -n -v
iptables -L FWP-<serverId>-<port> -n -v   # per-port scoped rules
ipset list fwp-wl-<serverId>
```

## 5. (Optional) Enable SMART detection

SMART must be **granted per server by an admin** first:

1. Admin → **Firewall → Servers** → grant **SMART mode** for the server
2. Server owner: **Firewall → SMART tab** → enable SMART mode, optionally set a Discord webhook
3. Re-apply the firewall — the apply payload now carries `smart.enabled: true`

The node starts its EWMA monitor; on anomaly it escalates L1→L3 mitigations with cooldowns, logs the attack event, and notifies the owner via Discord webhook and email (if the admin enabled owner email alerts).

## What's next

- [Rule Types](../user-guide/rules) — what each of the 13 rule types actually does
- [Configuration Reference](../configuration/reference) — node config, env vars, admin settings
- [CLI Reference](../user-guide/cli) — artisan commands and node scripts
