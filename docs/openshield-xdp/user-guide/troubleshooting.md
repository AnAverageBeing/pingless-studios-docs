# Troubleshooting

## "I (or my users) get banned while uploading files"

This was the classic pre-2.0 false positive: SFTP/backup uploads push far more packets per second than browsing, and the per-IP BPS/PPS scorer banned the uploader.

**Fix (already on by default since v2.0):**

```yaml
static:
  ct_established_exempt: true
```

A source that completes a real TCP session (sends actual data within `ct_syn_timeout_sec` of its SYN) is exempt from PPS/BPS/TCP scoring. Real upload clients do this automatically; spoofed floods can't fake it.

If bans persist, check in order:

1. **Is the traffic actually TCP?** UDP transfer tools (some backup agents, QUIC-based tools) never establish a TCP session, so there's nothing to exempt. Give the port its own limits via [`static.port_thresholds`](/openshield-xdp/user-guide/config-values#port-overrides-static-port-thresholds) or whitelist the peer IP.
2. **Is `ct_syn_timeout_sec` too short for your app?** If the app idles longer than the timeout between bursts, the proof expires. Default is 300s; keep it above the app's keepalive interval.
3. **Are you on an old preset?** Upgrades keep your existing values. v2.1.1 retuned preset scoring; run `sudo openshield reconfigure` to pick up the new numbers (or edit scores manually).
4. **Last resort:** `sudo openshield wl add <your-ip>` — whitelisted IPs bypass everything. Fine for your office IP, wrong for customer ranges.

## "The TUI shows UNDER_ATTACK but nothing is being dropped"

Usually one of these:

- **Attack mode just started.** The per-port cap (`attack_port_pps`) and tightened thresholds engage for the duration; check the drop counter a few seconds in — it should be climbing. `openshield stats` shows drops per stage.
- **`attack_port_pps` is set too high** (or is `0` = off). The cap must sit below the flood's rate but above your busiest legit port traffic. If the flood is 50k pps at one port and your cap is 100k, nothing gets dropped at the port level — only per-IP scoring is working, and rotating floods defeat that.
- **The attack isn't IP traffic OpenShield sees.** XDP attaches per-interface; traffic arriving on a different interface (or purely local/container traffic) never reaches the program. Confirm the interface in `openshield status` matches your public traffic.
- **Thresholds were loosened by hand.** `attack_threshold_multiplier` near 1.0 means attack mode barely tightens anything. Preset default is 0.5.

## "Legit users get throttled during attacks"

That's the per-port cap doing its job — during an attack, the attacked port's *total* rate is capped, so legit users on that port share the pain (throttled, never banned) instead of losing the server. If it's too aggressive for your service, raise `attack_port_pps` above your legit peak, or add a `static.port_thresholds` entry for that port (port overrides apply during attack mode too).

## "How do I test this safely?"

- **Never test from the server itself or from local containers.** XDP hooks sit at NIC ingress; locally-generated traffic to your own IP doesn't cross them, so you'll "test nothing" and confuse yourself.
- Use a second machine on another network, start small, and watch `openshield stats`:
  ```bash
  # from another host: gentle rate check against a test port
  sudo hping3 -S -p 8080 --faster <server-ip>     # SYN rate test
  ```
  You should see suspicion scores rise, then a ban after a few seconds.
- Load with a self-timer while experimenting: `sudo openshield load -t 600` auto-unloads after 10 minutes, so a bad config can't lock you out. The interactive `openshield load` also has a 10-second safety prompt that auto-unloads if you lose access.
- Whitelist your own admin IP **before** any aggressive test: `sudo openshield wl add <ip>`.

## "Config edits don't seem to apply"

- Run `sudo openshield reload` — most fields apply live. Fields marked 🔒 in the [reference](/openshield-xdp/configuration/reference) (interface, map sizes, baseline params, `behavior.enabled`) need `sudo openshield unload && sudo openshield load`.
- Typos in key names are silently ignored on load in some versions; validate with `sudo openshield fix` and check `sudo openshield status`.
- If the loader won't start after an edit, restore from the annotated example at `/opt/openshield/share/openshield.example.yaml`.

## "Where do I look when something weird happened during an attack?"

Every attack writes a **forensics bundle** (packet capture if `pcap` is enabled, event log, ban list, and since v2.0: `config_snapshot.txt` — the mitigation config as it stood when the attack started, secrets stripped — and `config_changes.txt` — every config change made during the attack, timestamped). Since v2.2.0, attack-end reports and forensics also include a **top-50 attacking-countries breakdown** (IPs, peak pps/Gbps, % share; legit and established sources excluded) when GeoIP data is available — that's the fastest way to answer "where did that come from?" and decide whether a [geo block](/openshield-xdp/user-guide/geo-blocking) is worth it. Check the TUI's attack history or the forensics directory, and pull the same data over the [Metrics API](/openshield-xdp/user-guide/metrics-api) if you want it in your own tooling.

## Still stuck

- [Full Config Reference](/openshield-xdp/configuration/reference)
- [FAQ](/openshield-xdp/getting-started/faq)
- [Discord](https://discord.gg/qgBMREWWgp)
