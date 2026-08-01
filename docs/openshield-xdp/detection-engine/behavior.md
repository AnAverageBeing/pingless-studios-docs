# Adaptive Behavior Engine

The Adaptive Behavior Engine is OpenShield-XDP's self-learning layer. Instead
of relying only on static thresholds, it continuously learns what *your*
traffic looks like and flags groups of sources that behave anomalously —
with no ML model, no training phase, and no per-workload tuning. A game
server, a banking API, and a VoIP cluster each get their own learned profile
automatically.

It runs entirely in userspace on top of the per-source and per-port
statistics the XDP program already collects, so it adds no measurable packet
path cost.

## Two windows

### Window A — Baselines (normal traffic)

While no attack is active, the engine learns:

- **Per-port profiles** — for every destination port (≈ one workload), the
  packet-rate and average packet-size distributions, using exact online
  mean/variance (Welford) plus reservoir-sampled median/MAD for robust
  z-scores.
- **Global traits** — TTL distribution, packet-size variance, and inter-
  arrival timing regularity across all sources.

Baselines persist to `/var/lib/openshield/state/behavior.json` every 60
seconds and on shutdown, so a loader restart does not reset learning.

### Window B — Candidate clusters (anomalies)

When a source's rate deviates strongly from its port's learned baseline
(or the port has never been seen at that rate with bot-like traits), the
source becomes a *candidate*. Candidates that look alike — same destination
port, packet size within 20%, TTL within 12 — are grouped into **clusters**.

Each cluster is continuously scored 0–100 with named, human-readable
reasons:

| Signal | Points |
| --- | --- |
| 10+ hosts behaving identically | +15 |
| Nearly identical packet sizes | +25 |
| Machine-paced timing (low CV) | +20 |
| Explosive growth (fast, large appearance) | +20 |
| Far above the port's learned baseline | +15 |
| Port behavior never observed before | +10 |

- **≥ 70 → suspicious** — timeline entry, log line, Discord alert.
- **≥ 85 → malicious** — same reporting, plus the auto-block action if
  enabled.

Clusters idle for more than 30 seconds expire. A cluster that survives 10
minutes without being flagged is resolved as legitimate and its sources keep
training the baselines — this is how the system adapts to genuine workload
changes (a new game mode, a marketing launch) without manual intervention.

## Learning freeze during attacks

While an attack is active, **all learning stops**. Attack traffic never
contaminates the baselines — this prevents the classic "slow climb" bypass
where a gradual flood inflates the baseline until it looks normal.

Attack-time traffic is analyzed separately by the forensics pipeline: every
attack gets a fingerprint (`fingerprint.txt` / `fingerprint.json` in the
attack's forensics directory) with an **attack family classification**:

- `udp amplification (reflected)` — one dominant source port, fixed sizes
- `tcp syn flood` — ≥90% bare SYN packets
- `syn-ack reflection` — mostly SYN-ACKs (your address was spoofed)
- `botnet flood (fixed-size)` — uniform packet size, machine pacing
- `spoofed/randomized sources` — TTL spread across all ranges
- `port scan` — many destination ports, tiny packets
- `udp/tcp/icmp flood` — protocol-level fallback
- `unknown/mixed` — no dominant signature

The family and its evidence are included in the attack-end Discord alert.

## Manual vs. auto blocking

By default the engine runs in **manual mode**: clusters are reported and you
decide what to block (the attacks tab in the TUI offers one-click pattern
blocking and IP blacklisting per attack).

With `behavior.auto_block: true`, clusters that cross the malicious
threshold have their member IPs banned automatically for one hour.

```yaml
behavior:
  enabled: true       # master switch
  auto_block: false   # default: manual review
```

## Suppression scheduling

If you know a legitimate traffic spike is coming (product launch, match
start, seasonal peak), schedule a window in which the automatic machinery
stands down so the surge neither poisons baselines nor gets auto-blocked:

```bash
# Pause baseline learning for 2 hours
openshield schedule suppress baseline 2h

# Pause auto pattern/IP blocking for 90 minutes
openshield schedule suppress auto-block 90m

# Show active windows
openshield schedule list

# Remove a window (or all of them)
openshield schedule clear baseline
openshield schedule clear all
```

Schedules persist across loader restarts
(`/var/lib/openshield/state/schedule.json`) and expire automatically.

## Inspecting the engine

```bash
openshield behavior
```

prints the live state: learned per-port baselines (observations, median PPS,
average size) and every active cluster with its confidence score and
reasons. Cluster state changes also appear on the dashboard timeline and in
the log feed.

## Why not ML?

ML-based detection needs labeled training data, periodic retraining, and
still produces unexplained verdicts. The behavior engine uses robust online
statistics instead:

- **No training phase** — useful from the first minute, fully adapted within
  hours.
- **Explainable** — every verdict lists the exact reasons ("nearly
  identical packet sizes", "machine-paced timing").
- **Self-correcting** — unflagged clusters are re-absorbed as legitimate;
  expired state is garbage-collected.
- **Cheap** — a few hundred microseconds of CPU per refresh interval; zero
  cost in the packet path.
