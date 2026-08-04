# VPS & Dedicated Server Deployment

How OpenShield-XDP behaves across the three real-world topologies: installed
inside a VPS, on the dedicated host with routed IPs, and on a NAT'd host.

## The one thing to understand first

XDP attaches to a **network interface** and sees exactly the packets that
arrive on that interface's wire — nothing more, nothing less. Every packet
self-describes its destination IP and destination port (we parse the L3/L4
headers directly), so "which VPS is this for" and "which port is this for"
are read from the packet, never guessed.

## Model 1 — OpenShield inside each VPS (recommended for tenant VPSes)

Each VPS installs OpenShield on its own `eth0`.

- The VPS's XDP sees **only that VPS's traffic** — perfect per-tenant
  isolation. Customer A's flood never affects customer B's rules.
- Each tenant gets their own config, thresholds, presets, license.
- Works with KVM/QEMU, VMware, Xen, Hyper-V — the guest NIC just needs
  XDP (virtio works; we fall back to generic mode automatically).

## Model 2 — OpenShield on the dedicated host (bridged/routed VMs)

The host's physical NIC carries **all** VMs' traffic mixed together. Each
VPS has its own public IP, and that is the separation key:

- **Per-IP separation is automatic.** Scoring, bans, thresholds and the
  attack cap are all per *source* IP, and flows are distinguished by
  destination IP. Two VMs both running Minecraft on port 25565 do **not**
  overlap — they are different destination IPs. Port numbers are parsed
  per packet, but protection state is keyed by IP, so shared ports across
  VMs never collide.
- A flood aimed at VPS-A gets mitigated at the host level — before it ever
  reaches the VM. That *is* the protection working; a ban on the attack
  source only blocks traffic to the targeted VM's IP.
- The host's own services share the same wire. Whitelist your own admin IPs
  and consider whether the host OS itself should be protected or left
  mostly-pass-through.
- Set `dynamic.attack_min_pps` for the **aggregate** wire rate of all VMs
  combined, not for one VM.

## Model 3 — Dedicated host with NAT port-forwarding (avoid)

With DNAT, inbound packets arrive at the NIC with the **host's public IP**
as the destination — XDP runs *before* conntrack/NAT, so it cannot see
which VM the packet will eventually be forwarded to.

- Per-VM separation is **impossible at XDP level** here — every packet
  shows the host IP as destination.
- Port-forwarded services also collide by design (80 → VM-A:8080,
  81 → VM-B:80 looks like two ports on one IP).
- **Recommendation:** don't protect NAT'd tenants from the host. Install
  OpenShield **inside each VPS** (Model 1), or give the VMs routed/bridged
  public IPs (Model 2).

## What XDP can never see

Traffic **between VMs on the same host** (VM-A ↔ VM-B over the internal
bridge) never touches the physical NIC, so host-level XDP never sees it.
Only the VPSes themselves see that traffic — another reason Model 1 is the
most complete option for multi-tenant hosts.

## Quick reference

| Where installed | Sees | Per-VPS separation | Recommended |
|---|---|---|---|
| Inside each VPS | That VPS only | Perfect | ✅ Best for tenant VPSes |
| Host, routed/bridged VMs | All VMs + host | Automatic via per-IP | ✅ Good for your own fleet |
| Host, NAT port-forward | Host IP only | None | ❌ Install inside VPSes |
