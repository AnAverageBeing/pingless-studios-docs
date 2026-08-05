# Auto-Fetch Blocklists

Since v2.2.0, OpenShield can keep your ban list fed automatically: on a configurable interval it downloads threat-intelligence IP feeds — the official [openshield-blocklists](https://github.com/AnAverageBeing/openshield-blocklists) categories plus any custom URLs you add — validates and de-duplicates the entries, and loads them straight into the XDP ban maps. Known botnet C2s, scanners, and brute-forcers are dropped at the NIC before they ever produce a suspicion score.

It's **on by default** with a 1-hour interval and a curated set of categories. No API keys, no accounts — the feeds are plain text on GitHub.

## What gets banned, and for how long

- Each category expands to four feed files (`ipv4.txt`, `ipv6.txt`, `ipv4-cidrs.txt`, `ipv6-cidrs.txt`) — single IPs go into the ban maps, CIDRs into the LPM subnet-ban maps.
- Fetched bans carry their own reason tag and **expire after 2× the fetch interval** (floor: 10 minutes). A broken or hijacked feed can never block anyone permanently — stale entries age out on their own.
- A feed that fails to download is logged and skipped; if *every* feed fails, the existing fetched bans are kept until they expire naturally.
- Entries are merged and de-duplicated across all feeds before anything is applied.

## Configuration

```yaml
auto_fetch:
  enabled: true          # default: true
  interval_sec: 3600     # default: 3600 (1h), minimum 60
  mode: "vps"            # "vps" (default) or "dedicated"
  categories:            # official feed categories
    - c2
    - botnets
    - malware
    - scanners
    - abuse
    - bruteforce
    - ssh-attackers
    - credential-stuffing
    - web-exploit-scanners
    - exploited-infrastructure
    - high-risk-networks
  urls: []               # extra raw list URLs (one IP/CIDR per line, # comments OK)
  never_block: []        # IPs/CIDRs exempt from FETCHED bans only (see warning below)
  provider_urls: []      # custom provider-range sources for dedicated mode
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `auto_fetch.enabled` | `bool` | `true` | Master switch. Toggling applies live — no reload needed |
| `auto_fetch.interval_sec` | `int` | `3600` | Seconds between fetch cycles (min `60`). First fetch runs ~20s after loader start |
| `auto_fetch.mode` | `string` | `"vps"` | `vps` or `dedicated` — see below |
| `auto_fetch.categories` | `[]string` | 11 categories (above) | Categories from the official feed repo. Proxy/Tor/VPN categories are deliberately **not** default — they block legit users |
| `auto_fetch.urls` | `[]string` | `[]` | Extra http(s) list URLs, one IP/CIDR per line |
| `auto_fetch.never_block` | `[]string` | `[]` | IPs/CIDRs the fetcher will never ban |
| `auto_fetch.provider_urls` | `[]string` | `[]` | Extra provider-range sources for dedicated mode (plain-text lists or AWS/GCP-style JSON). Empty = built-in defaults |

::: warning never_block is NOT a firewall whitelist
`never_block` entries are skipped **by the fetcher only**. Those IPs are still fully scored, rate-limited, and banned by the detection engine like anyone else — it just means no auto-fetched feed can ban them. If you want an IP to bypass mitigation entirely, use the [whitelist](/openshield-xdp/user-guide/cli#openshield-whitelist-openshield-blacklist) (`sudo openshield wl add <ip>`).
:::

## Mode: `vps` vs `dedicated`

- **`vps` (default)** — block everything the feeds list. Right for a single server (VPS, game server box, web server) where all inbound traffic is unsolicited anyway.
- **`dedicated`** — the fetcher skips ranges owned by major cloud/hosting providers (AWS, Azure, GCP, Cloudflare, OVH, Hetzner, …) before applying bans. Use this on dedicated servers that **host VPS clients**: those VMs connect *out* to cloud providers for updates, APIs, and storage — banning AWS or Cloudflare ranges would sever that outbound connectivity for your customers.

The provider-range list has built-in defaults (with an offline fallback); `provider_urls` lets you extend or override it with your own sources. The TUI auto-fetch view shows how many entries were skipped this way (`provider_skipped`) and how many provider ranges are loaded.

## Managing it from the TUI

Open the access tab (key `9`) and press `f` for the auto-fetch view:

```
  Status: ON   Interval: 3600s   Fetches: 14
  Last fetch: 03:00:01   Next: 04:00:01
  Applied: 48,213 IPs + 1,904 CIDRs from 44 feed files
```

| Key | Action |
|-----|--------|
| `t` | Toggle auto-fetch on/off (applies live) |
| `f` | Fetch now (runs in the background) |
| `a` | Add a never-block entry (IP or CIDR) |
| `d` | Remove the selected never-block entry |
| `r` | Refresh the status |
| `Esc` | Back to the access list |

## Whitelist sync

Whitelisting an IP does two things automatically: it **unbans** the IP if it's currently banned, and it **mirrors the entry into `auto_fetch.never_block`** so the fetcher can never re-ban it on the next cycle. Removing it from the whitelist mirrors the removal in `never_block` too. You don't need to maintain both lists by hand.

## Notes

- Feed downloads are capped at 64 MB per file with a 45s timeout per feed — a slow mirror can't stall the pipeline.
- Subnet bans are capped by the LPM trie capacity (4,096 v4 / 2,048 v6 entries); when the trie is full, remaining CIDRs are skipped but single-IP bans (the bulk of the value) still apply.
- Fetcher bans show up in ban lists with their own reason code, so they're easy to tell apart from manual bans and detection-engine bans.

## What to read next

- [Geo Blocking](/openshield-xdp/user-guide/geo-blocking) — block whole countries from the TUI
- [CLI Reference](/openshield-xdp/user-guide/cli) — manual bans, ban notes, bulk import
- [Full Config Reference](/openshield-xdp/configuration/reference)
