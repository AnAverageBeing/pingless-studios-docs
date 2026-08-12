# Attached IPs (Tenant Registry)

OpenShield-XDP can learn which destination IPs actually belong to your machine — essential on dedicated servers hosting many tenant VPSes. The registry answers "which of my IPs exist, and when did each last see traffic?" It is **informational**: attaching an IP never changes how its traffic is handled, and clearing the registry never interrupts anyone.

## How IPs get attached

| Origin | How |
|--------|-----|
| `auto` | Seen on the wire: any destination that receives more than `registry.auto_min_packets` (default 100) cumulative packets is attached automatically, plus addresses assigned to local interfaces. |
| `manual` | Added by you: `openshield ips add 203.0.113.10` |
| `pool` | A whole subnet at once: `openshield ips pool add 203.0.113.0/24` — every IP in the range counts as attached without listing them individually. IPv6 pools work too. |

Noise (broadcast-looking `.0`/`.255`, multicast, link-local) is never auto-attached.

## Last-seen and automatic cleanup

Every attached IP carries a `last seen` timestamp, refreshed from live traffic counters. Auto-detected entries that stay silent for **`registry.inactive_days`** (default **14**) are removed automatically — decommissioned tenant IPs disappear from the list on their own. Manual entries and pools are never auto-removed.

## Managing the registry

```bash
openshield ips list                      # table: IP, origin, first/last seen
openshield ips add 203.0.113.10          # manual attach (survives reaping)
openshield ips add 203.0.113.10 "note"   # with a note
openshield ips remove 203.0.113.10
openshield ips clear                     # detach everything (harmless to traffic)
openshield ips pool add 203.0.113.0/24   # attach a whole subnet
openshield ips pool remove 203.0.113.0/24
```

The TUI shows the same list (with live per-IP rates) in the **IPs** tab.

## Configuration

```yaml
registry:
  enabled: true          # master switch
  inactive_days: 14      # auto entries silent this long are removed
  auto_min_packets: 100  # wire-observed destinations need this many packets to auto-attach
```

All three are runtime-safe — changes apply without reloading the firewall.

## Why it matters

The registry is what makes per-tenant features safe: [blackhole](blackhole.md) automation only ever targets *attached* IPs, so a random routed address can never be auto-blackholed, and the attacks view can tell you which tenant was actually under fire.
