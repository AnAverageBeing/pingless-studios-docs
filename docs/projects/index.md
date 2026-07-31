# Projects

## 🛡️ OpenShield-XDP
XDP-native DDoS mitigation at line rate. 16-stage detection pipeline with Bloom filter whitelist acceleration and freplace hot-patching.

[Documentation →](/openshield-xdp/) · [Contact →](https://studio.pingless.org)

## ⚡ Bandwidth Manager
Production-grade Docker container bandwidth management. Per-container speed limits, daily traffic quotas, kernel-level tc enforcement with modern TUI and webhook notifications.

[Documentation →](/bandwidth-manager/) · [GitHub →](https://github.com/AnAverageBeing/Bandwidth-flow-maintainer)

## 🛡️ Protection Plus
Host-level abuse protection and antivirus for hosting providers. Catches miners, outbound DDoS, Tor exits and proxies, port scans, webshells and malware uploads, zip bombs and exploits on Pterodactyl/Docker/VPS nodes — with per-container network visibility, on-access YARA + hash-blocklist scanning, Discord/email/webhook alerts, and automatic enforcement (kill, suspend, quarantine).

[Documentation →](/protection/) · [GitHub →](https://github.com/AnAverageBeing/protection)

## ⚡ mcu-hitter
High-performance DDoS testing and benchmarking tool. Supports UDP flood, TCP SYN, ICMP, raw packet crafting with IP spoofing.

[GitHub →](https://github.com/AnAverageBeing/mcu-hitter)

## 🗄️ S3 Database Storage for VPS
Automatic PostgreSQL and MySQL/MariaDB backups to any S3-compatible storage. Interactive setup, auto-discovery, systemd scheduling, retention, off-site + on-node copies, Discord alerts, and an interactive extractor.

[Documentation →](/s3-database-storage-for-vps/) · [GitHub →](https://github.com/AnAverageBeing/s3-database-storage-for-vps)

## ⚡ Penetration-v3
Advanced traffic generation and packet crafting tool for authorized penetration testing. Supports 38 methods across UDP, TCP, ICMP, HTTP/S, DNS, NTP, SNMP, application-layer protocols, and IPv6 with an interactive TUI wizard and scriptable CLI mode.

[Documentation →](/pentest-v3/) · [GitHub →](https://github.com/AnAverageBeing/Penetration-v3)

## 🎮 Bandwidth Monitor for Pterodactyl
Per-server network monitoring and bandwidth control for Pterodactyl panels. A Blueprint panel extension plus a Go agent on each Wings node: RX/TX speed caps via tc, day/week/month quotas per direction, throttle/suspend/log-only exceed actions, per-node pairing tokens, hourly/daily rollups, usage predictions, and reports in a native AdminLTE admin UI.

[Documentation →](/pterodactyl-bandwidth-monitor/) · [Contact →](https://studio.pingless.org)

## Glacier Theme for Pterodactyl
A calm, Apple-grade sidebar theme for Pterodactyl Panel, built on Blueprint. Replaces the stock top navigation with a customizable sidebar in three docks, reskins every page in dark and light mode with full per-mode palettes, and adds a console zones editor, dashboard cover-image cards, a visual tab manager, Ctrl+K search, 16 pure-CSS background patterns, announcements, and per-user privacy mode — all configured from a live-preview admin hub, with zero core-file replacement and zero external assets.

[Documentation →](/glacier/) · [Contact →](https://studio.pingless.org)

## Apple Theme for Pterodactyl Admin
An iOS-grade matte glass theme for the Pterodactyl admin area, built on Blueprint. Frosted sidebar and floating top bar in Catppuccin Mocha and Latte with 12 accents, a runtime-harvested sidebar where every extension's links appear automatically, a global reskin of every AdminLTE component so extension pages adapt untouched, a bento dashboard with live stats and an inline-SVG signup sparkline, and a branded boot loader — Blueprint or standalone, with zero core-file replacement.

[Documentation →](/apple/) · [Contact →](https://studio.pingless.org)

## 🛡️ LiteShield-XDP
Free, minimal XDP (eBPF) firewall for Linux 5.15+. One XDP program, one Go binary, one YAML config — per-source-IP rate limits, auto-ban, live whitelist/blacklist, built-in status TUI, and Discord webhook alerts. No license server, no daemons, MIT-licensed.

[Documentation →](/liteshield-xdp/) · [GitHub →](https://github.com/AnAverageBeing/LiteShield-XDP)

## 🚀 NitroCord
Velocity-compatible Minecraft proxy with built-in, license-gated attack prevention — kernel ipset firewall, TCP fingerprinting, anti-bot verification, anti-VPN/GeoIP, packet flood scoring, null-ping-proof MOTD caching, exploit filters, and an attack-mode engine that adapts the whole proxy under load. Drop-in replacement for Velocity: all plugins work unchanged.

[Documentation →](/nitrocord/) · [Contact →](https://studio.pingless.org)

## Firewall-Plus for Pterodactyl
Production-grade per-container iptables firewall for Pterodactyl Panel (Blueprint or standalone addon) plus a Wings node daemon, with DDoS SMART detection and automatic mitigation. 13 rule types, ipset whitelist/blacklist, per-port or global scopes, game presets, queued atomic applies with snapshots and rollback, drift detection, an emergency operations page, and a full client UI with dashboards, charts, presets, AbuseIPDB, and owner Discord/email attack alerts.

[Documentation →](/firewall-plus/) · [GitHub →](https://github.com/AnAverageBeing/pterodactyl-firewall-plus)

## Glacier Pack for Pterodactyl
A family of 24 standalone addons for Pterodactyl Panel v1.12.x plus the Glacier Pack hub — a single custom admin dashboard that hosts every addon's complete management UI in one Glacier-styled page. Includes a recycle bin, URL downloads, config editor, login activity, panel log viewer, node status and resource alerts, the full Minecraft suite (plugin/mod/modpack installers, version changer, player manager, player list, server properties), database manager, server importer, subdomain manager, staff requests, node analytics, S3 backups, and a permission manager for scoped staff roles. Addons inherit the Glacier theme's design tokens when it is installed and keep their own polished look when it is not.

[Documentation →](/glacier-pack/) · [Contact →](https://studio.pingless.org)

## Pterodactyl Revamp
Enterprise operations layer for Pterodactyl Panel 1.12.x–1.14.x, installable as a Blueprint extension or a standalone PanelFiles merge. Bulk server operations, multi-server creation, tagging, server templates, an allocation port picker, metrics and analytics dashboards, node/server health scoring, global search, and a full audit log — all from a dedicated `/admin/revamp` hub.

[Documentation →](/pterodactyl-revamp/) · [GitHub →](https://github.com/PingLess/pterodactyl-revamp)

## Sentinel for Pterodactyl
Fleet-wide security monitoring and enforcement for Pterodactyl panels — a Laravel panel addon (the brain) plus a static Go agent on each Wings node (the sensor/enforcer). Twelve detectors catch cryptominers, port scans, outbound DDoS, zip bombs, privilege escalation, abuse tooling and malware; a graduated rules engine kills processes, quarantines files, pauses or stops containers, and suspends servers panel-side. Threat intel is shared across the fleet — a hash confirmed by enough nodes is blocked everywhere — and the whole config is edited once in the admin UI and pushed, versioned, to every node.

[Documentation →](/pterodactyl-sentinel/) · [GitHub →](https://github.com/AnAverageBeing/pterodactyl-sentinel)

## 📦 More Projects
Follow [PingLess Studios on GitHub](https://github.com/AnAverageBeing) for new projects and updates.
