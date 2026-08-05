---
title: For Server Owners — Using Your Firewall
description: Plain-language guide to Firewall-Plus for game server owners. No networking knowledge needed — enable it, pick your game, and you're protected.
---

# For Server Owners — Using Your Firewall

This guide is for **you**, the server owner. No networking knowledge needed. Your host has already done the hard part — you just turn it on.

## What does this thing actually do?

Firewall-Plus puts a bouncer in front of your game server. It watches the traffic coming into **your server's ports** (and only yours) and can:

- **Slow down or block floods** — when someone tries to knock your server offline with junk traffic (a "DDoS attack"), it limits how fast packets can arrive
- **Block troublemakers** — ban specific IP addresses from connecting (blacklist)
- **Roll out the red carpet** — always allow your own IP or your friends' IPs (whitelist)
- **Protect you automatically** — with SMART mode, it notices an attack by itself and starts blocking it, then emails you about it

::: info Good to know
Your firewall **cannot** break anything outside your server. It only touches your assigned game port(s) — never the host's SSH, panel, or other customers' servers.
:::

## First-time setup (about 2 minutes)

You only do this once.

### 1. Open the Firewall tab

Open your server in the panel and click **Firewall** in the menu.

### 2. Turn it on

Go to the **Settings** tab (the sliders icon) and switch on **"Enable Firewall-Plus for this server"**.

If you see a Terms of Service box, read it and click **I accept** — your host requires this before you can change anything.

### 3. Pick your game (the easy button)

Open the **Rules** tab and click **Presets**. Choose the preset for your game (Minecraft, Rust, CS2, ARK, Palworld, Valheim…) and apply it. The preset adds a sensible set of protections tuned for that game — you're done configuring.

::: tip
Not sure which rules you need? Just use the preset. You can always tweak individual rules later.
:::

### 4. Apply

Click **Apply firewall**. The rules are sent to the machine your server runs on and start working within seconds. The status line in Settings will show **"In sync with node"** when it's live.

## Everyday things you'll want to do

### Block someone (blacklist)

**Rules → Blacklist → Add entry**, paste their IP address (e.g. `203.0.113.50`), save. They can no longer reach your server. You can also block a whole range like `203.0.113.0/24`.

You can set an expiry so the ban lifts itself automatically.

### Always allow yourself or a friend (whitelist)

**Rules → Whitelist → Add entry**, add the IP. Whitelisted IPs skip the rate limits — useful for your own connection so you never get caught by your own protections.

::: warning
Whitelist only IPs you trust. A whitelisted IP bypasses your flood protections (on your ports only).
:::

### Slow down connection spam

The preset already includes these, but the useful ones in plain terms:

| Rule | What it does in plain English |
|------|-------------------------------|
| SYN limit | Stops "fake connection" floods — the most common attack on game servers |
| Connection limit | One IP can't hold more than X connections to your server at once |
| New connection rate | Limits how fast new players (or bots) can connect per second |
| UDP limit | Slows UDP floods — important for games that use UDP (Minecraft Bedrock, Rust, Source games) |

### Check what's happening

The **Dashboard** tab shows live graphs: packets per second, bandwidth, top talking IPs, and which rules are blocking the most traffic. During an attack you'll see the spike here.

### Look at the logs

The **Logs** tab shows what the firewall did and when — rules applied, attacks detected, bans added.

## When you get attacked

If SMART protection is on (your host may need to enable it for your server):

1. **It handles the attack automatically** — traffic gets throttled or dropped in escalating steps until the flood stops
2. **You get an email** — "attack detected" when it starts and "all clear" when it's over (one email per 5 minutes max, so no spam)
3. **You see a red banner** on your Firewall dashboard — click **Ack all** to mark events as seen

::: tip Get alerts in Discord too
In the **SMART** tab you can paste a Discord webhook URL and pick which events you want posted to your Discord. If SMART is on and you haven't set this up, the panel will nudge you with a "Get attack alerts" hint.
:::

## Common questions

**Will this increase my ping?**
No measurable difference. The rules run inside the host's network card path and are designed for game traffic.

**Can I lock myself out of my server?**
No. The firewall only watches your game port — it can't touch the panel, console, or SFTP. If you misconfigure something, just disable the rule (or the whole firewall) from the same tab.

**Do I need to re-apply after changing rules?**
The panel queues changes automatically in most cases. If you see "Out of sync with node", just click **Apply firewall**.

**My rules disappeared after my server moved to another node.**
That's normal — the firewall detects the move, cleans up the old machine, and re-applies your rules to the new one automatically.

**What can't it do?**
It protects the network path to your server. It can't fix a laggy plugin, a full CPU, or an attacker who knows your players' passwords — keep your server software updated too.

## Quick reference

| You want to… | Go to |
|---|---|
| Turn the firewall on/off | **Settings** tab |
| Add or edit protections | **Rules** tab (or **Presets**) |
| Ban an IP | **Rules → Blacklist** |
| Always allow an IP | **Rules → Whitelist** |
| See live traffic graphs | **Dashboard** tab |
| See what happened earlier | **Logs** tab |
| Set up Discord attack alerts | **Rules → SMART** |
| Save/restore your config | **Settings** (import/export) |
