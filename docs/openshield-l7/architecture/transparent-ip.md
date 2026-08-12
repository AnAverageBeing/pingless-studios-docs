---
title: Transparent Client IP — OpenShield-L7
description: IP_TRANSPARENT deep dive — how OpenShield-L7 sources upstream connections from the real client IP, the required sysctls/routes for both topologies, limits, and security notes.
outline: deep
---

# Transparent Client IP

Normally a reverse proxy hides the client: the origin's peer is the proxy, and the real client IP travels in `X-Forwarded-For` or a PROXY protocol header — both of which the origin must be configured to read.

With `client_ip.transparent: true` on a site, OpenShield-L7 instead sources the **upstream TCP connection from the real client IP**: the proxy binds its origin-facing socket with the Linux `IP_TRANSPARENT` option and the client IP as local address before connecting. The origin's own socket table then shows the connection as coming from the client directly — no headers, no PROXY protocol, **zero origin configuration**:

```text
normal mode:       client ──▶ openshield ──▶ origin      origin peer = openshield IP
transparent mode:  client ──▶ openshield ──▶ origin      origin peer = client IP
                   (e.g. with a CDN: cf ──▶ openshield ──▶ origin, but
                    the origin sees cf's downstream client, not cf, not us)
```

The spoofed source is the **resolved client IP** — the trusted-proxy-aware one (see `client_ip.trusted_proxies` in the [Configuration Reference](../configuration/reference.md#client_ip)). With a CDN in front and its ranges trusted, the origin sees the true end client; without trusted proxies, it sees the direct peer. The same resolved IP feeds the PROXY-protocol source address on `proxy_protocol` sites.

When transparent mode is on, `forward_mode` and `proxy_protocol` are redundant for IP visibility — `forward_mode: none` is the clean combination.

::: danger
This is deliberately-spoofed-source networking. It only works when the network path cooperates, and it needs real privileges. Read this whole page before enabling it.
:::

---

## How it works

For each upstream connection of a transparent site, the proxy:

1. resolves the client IP as usual;
2. creates the upstream socket, sets `IP_TRANSPARENT` on it, and `bind()`s it to `(client_ip, 0)`;
3. `connect()`s to the origin.

The origin answers to the client IP — which is **not** a local address of the proxy box — so the reply packets must find their way back to the proxy's socket. That is the entire difficulty, and both supported topologies below are just two ways of arranging it.

Privileges are checked **once at startup** (root or `CAP_NET_ADMIN`). If they are missing, the proxy logs loudly and **falls back to normal egress** — the site keeps working, the origin just sees the proxy IP again (graceful degrade).

---

## Requirements

- Linux, running as **root** or with **`CAP_NET_ADMIN`** (see the [systemd variants](../getting-started/installation.md#transparent-mode-variant)).
- The proxy box must **receive the origin's replies** to the client IP. One of the two topologies below.
- `rp_filter` must not drop the spoofed traffic.
- No NAT on the path that would rewrite the source (masquerading kills transparency).
- A network you control. See [Where it cannot work](#where-it-cannot-work).

Limits:

- **IPv4-only** — `IP_TRANSPARENT` is only set on IPv4 sockets (a socket2 limitation). IPv6 clients degrade to normal egress with a log line.
- **Return-path requirement** — the origin's replies must transit the proxy box. If they can route around it, the handshake never completes.

---

## Topology A — gateway mode (origin routes via this box)

The proxy box is the origin's **default gateway** (same L2 segment, or the origin is otherwise routed through it). Replies to client IPs naturally flow back through the box; policy routing then delivers them to the local transparent sockets instead of forwarding them on.

Packet walk: SYN `client → origin` leaves the box with `src=client` → origin replies `origin → client` → reply arrives back at the box because it is the origin's gateway → policy routing marks it "local" → socket lookup matches the proxy's `IP_TRANSPARENT` socket → proxied back to the real client.

Setup on the OpenShield box:

```bash
# Forward packets (the box is a gateway).
sysctl -w net.ipv4.ip_forward=1

# Packets with foreign source/destination addresses are not martians here.
sysctl -w net.ipv4.conf.all.rp_filter=0
sysctl -w net.ipv4.conf.default.rp_filter=0
# (or set rp_filter=2 "loose" per-interface instead of 0)

# Deliver reply packets (origin -> client) to local sockets:
# mark them, then route the marked ones to loopback.
ip rule add fwmark 0x1 lookup 100 pref 100
ip route add local 0.0.0.0/0 dev lo table 100

# eth1 = the interface facing the origin; 10.0.0.5/8080 = the origin.
iptables -t mangle -A PREROUTING -i eth1 -p tcp -s 10.0.0.5 --sport 8080 -j MARK --set-xmark 0x1
```

And on the origin host: its default route via the OpenShield box (e.g. `ip route replace default via <box-ip>`), or an equivalent DHCP / static-route setup.

Notes:

- Tighten the MARK rule with `-i`/`-s`/`--sport` so unrelated traffic keeps its normal path. One rule per origin (or match a subnet).
- Do **not** MASQUERADE/SNAT this traffic — any source rewrite destroys the transparency.
- If the box only proxies and does not otherwise route, `ip_forward=1` is still required so the box doesn't reject the transit packets.

---

## Topology B — local origin (the origin is a process on this box)

The origin listens on `127.0.0.1:8080` (or another address of the same host). Here the origin's replies are **locally generated**, so they never hit PREROUTING — they go through OUTPUT routing, which would happily send `origin → client` packets out the default gateway to die. Mark them in OUTPUT and loop them back instead.

Setup on the OpenShield box (origin at `127.0.0.1:8080`):

```bash
# Loopback-hosted origins: allow 127/8 traffic to be policy-routed
# without tripping the kernel's martian checks.
sysctl -w net.ipv4.conf.all.route_localnet=1

# Same local-delivery trick as gateway mode.
ip rule add fwmark 0x1 lookup 100 pref 100
ip route add local 0.0.0.0/0 dev lo table 100

# Replies are locally generated -> OUTPUT chain, matched by source port.
iptables -t mangle -A OUTPUT -p tcp -s 127.0.0.1 --sport 8080 -j MARK --set-xmark 0x1

# The spoofed SYN arrives on lo with a foreign source: don't let
# rp_filter martian-drop it.
sysctl -w net.ipv4.conf.all.rp_filter=0
sysctl -w net.ipv4.conf.lo.rp_filter=0
```

If the origin binds a non-loopback local address (e.g. `10.0.0.5` on eth0), drop `route_localnet` and match `-s 10.0.0.5` instead.

---

## systemd companion unit

The routing side is **not** done by the proxy — install it once via network configuration or a companion oneshot unit (Topology B example):

```ini
# /etc/systemd/system/openshield-l7-transparent.service
[Unit]
Description=Policy routing for OpenShield-L7 transparent mode
Before=openshield-l7.service
After=network-pre.target
Wants=network-pre.target

[Service]
Type=oneshot
RemainAfterExit=yes
# Topology B (local origin 127.0.0.1:8080) example:
ExecStart=/sbin/sysctl -w net.ipv4.conf.all.route_localnet=1
ExecStart=/sbin/sysctl -w net.ipv4.conf.all.rp_filter=0
ExecStart=/sbin/sysctl -w net.ipv4.conf.lo.rp_filter=0
ExecStart=/sbin/ip rule add fwmark 0x1 lookup 100 pref 100
ExecStart=/sbin/ip route add local 0.0.0.0/0 dev lo table 100
ExecStart=/sbin/iptables -t mangle -A OUTPUT -p tcp -s 127.0.0.1 --sport 8080 -j MARK --set-xmark 0x1
ExecStop=/sbin/ip rule del fwmark 0x1 lookup 100 pref 100
ExecStop=/sbin/ip route del local 0.0.0.0/0 dev lo table 100
ExecStop=/sbin/iptables -t mangle -D OUTPUT -p tcp -s 127.0.0.1 --sport 8080 -j MARK --set-xmark 0x1

[Install]
WantedBy=multi-user.target
```

The main unit needs the [transparent-mode variant](../getting-started/installation.md#transparent-mode-variant) (`CAP_NET_ADMIN`, no `NoNewPrivileges`).

---

## Verification

Transparent mode degrades gracefully only for **missing privileges**. A network path that blackholes the replies is *not* auto-detected — the site just serves 502s. Verify after every setup change:

```bash
# 1. Privileges were detected (no "transparent" warning in the log).

# 2. Send a request through the proxy and watch the ORIGIN's socket table:
#    you should see the connection sourced from your test client IP.
ss -tnp | grep 8080
# ESTAB 0 0 10.0.0.5:8080 203.0.113.9:51234 ...

# 3. On the proxy box, confirm replies are coming back and being marked:
tcpdump -ni any 'tcp port 8080 and host 203.0.113.9'
iptables -t mangle -L OUTPUT -v -n   # packet counters on the MARK rule

# 4. Functional check through the proxy:
curl -H "Host: example.com" http://<proxy-ip>/
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Startup log: transparent unsupported, falling back | Not root / no `CAP_NET_ADMIN` | Use the `AmbientCapabilities` systemd variant or run as root. |
| 502s, origin `ss` shows SYN_RECV from client IPs | Replies never come back | Wrong topology: the origin must route via this box (A) or be local (B). Check `ip rule`/`ip route ... table 100` and the MARK rule counters. |
| Works from some clients, not others | rp_filter dropping asymmetric-looking packets | `rp_filter=0` (or `2`) on all involved interfaces, incl. `lo` for local origins. |
| Local origin: nothing works at all | Martian drops on 127/8 traffic | `sysctl net.ipv4.conf.all.route_localnet=1`. |
| `dmesg`/logs show "martian source" messages | Strict reverse-path filtering | Same as above; find the interface in the log and relax its `rp_filter`. |
| Connections establish, then stall/reset | Conntrack table full, or a conntrack/NAT helper mangling the flow | Raise `net.netfilter.nf_conntrack_max`; ensure no MASQUERADE/SNAT matches this traffic; check `conntrack -L \| grep <client-ip>`. |
| Origin sees the proxy IP anyway | Transparent silently off (privilege fallback) or config not reloaded | Check startup log; confirm the site file has `client_ip.transparent: true`; `POST /api/v1/reload`. |

Conntrack notes: with connection tracking enabled, both directions of the spoofed flow are tracked like any other flow — fine — but under flood conditions the conntrack table becomes the bottleneck (`nf_conntrack: table full, dropping packet`). Size `net.netfilter.nf_conntrack_max` for your expected concurrent flows, or `NOTRACK` the proxy↔origin traffic if you don't otherwise need it.

### Where it cannot work

Transparent mode requires the spoofed source IP to survive the network path in both directions. It **cannot** work when:

- **Cloud NAT / filtered egress**: AWS/GCP/Azure and most VPS providers drop packets whose source IP isn't assigned to your NIC (source/destination checks, hypervisor anti-spoofing). A *remote* origin behind such infrastructure will never see the client IP. (Local origins on the same cloud VM — Topology B — do work, since nothing spoofed leaves the box.)
- **The origin's replies don't transit this box** (origin on the public internet with its own gateway): the SYN-ACK goes straight to the real client, whose stack RSTs a connection it never opened. Handshake timeouts on the proxy, `SYN_RECV` on the origin.
- **Carrier-grade NAT or upstream BCP38 filtering** between you and the origin: spoofed egress is dropped by design.

Detection recipe: `tcpdump` on the proxy box for SYNs leaving with `src=client`, no SYN-ACKs returning → the path is filtering you. There is no automatic fallback for this case (the failure looks like an origin timeout); disable `transparent` for that site and use `forward_mode`/`proxy_protocol` instead.

---

## Security notes

- You are deliberately spoofing source addresses. Any **egress filtering you operate** (uRPF on your routers, provider ACLs) must permit it for this host — and should permit it *only* for this host.
- Enable transparent mode only when you control the full network path between proxy and origin. On shared or filtered infrastructure it will either fail closed (timeouts) or train you to ignore spoofing alarms.
- The proxy host becomes the one machine allowed to originate arbitrary-source traffic: keep the admin API on loopback, keep tokens out of dashboards, and patch the box.
- Transparent mode does not replace origin lockdown. The origin port must still not be publicly reachable, or attackers bypass the proxy entirely — see [origin lockdown](../getting-started/installation.md#verify-the-install).
