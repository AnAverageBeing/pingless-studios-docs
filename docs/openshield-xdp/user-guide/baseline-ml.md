# Baseline Memory (ML Tab)

Since v2.4.0, OpenShield doesn't just learn your traffic — it *remembers* it. The dynamic baseline (the "what does normal look like" reference every detection is measured against) now has a 30-day memory with operator controls, visible in the TUI's **ML tab** (press `m`).

## How it works

- The live baseline is a fast-adapting EMA of your inbound traffic (PPS, BPS, TCP, UDP, ICMP, SYN) — updated every few seconds, frozen during attacks.
- **Every day at local midnight**, the learned baseline is snapshotted to disk. Up to **30 daily snapshots** are kept; the oldest rolls off.
- The baseline the detector actually uses is a **recency-weighted merge**: the live EMA gets ~15% of the vote, the 30 days of history ~85% (recent days weigh more — 0.85 decay per day of age).

The practical effect: one weird day — an attack that slipped under detection, a one-off event, a migration — can only drag your detection so far. The other 29 days outvote it.

## When an attack bypasses detection

If an attack was slow enough to stay under the trigger, the ceiling guard stops it from *fully* poisoning the baseline — but it can still tilt that day's learning. Fix it in two keystrokes:

1. Open the TUI → `m` (ML tab).
2. Find the poisoned day in the 30-day history, press `d` (confirm) — the snapshot is deleted and the merged baseline **reconfigures immediately**.

If the bypass happened **today** (not yet snapshotted), press `D` — this resets the *live* baseline from the remaining history. Same effect, same immediacy.

CLI equivalent:

```bash
openshield baseline                    # live + merged values, thresholds, history
openshield baseline delete 2026-08-04  # remove a day, recompute
openshield baseline delete $(date +%F) # reset today's live baseline
```

## Import / export

Move a trained baseline between servers (e.g. a replacement node, or after reinstall):

```bash
openshield baseline export backup.json   # live baseline + all 30 days
openshield baseline import backup.json   # replace + reconfigure instantly
```

In the TUI: `e` exports to `/var/lib/openshield/state/baseline-export-<timestamp>.json`; `i` prompts for a path and imports.

Importing also **seeds cold starts**: a fresh install with imported (or retained) history converges to sane detection in seconds instead of learning for hours.

## What the ML tab shows

| Panel | Contents |
|-------|----------|
| **Learning** | `active` / `frozen (attack active)` / `suppressed (schedule)`, merge weights, spike thresholds and the configured floors |
| **Baseline** | live vs merged side by side — PPS, BPS, TCP, UDP, ICMP, SYN |
| **30-Day History** | every snapshot with date + rates; cursor selects a day for deletion |

The tab auto-refreshes every 5 seconds. Keys: `j/k` scroll, `PgUp/PgDn` page, `d` delete day, `D` reset today, `e` export, `i` import, `r` refresh.

## Related knobs

- `dynamic.spike_percentage` — how far above the merged baseline = attack (default 200 → 3×).
- `dynamic.attack_min_pps` / `attack_min_bps` — absolute floors; detection never goes blind on quiet servers.
- `openshield schedule suppress baseline <duration>` — pause learning ahead of a known traffic spike (maintenance, launches).
