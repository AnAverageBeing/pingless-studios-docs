# Geo Blocking

Since v2.2.0, OpenShield can block entire countries with a single keypress in the TUI. Blocking a country resolves its allocated IP ranges from MaxMind GeoLite2 data and enforces them as **permanent subnet bans** in the XDP LPM trie — packets from those ranges are dropped at the NIC, with zero per-packet userspace cost.

`geoip.enabled` now defaults to `true` (since v2.2.0), so this works out of the box.

## Blocking a country

Open the TUI and press `0` for the geo tab:

```
  [B]lock Mode   [A]llow Mode

   ●  CN
   ◌  RU        ← blocking in progress
   ✗  IR        ← failed (see notice line)
      US
```

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Toggle the selected country (block → unblock) |
| `b` / `a` | Switch between block mode and allow-only mode |
| `/` | Search/filter the country list |
| `j` / `k` or scroll wheel | Move through the list |
| `Esc` | Back to the dashboard |

- The **first block downloads the GeoLite2 database** (~30 MB), so it takes a few seconds — the status line tells you it's resolving ranges in the background.
- While a block is being applied the country shows `◌`; a failure shows `✗` with the reason in the notice line.
- **Unblocking is the same keypress again** — the country's prefixes are removed from the trie by looking up its stored record, not by hunting individual IPs.

## How it works under the hood

- The country's allocated prefixes are resolved from the GeoLite2 database and inserted into the subnet-ban LPM trie with **no expiry** (permanent until you toggle it off).
- Each geo ban carries a note like `geoblock: US (United States) — 241,377 prefixes — added 2026-08-05`, visible anywhere ban notes are shown, and the block record is persisted to disk so it **survives loader restarts**.
- Blocked-country state is reapplied automatically on load — you configure it once in the TUI and it stays.

## Configuration

```yaml
geoip:
  enabled: true        # default: true since v2.2.0
  license_key: ""      # empty = built-in default key; set your own MaxMind key to override
  db_path: "/var/lib/openshield/GeoLite2-City.mmdb"
  mode: "block"        # "block" (block listed countries) or "allow" (allow ONLY listed)
  countries: []        # managed by the TUI geo tab — edit by hand only if you must
  update_hours: 168    # GeoLite2 database refresh interval
```

You don't need a MaxMind account: an empty `license_key` falls back to a built-in default key used for the GeoLite2 downloads. Set your own key if you prefer your own quota.

## Accuracy and performance caveats

- **GeoIP is approximate.** GeoLite2 country accuracy is roughly 99%, and anyone behind a VPN or proxy exits from wherever the exit node is. Treat geo blocking as a noise reducer, not a guarantee.
- **Memory:** a large country is on the order of 100–240k prefixes, which costs ~30 MB of BPF map memory in the LPM trie. Blocking several large countries at once adds up — watch map utilization on the TUI status screen.
- **Speed:** lookups happen in the kernel LPM trie alongside normal subnet-ban checks, so there is no per-packet userspace cost and no measurable latency added to the fast path.
- Very large prefix lists are capped at the trie's per-country ceiling (largest prefixes kept); the block record notes when a country was truncated.

## What to read next

- [Auto-Fetch Blocklists](/openshield-xdp/user-guide/auto-fetch) — threat-intel feeds banned on a schedule
- [Attack Geo Analytics](/openshield-xdp/user-guide/troubleshooting#where-do-i-look-when-something-weird-happened-during-an-attack) — per-country breakdowns in attack reports
- [Full Config Reference — geoip](/openshield-xdp/configuration/reference#geoip-geo-blocking)
