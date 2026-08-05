# Recipes

Starting points for common server types. Each assumes you ran the installer and picked the suggested preset. Apply edits to `/etc/openshield/openshield.yaml`, then `sudo openshield reload`.

## Game server (Minecraft, FiveM, Rust, CS2)

**Preset:** Gaming.

Gaming traffic is bursty UDP from many players — the preset already tolerates that. Two additions worth making:

```yaml
static:
  port_thresholds:
    - ports: "25565"           # your game port
      pps_threshold: 8000      # a full server can legitimately push thousands of pps
      bps_threshold: 0         # inherit global

dynamic:
  attack_port_pps: 15000       # per-port cap during attacks (Gaming preset default)
```

- `attack_port_pps` is your real flood defense: a flood aimed at your game port is capped at the port level regardless of how many spoofed IPs it rotates through. Keep it comfortably above your busiest full-server night.
- Don't raise global `udp_pps_threshold` for players' sake — per-IP limits should stay tight; legit players never come close.

## Hosting node (Pterodactyl, Docker, VPS node)

**Preset:** Hosting.

Many customer services share one interface, and customer traffic spikes are usually legitimate. The preset focuses on attack patterns over raw rates.

```yaml
dynamic:
  attack_min_pps: 5000         # a busy node shouldn't trip attack mode on normal load
  attack_port_pps: 10000       # Hosting preset default
```

- Whitelist your panel/monitoring IPs: `sudo openshield wl add 203.0.113.10` (persists to the config).
- If one customer port (e.g. a popular game server) keeps tripping per-port caps, give it a `port_thresholds` entry rather than loosening the whole node.

## File / backup server (SFTP, rsync, S3 gateway, storage node)

**Preset:** Database (designed for DBs, file storage, backups, mail).

Bulk transfers are exactly what v2.0's established-connection exemption was built for: once a client completes a real TCP session, it's exempt from PPS/BPS/TCP scoring, so a 40 GB upload won't get banned. Make sure it's on:

```yaml
static:
  ct_established_exempt: true   # default — the "stop banning my backups" switch
  ct_syn_timeout_sec: 300       # keep ≥ your app's keepalive interval

  port_thresholds:              # optional, for pure-UDP transfer tools (no TCP session)
    - ports: "5001"
      pps_threshold: 20000
      bps_threshold: 104857600  # 100 MB/s
```

If you still see transfer bans, check that the traffic is really TCP — UDP-based transfer tools never establish a session, so they need a port override (above) or a whitelist entry for the backup peer.

## VPN server (WireGuard, OpenVPN)

**Preset:** Performance or Balanced.

A VPN concentrates all your clients' traffic into tunnel packets from a handful of endpoints — legitimate per-endpoint rates are far above normal.

```yaml
static:
  port_thresholds:
    - ports: "51820"            # WireGuard
      pps_threshold: 50000
      bps_threshold: 0          # inherit global BPS, or set your line rate

dynamic:
  conn_rate_limit: 5000         # fine as-is; VPNs don't open many TCP conns
```

- Whitelist nothing except management IPs — the tunnel port gets its allowance from `port_thresholds`, not from blanket exemptions.
- UDP floods aimed at the VPN port during an attack are handled by `attack_port_pps`; legit tunnel traffic on the port is throttled, not banned, until the attack clears.

## Any recipe: verify before and after

```bash
sudo openshield status        # loaded? which features active?
sudo openshield stats         # TUI: watch normal traffic for a day
```

Watch the TUI during your busiest hour before tuning. If normal traffic sits at 30% of a threshold, the threshold is fine — don't tune against quiet-hour numbers.
