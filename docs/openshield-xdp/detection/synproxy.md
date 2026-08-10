# SYNPROXY (XDP SYN cookies)

Cookie-based SYN-flood protection at XDP: during a SYN flood the firewall answers SYNs itself with cryptographic-cookie challenges, so spoofed floods never reach your services while real clients connect normally.

## How It Works

1. When the mode is engaged, a pure TCP SYN is answered directly at the NIC driver with a SYN-ACK whose sequence number is a kernel-standard SYN cookie. Nothing is stored per connection.
2. A spoofed source never answers — the half-open connection never reaches your stack, so SYN-queue and memory pressure from floods disappears.
3. A real client answers with an ACK whose cookie checks out, and the packet continues to your kernel, which instantiates the connection as if it had seen the original SYN. From the client's perspective the handshake is completely normal.
4. In `adaptive` mode all of this only happens while the SYN rate is over `synproxy_threshold` or an attack is active — everyday traffic is never challenged.

## Configuration

```yaml
dynamic:
  synproxy_mode: "off"        # off (default) | adaptive | always
  synproxy_threshold: 10000   # per-CPU SYN pps that engages adaptive mode
```

## One-time setup note

For the kernel to accept cookie-validated connections, `net.ipv4.tcp_syncookies` must be `1` (default on most distros) and the netfilter SYNPROXY companion hook must be registered once.

**Automatic (recommended, v2.15.0+):** enable `dynamic.synproxy_companion_auto` — or just answer yes when the installer asks. The wizard verifies iptables is installed (offers to install it) and **live-probes the exact rules on your interface** before enabling; if the probe fails you get the precise reason and can skip or stop. At runtime OpenShield inserts the trio when the cookie path engages (attack in `adaptive` mode; at load in `always`) and removes exactly its own marker-tagged rules afterwards — hand-written rules and other firewall tools are never touched.

**Manual:** when the mode is not `off` and the companion is neither present nor auto-managed, the loader prints the exact two/three commands — in `adaptive` mode those lines can stay in place permanently; they are inert until a flood engages the cookie path.

::: tip Defense in depth
The per-IP SYN rate limiter (`syn_pps_threshold` scoring) keeps running in all modes, including alongside the cookie path.
:::

## Notes

- Works for both IPv4 and IPv6.
- Verification: 10/10 legitimate handshakes completed during an engaged cookie challenge on the test rig, while ~788k spoofed SYNs produced zero completed connections.
