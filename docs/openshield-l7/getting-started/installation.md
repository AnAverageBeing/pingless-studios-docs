---
title: Installation — OpenShield-L7
description: Build OpenShield-L7 from source, first-run bootstrap, systemd units, sysctl tuning, verification, troubleshooting, and uninstall.
outline: deep
---

# Installation

OpenShield-L7 is one statically-linked Rust binary plus two config directories. Build it, give it a root directory, and it bootstraps itself on first run.

---

## Prerequisites

| Requirement | Minimum | Notes |
|---|---|---|
| **OS** | Linux | Transparent mode is Linux-only; the rest builds anywhere stable Rust targets. |
| **Rust toolchain** | stable (edition 2021) | Install via [rustup](https://rustup.rs). |
| **Privileges: normal mode** | none for high ports | Binding ports 80/443 needs **root** or `CAP_NET_BIND_SERVICE`. |
| **Privileges: transparent mode** | root or `CAP_NET_ADMIN` | Only when a site sets `client_ip.transparent: true` — plus the policy routing from [Transparent Client IP](../architecture/transparent-ip.md). |
| **Python 3** | optional | Only for the test battery (`testing/run_all.sh`). |

### Quick dependency check

```bash
rustc --version    # any recent stable
cargo --version
uname -s           # Linux
```

---

## Build from Source

```bash
git clone https://github.com/AnAverageBeing/openshield-l7.git
cd openshield-l7
cargo build --release
# binary: target/release/openshield-l7
```

Optional sanity gates before installing:

```bash
cargo test --workspace                              # 215 unit tests
cargo clippy --workspace --all-targets              # lint-clean
./target/release/openshield-l7 --help
```

---

## First-Run Bootstrap

Run the binary once in any empty directory:

```bash
mkdir -p myproxy && cd myproxy
/path/to/openshield-l7 run
```

If `config.yaml` is missing, `run` writes a fully-commented default (mode `0600`) and generates one admin token, printed **once** to the console:

```text
======================================================================
openshield-l7 first-run bootstrap

Wrote /home/you/myproxy/config.yaml
with a generated admin API token:

    7f3c9e1a-2b4d-4e8f-9a1c-5d6e7f8091a2

SAVE THIS TOKEN NOW — it is printed once and never logged.
(It is also stored in the config file above, mode 0600.)
======================================================================
```

The bootstrap also creates `data/` (runtime state, including the persisted challenge secret at `data/challenge.secret`, mode `0600`) and `sites.d/` with a commented `example.yaml.disabled` template when empty.

Press `Ctrl-C` for now — first [add a site and verify](./quick-start.md), then come back here for production setup.

---

## Production Layout

```text
/usr/local/bin/openshield-l7            binary
/etc/openshield-l7/                     --root
├── config.yaml                         global config
├── sites.d/<site>.yaml                 one file per site
├── certs/<site>/{fullchain,privkey}.pem
└── data/                               runtime state (quota counters) — owned by the service
```

```bash
# unprivileged service user
useradd --system --no-create-home --shell /usr/sbin/nologin openshield

install -m 0755 target/release/openshield-l7 /usr/local/bin/openshield-l7
install -d -m 0750 -o openshield -g openshield \
  /etc/openshield-l7 /etc/openshield-l7/sites.d \
  /etc/openshield-l7/data /etc/openshield-l7/certs
```

The binary needs **write** access to `sites.d/` (API writes, id assignment) and `data/` (quota counters), and **read** access to `certs/`.

Copy your bootstrapped `config.yaml` and site files into `/etc/openshield-l7/`, then validate before first start:

```bash
openshield-l7 validate --root /etc/openshield-l7
# all configs valid (config.yaml + 1 site file(s) in /etc/openshield-l7/sites.d)
```

---

## systemd

### Standard unit

Ports 80/443 need `CAP_NET_BIND_SERVICE`; everything else runs unprivileged.

```ini
# /etc/systemd/system/openshield-l7.service
[Unit]
Description=OpenShield-L7 protected reverse proxy
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=openshield
Group=openshield
ExecStart=/usr/local/bin/openshield-l7 run --root /etc/openshield-l7
Restart=on-failure
RestartSec=2

# Binding 80/443 without root.
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true

# Hardening
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/etc/openshield-l7/sites.d /etc/openshield-l7/data
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now openshield-l7
```

### Transparent-mode variant

`client_ip.transparent: true` additionally needs `CAP_NET_ADMIN`, and the unit must not strip the privilege paths it relies on — drop `NoNewPrivileges`:

```ini
[Service]
# ... same as above, but:
AmbientCapabilities=CAP_NET_BIND_SERVICE CAP_NET_ADMIN
CapabilityBoundingSet=CAP_NET_BIND_SERVICE CAP_NET_ADMIN
# NoNewPrivileges intentionally left off: transparent mode needs caps.
```

The routing side (`ip rule`, `ip route`, iptables marks, sysctls) is **not** done by the proxy — install it once via network configuration or a companion oneshot unit. Full walkthrough: [Transparent Client IP → systemd companion unit](../architecture/transparent-ip.md).

::: warning
The proxy checks transparent-mode privileges **once at startup**. Missing privileges mean a loud log line and a graceful fallback to normal egress — the site keeps working, but the origin sees the proxy IP. Check the journal after enabling.
:::

---

## Kernel / sysctl Tuning

For high connection rates, `/etc/sysctl.d/90-openshield-l7.conf`:

```bash
# Accept queues
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.core.netdev_max_backlog = 65535

# Outbound connections to origins: reuse TIME_WAIT sockets, widen the
# ephemeral port range (the proxy is the *connector* toward origins).
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 10240 65535

# File descriptors (also LimitNOFILE in the unit)
fs.file-max = 2097152
```

Apply with `sysctl --system`. If conntrack is in play (transparent mode), also size `net.netfilter.nf_conntrack_max` — see [Transparent Client IP](../architecture/transparent-ip.md).

---

## Verify the Install

```bash
# 1. Service is up
systemctl status openshield-l7

# 2. Liveness (unauthenticated, loopback)
curl -s http://127.0.0.1:9090/api/v1/health
# {"status":"ok"}

# 3. A request through the proxy reaches the origin
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: example.com" http://127.0.0.1/
# 200

# 4. The event stream shows it
TOKEN="your-admin-token"
curl -sN -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9090/api/v1/events/stream | head -2
# data: {"kind":"request","ts_ms":...,"action":"allowed",...}
```

Also verify the **origin is locked down** — the proxy only protects traffic that passes through it:

```bash
ss -tlnp | grep <origin-port>    # must NOT show 0.0.0.0:<port>
```

If it does, rebind the origin to loopback/the private interface, and enforce it at the firewall anyway:

```bash
iptables -I INPUT -p tcp --dport <origin-port> ! -i lo -j DROP   # same-host origin
```

Only the proxy's own ports (80/443) should be publicly reachable. The admin API stays on `127.0.0.1:9090`; reach it remotely with `ssh -L 9090:127.0.0.1:9090`, not by rebinding.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `cannot load '/etc/openshield-l7/config.yaml'` | Missing/moved root | Pass `--root`, or let first-run bootstrap recreate the file. |
| `config.yaml invalid` at startup, listing errors | Bad global config | Fix every listed error; `openshield-l7 validate` reproduces the list without starting. |
| `permission denied` binding 80/443 | No `CAP_NET_BIND_SERVICE` | Use the systemd unit above, `setcap 'cap_net_bind_service=+ep' /usr/local/bin/openshield-l7`, or run as root. |
| Site serves 503 | Site `enabled: false` | `POST /api/v1/sites/{id}/enable`, or flip `enabled:` in the file. |
| Unknown hosts answer 421 | Working as designed | 421 = no site claimed that Host. Add the hostname to a site file. |
| 502 from one site | Origin down/unreachable | Origin failures produce 502 with backoff; check `origin.url`, timeouts, and the origin itself. |
| A site edit "did nothing" | The edit failed validation | Last good config keeps running by design; watch `config_reload` events or `POST /api/v1/reload` for the error list. |
| TLS site unreachable on 443 | Cert paths wrong / SNI unknown | `tls.cert_path`/`key_path` must exist at load; unknown SNI aborts the handshake by design. |
| Transparent mode: origin sees proxy IP | Privilege fallback | Startup log has the warning; grant `CAP_NET_ADMIN` per the transparent unit variant. |
| Nothing logs | `log_level` or `RUST_LOG` | `RUST_LOG` env overrides `log_level: "info"`; under systemd read `journalctl -u openshield-l7 -f`. |

---

## Upgrade

```bash
cargo build --release
./target/release/openshield-l7 validate --root /etc/openshield-l7   # configs against the new binary
install -m 0755 target/release/openshield-l7 /usr/local/bin/
systemctl restart openshield-l7
```

Config and quota state survive restarts (`config.yaml`, `sites.d/`, `data/quotas/`). Unknown config fields are ignored, so rolling back to an older binary is safe as long as you didn't rely on new-only fields.

---

## Uninstall

```bash
systemctl disable --now openshield-l7
rm /etc/systemd/system/openshield-l7.service
# optional companion unit for transparent mode:
# systemctl disable --now openshield-l7-transparent && rm /etc/systemd/system/openshield-l7-transparent.service
systemctl daemon-reload

rm /usr/local/bin/openshield-l7
rm -rf /etc/openshield-l7        # configs, certs, quota state — back up first if you care
rm /etc/sysctl.d/90-openshield-l7.conf && sysctl --system
userdel openshield
```

Firewall rules you added for origin lockdown and any transparent-mode `ip rule`/`ip route`/iptables marks are **not** removed by this — tear those down explicitly (the transparent page lists the exact `ExecStop` lines).
