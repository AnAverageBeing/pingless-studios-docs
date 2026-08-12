# Blackhole (Per-IP Total Drop)

Blackholing an IP drops **every** packet destined to it, at the earliest possible point in the firewall — for as long as the blackhole is active. It is the "take this tenant off the air" switch for dedicated hosts: when one VPS IP is eating a flood big enough to endanger the whole box, you sacrifice that one address and everything else stays fast.

## The one exception: established players stay online

A blackhole is not a brick wall for people who were already playing. Sources with an **established TCP connection** to the blackholed IP — a real, completed handshake — keep passing. Crucially, they are exempt *from the blackhole only*: rate limits, suspicion scoring and bans still apply to them like anyone else.

When an established source goes quiet, a grace timer starts (default **10 minutes**). Reconnect within the window and you're straight back in — the timer resets. If the window lapses, the source loses its exemption and is dropped like everyone else until the blackhole ends. No new connections can be established while a blackhole is active — that's the point.

::: warning UDP services
The established exemption needs a handshake to observe, and UDP has none (the firewall sees inbound packets only, so "two-way UDP" can't be proven). During a blackhole of a UDP-only service (Minecraft Bedrock, FiveM, voice), **all** UDP sources are dropped, players included. For TCP services (Minecraft Java, websites, APIs, SFTP) established players ride through.
:::

## Manual blackhole

```bash
openshield blackhole add 203.0.113.10              # until disabled
openshield blackhole add 203.0.113.10 --seconds 300  # timed: 5 minutes
openshield blackhole list                           # active blackholes + remaining time
openshield blackhole remove 203.0.113.10            # lift one
openshield blackhole clear                          # lift all
```

The TUI's **IPs** tab shows blackhole state per attached IP and lets you toggle it; the dashboard banner tells you whenever any blackhole is active, and blackhole drops get their own row in the Drop Paths panel. IPv6 works identically.

## Auto-blackhole

Off by default. When enabled, the firewall watches the inbound rate of each **attached** IP (see [Attached IPs](attached-ips.md) — the registry is what keeps auto-blackhole from ever touching an address you don't manage) and blackholes it when an attack crosses your magnitude:

```yaml
blackhole:
  enabled: true            # master switch for the whole feature
  auto_enabled: false      # opt-in: let the firewall blackhole on its own
  auto_pps: 500000         # trigger: inbound packets/sec to one IP (0 = ignore)
  auto_bps: 0              # trigger: bytes/sec to one IP (0 = ignore)
  auto_sustain_sec: 5      # rate must hold this long (anti-spike)
  auto_duration_sec: 300   # blackhole lasts this long...
  grace_minutes: 10        # established-source grace window
```

If the attack is still over the trigger when the timer expires, the blackhole extends for another `auto_duration_sec` — no flapping. Every automatic and manual blackhole/lift posts an alert (Discord/webhook) with the IP, the rate that caused it, and whether it was automatic.

## What blackhole is *not*

- It does not replace per-source bans — those still handle the attackers themselves. Blackhole answers "the target is more expensive to defend than to sacrifice."
- It never touches your management access: the admin whitelist is evaluated *before* the blackhole, so whitelisted sources always get through.
- Auto-blackhole requires the target to be an attached IP. If you see floods hitting addresses the registry doesn't know, attach them (or their subnet) first.

## Metrics

`/metrics` exposes active blackholes (per-IP: manual/auto, time remaining), cumulative blackhole-dropped packets, the live exemption count, and auto-blackhole event totals — see [Metrics & API](../user-guide/metrics-api.md) for field names.
