# Protection Profiles

OpenShield-XDP ships with **70 pre-computed configurations** across **10 profiles × 7 intensity levels**. Instead of tuning individual thresholds, you answer "what do you host?" and the installer picks the optimal preset.

## How profiles work

Each profile encodes a **protection philosophy**:

- **Rate limits** (PPS, BPS, TCP/UDP/ICMP/SYN thresholds) — how much traffic is allowed before scoring begins
- **Scoring** (violation scores, suspicion threshold, ban duration) — how aggressively traffic is metered and banned
- **Detection features** (entropy, TTL anomaly, packet size anomaly, SYN/FIN ratio, connection tracking) — which behavioral checks are active
- **Escalation** (auto subnet ban, panic circuit breaker) — how the system responds under sustained attack

The 7 intensity levels (Strict → Low → Medium → Balanced → High → Very High → Extreme) scale every threshold by a multiplier. Balanced is always the recommended default.

## The 10 profiles

| # | Profile | Designed for |
|---|---------|-------------|
| 1 | **Ultra Strict** | Personal websites, admin panels, internal dashboards, login portals, small APIs, low-traffic applications |
| 2 | **Strict** | Blogs, portfolio sites, WordPress, company websites, small stores |
| 3 | **Balanced** (default) | SaaS, APIs, ecommerce, communities, forums, general web hosting |
| 4 | **Performance** | Large APIs, streaming, downloads, reverse proxies, large websites |
| 5 | **Hosting** | Docker hosts, VPS nodes, shared hosting, Pterodactyl panels, Kubernetes |
| 6 | **Gaming** | Minecraft, FiveM, Rust, CS2, Terraria, voice servers, game hosting |
| 7 | **Enterprise** | Banks, government, large SaaS, critical infrastructure |
| 8 | **CDN / Edge** | CDN, reverse proxies, ISPs, large hosting providers, very high bandwidth |
| 9 | **Database / Storage** | Database servers, file storage, backups, mail servers |
| 10 | **Custom** | Mixed workloads, manual per-threshold tuning |

## The 7 intensity levels

| Level | Rate Multiplier | Effect |
|-------|----------------|--------|
| Strict | 0.40× | Most aggressive — fastest bans, tightest thresholds |
| Low | 0.60× | Aggressive — slightly relaxed |
| Medium | 0.80× | Moderately aggressive |
| **Balanced** | **1.00×** | **Recommended default** |
| High | 1.35× | Relaxed — allows more legitimate traffic |
| Very High | 1.75× | Very relaxed — minimal false positives |
| Extreme | 3.00× | Most permissive — blocks only extreme abuse |

## Per-profile threshold examples

### SYN packets per second (`syn_pps_threshold`)

| Profile | Strict (×0.40) | Balanced (×1.00) | Extreme (×3.00) |
|---------|---------------|-------------------|------------------|
| Ultra Strict | 28 | 70 | 210 |
| Strict | 44 | 110 | 330 |
| Balanced | 68 | 170 | 510 |
| Performance | 160 | 400 | 1,200 |
| Hosting | 400 | 1,000 | 3,000 |
| Gaming | 200 | 500 | 1,500 |
| Enterprise | 100 | 250 | 750 |
| CDN / Edge | 800 | 2,000 | 6,000 |
| Database | 60 | 150 | 450 |

### Packets per second (`pps_threshold`)

| Profile | Strict (×0.40) | Balanced (×1.00) | Extreme (×3.00) |
|---------|---------------|-------------------|------------------|
| Ultra Strict | 160 | 400 | 1,200 |
| Strict | 200 | 500 | 1,500 |
| Balanced | 340 | 850 | 2,550 |
| Performance | 800 | 2,000 | 6,000 |
| Hosting | 2,000 | 5,000 | 15,000 |
| Gaming | 800 | 2,000 | 6,000 |
| Enterprise | 480 | 1,200 | 3,600 |
| CDN / Edge | 3,200 | 8,000 | 24,000 |

Each of the **34 tuned thresholds** follows the same pattern — base value from the profile category, scaled by the intensity level, clamped to a safe range.

## Workload-based recommendation

The installer presents 27 workload types. Select what you host, and the engine recommends the best profile:

```
Detected workloads: Minecraft Server, Docker Host, Pterodactyl Panel
Recommended: Gaming Profile
Reason: Tolerates legitimate UDP bursts while protecting against
reflection and flood attacks. Allows modpacks, plugins, many
concurrent game servers.
```

See [Installation](/openshield-xdp/getting-started/installation) for the interactive installer flow.
