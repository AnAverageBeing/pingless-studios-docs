---
title: Quick Start
description: NitroCord in 60 seconds for existing Velocity users — swap the jar, add your license key, start. Plus the five protection.toml tweaks worth making first.
---

# Quick Start

Already running Velocity? NitroCord is a drop-in fork: your `velocity.toml`, backends, forwarding secret and every Velocity plugin keep working unchanged. You can be protected in about 60 seconds.

## The 60-second path

```bash
# 1. Stop your Velocity proxy, then drop the NitroCord jar into the same directory.

# 2. Add your license key to nitrocord.toml (create the line if the file
#    does not exist yet — it is generated on first start):
#    license-key = "PL-XXXX-XXXX-XXXX-XXXX"

# 3. Start NitroCord exactly like you started Velocity:
java -jar NitroCord-<version>-all.jar
```

Done. When the console prints `License verified - thank you for supporting NitroCord.`, the full protection engine is live — attack mode, firewall, rate limiting, anti-bot checks, anti-VPN blocklists, packet flood scoring — all with tuned defaults. No other configuration is required.

::: info New to Velocity entirely?
Follow the full [Installation](/nitrocord/getting-started/installation) instead — it covers Java 25, the kernel firewall prerequisites and post-install verification.
:::

## The 5 tweaks worth making first

Defaults are production-safe, but these five knobs in `protection.toml` are the ones most admins adjust to their network. Everything below is applied live with `/nitrocord reload` — no restart needed.

### 1. Firewall ban duration

```toml
[firewall]
ban-time-seconds = 60
```

How long an IP stays firewalled after tripping protection. The 60-second default sheds drive-by bots; raise it (e.g. `300`–`600`) if the same sources keep coming back, or lower it on shared hosting where players sit behind carrier NAT.

### 2. Attack-mode sensitivity

```toml
[attack]
activate-connections-per-second = 40
deactivate-delay-seconds = 60
```

Attack mode engages when the proxy-wide connection rate exceeds 40/s and disengages after 60 quiet seconds. Big networks with legitimately high join rates should raise the threshold so normal traffic never escalates checks.

### 3. Online anti-VPN checks

```toml
[antivpn]
online-check = false
proxycheck-key = ""
iphub-key = ""
```

The seven offline blocklists are already active. Add a [proxycheck.io](https://proxycheck.io/) or [IPHub](https://iphub.info/) API key and set `online-check = true` to also query those providers for IPs the local lists miss. Results are cached per IP (`cache-minutes = 60`) and persisted across restarts.

### 4. Country blocking

```toml
[country]
enabled = false
maxmind-license-key = ""
blacklist = []
```

Disabled by default because it needs your own (free) [MaxMind key](https://www.maxmind.com/en/geolite2/signup). Set the key, `enabled = true`, and add ISO 3166-1 alpha-2 codes to `blacklist` — e.g. `["CN", "RU"]` — to deny joins from those countries. The GeoLite2 database downloads and updates itself.

### 5. Accounts per IP

```toml
[accounts]
enabled = true
limit = 3
firewall-on-trigger = true
```

How many distinct nicknames one IP may join with before new ones are kicked — the classic bot-flood signature. Lower it to `2` if you are being hammered by name-generated floods; raise it for schools, cafés or households sharing one connection.

::: tip
Every key is documented inline — `protection.toml` ships with a comment above each setting, and new keys from updates are merged into your file automatically. Read it once end to end; it is the whole protection engine on one page.
:::

## Next steps

- [Installation](/nitrocord/getting-started/installation) — prerequisites, kernel firewall, verification checklist, troubleshooting.
- [Licensing](/nitrocord/getting-started/licensing) — seats, offline grace and what happens when the license server is unreachable.
- Run `/nitrocord` in-game (permission `nitrocord.admin`) for `stats`, `reload` and manual `firewall add|remove <ip>`.
