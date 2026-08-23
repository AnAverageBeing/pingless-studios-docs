---
title: CLI Reference
description: Every GameFilter XDP command — load, unload, status, reload, whitelist/blacklist management, config, key, daemon, license (stub), and version — with syntax and example output.
---

# CLI Reference

All commands operate on the live filter through the pinned maps under `/sys/fs/bpf/gamefilter/` — list and status commands work whether or not the API daemon is running. Everything except `version` and `license` needs root.

```bash
gamefilter <command> [options]
```

[[toc]]

---

## `load`

Load the eBPF object, populate the maps from the config, attach XDP to the configured interface, and exit — the program stays resident via the pinned link.

```bash
sudo gamefilter load [--config /etc/gamefilter/gamefilter.yaml]
```

```
GameFilter XDP loaded on eth1 (native mode), 6 filters.
default_action: drop — only filtered/whitelisted traffic passes.
Use `gamefilter unload` to detach.
```

- Attach tries **native** (driver) mode first, falls back to **generic** (SKB) mode automatically.
- Pins the link at `/sys/fs/bpf/gamefilter/link` and all maps under `/sys/fs/bpf/gamefilter/maps/`, writes `/var/lib/gamefilter/state.json`.
- Seeds the static `whitelist:`/`blacklist:` from the config.
- Fails fast on unknown protocols/validators, bad port specs, or more than 64 filters.

**When to use:** once at boot (the `gamefilter-loader.service` systemd unit runs exactly this).

## `unload`

Detach the filter and clean up.

```bash
sudo gamefilter unload
```

```
GameFilter XDP unloaded.
```

Removes the link pin, the whole `/sys/fs/bpf/gamefilter` pin directory, and the state file. Prints `GameFilter XDP is not loaded.` (and changes nothing) when the filter isn't attached.

## `status`

Show global and per-filter counters.

```bash
sudo gamefilter status [--json]
```

```
GameFilter XDP is loaded.
  Interface: eth1 (native)
  Packets: 128412 passed, 9033 dropped | validated ok 4210 fail 8801 | admitted 120244 | banned 17
  [ 0] mc-java        tcp ports=25565              pass=52100 drop=1200
  [ 1] mc-bedrock     udp ports=19132              pass=61302 drop=7715
  [ 2] source-engine  udp ports=27015-27050        pass=15010 drop=118
```

Exits with code **1** when the filter is not loaded (script-friendly).

With `--json` it prints the same snapshot the API's `/api/v1/stats` serves:

```json
{
  "loaded": true,
  "generated_at": 1755931200,
  "system": { "interface": "eth1", "xdp_mode": "native", "loaded_at": 1755924000, "version": "1.0.0" },
  "global": { "passed": 128412, "dropped": 9033, "validated_ok": 4210, "validated_fail": 8801, "admitted_hits": 120244, "banned": 17 },
  "filters": [
    { "slot": 0, "name": "mc-java", "protocol": "tcp", "ports": "25565", "validator": "mc_java",
      "passed": 52100, "dropped": 1200, "validated_ok": 2400, "validated_fail": 1200, "admitted_hits": 49700, "banned": 9 }
  ],
  "lists": { "whitelisted": 2, "blacklisted": 26 },
  "admissions": { "active": 4312 }
}
```

Counter meanings: `passed`/`dropped` are total verdicts; `validated_ok`/`validated_fail` are first-packet validation outcomes; `admitted_hits` are packets that took the sliding-TTL fast path; `banned` is temp-bans issued.

## `reload`

Hot-apply the config to the loaded filter — no detach, no protection gap.

```bash
sudo gamefilter reload [--config /etc/gamefilter/gamefilter.yaml]
```

```
Config hot-applied (6 filters).
```

Re-pushes the global config, rebuilds the rule table, and re-sweeps port ownership (all 131072 port-map entries) through the pinned maps.

::: warning Lists are not re-seeded on reload
`reload` applies `enabled`, `default_action`, and `filters:` only. Changes to the YAML `whitelist:`/`blacklist:` take effect on the next `load` — or add entries live with the commands below (or the API).
:::

**When to use:** after every config edit. Safe to run during an attack.

## `whitelist`

Manage the whitelist — whitelisted sources bypass **everything**, including the blacklist.

```bash
sudo gamefilter whitelist add 203.0.113.10
sudo gamefilter whitelist remove 203.0.113.10
sudo gamefilter whitelist list
```

```
whitelisted 203.0.113.10
```

```
WHITELIST:
  203.0.113.10  permanent
```

IPv4 and IPv6 both work. Whitelist entries have no duration — they are permanent until removed.

## `blacklist`

Manage the blacklist — blacklisted sources are dropped before any port/validator logic runs.

```bash
sudo gamefilter blacklist add 198.51.100.7 3600   # 1-hour ban
sudo gamefilter blacklist add 198.51.100.7        # permanent (duration omitted or 0)
sudo gamefilter blacklist remove 198.51.100.7
sudo gamefilter blacklist list
```

```
BLACKLIST:
  198.51.100.7  3541s remaining
  192.0.2.44    permanent
```

`duration` is in seconds. `list` shows remaining time (or `expired` for entries whose timer has lapsed but haven't been cleaned out). Temp-bans issued by the failure→ban escalation land in this same list.

## `config`

Open the config in `$EDITOR` (default `nano`).

```bash
sudo gamefilter config
```

```
Config saved. Apply with: gamefilter reload (or the API POST /api/v1/reload)
```

Edits `/etc/gamefilter/gamefilter.yaml`. Nothing is applied until you `reload`.

## `key`

Show or rotate the API key.

```bash
sudo gamefilter key                 # print URL + key + ready-to-paste curl
sudo gamefilter key set <key>       # set your own (min 8 characters)
sudo gamefilter key regen           # generate a fresh gf_<32 hex> key
```

```
API: enabled
  Listen:  http://127.0.0.1:9300
  Health:  http://127.0.0.1:9300/health
  Key:     gf_9f2c…

Example:
  curl -H "Authorization: Bearer gf_9f2c…" http://127.0.0.1:9300/api/v1/stats
```

`set` and `regen` rewrite `/etc/gamefilter/gamefilter.yaml` — the daemon picks the new key up on its next config read (`reload` or restart).

## `daemon`

Run the resident process: HTTP management API plus the OpenShield sync loop.

```bash
sudo gamefilter daemon [--config /etc/gamefilter/gamefilter.yaml]
```

```
GameFilter API listening on 127.0.0.1:9300
```

- Refuses to start if `api.api_key` is missing or shorter than 8 characters.
- If `api.enabled: false`, skips the HTTP server and only runs sync (idles if sync is also disabled).
- The `gamefilter-api.service` systemd unit runs this command.

## `license`

Stub — **not implemented yet**. All features are currently enabled; there is no license server.

```bash
sudo gamefilter license            # or: license status / license activate <key>
```

```
license: not implemented yet (all features currently enabled)
```

## `version`

Print the version and exit.

```bash
gamefilter version
```

```
gamefilter 1.0.0
```
