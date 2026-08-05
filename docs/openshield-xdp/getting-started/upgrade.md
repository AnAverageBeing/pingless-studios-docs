# Upgrade

## Upgrading from 1.9.x to 2.1.x

v2.0 → v2.1.1 is a feature-heavy jump. The upgrade path is the standard one (`git pull && sudo ./install.sh --update`, or `sudo openshield upgrade`), but here's what changes behavior and what's worth reconfiguring.

### What you get

- **Established-connection exemption** (`static.ct_established_exempt`, default `true`) — sources with a proven TCP session are exempt from PPS/BPS/TCP scoring. Bulk uploads (SFTP, backups) no longer get banned.
- **Per-port threshold overrides** (`static.port_thresholds`, max 8) — per-port/range PPS/BPS limits that replace the globals, in peacetime and attack mode.
- **Attack per-port cap** (`dynamic.attack_port_pps`) — aggregate per-destination-port PPS cap during declared attacks. Rotation-proof against spoofed floods; legit traffic on the port is throttled, not banned.
- **New-source floods now temp-ban** each excess new source for `dynamic.new_source_ban_duration` seconds (previously dropped only one packet — useless against rotation).
- **Behavior engine auto-block** (`behavior.auto_block`, default `true` since 2.1.0) — lookalike bot clusters at ≥85% confidence are auto-banned for 1 hour. Set `false` for report-only mode.
- **Metrics API** (`metrics:` section, default off) — HTTP JSON endpoint with everything the TUI shows. Manage the key with `openshield key` / `key set` / `key regen`.
- **CLI aliases** — `st`, `wl`, `bl`, `lic`, `cfg`, `dash`.
- **Whitelist persistence** — `openshield whitelist add/remove` now writes through to the YAML config and survives loader restarts.
- **Richer forensics** — attack bundles now include `config_snapshot.txt` and `config_changes.txt`.
- **`openshield uninstall`** — clean removal (also `uninstall.sh`).

### What to reconfigure

- **Preset scoring was retuned in 2.1.1.** Single-source floods that were mathematically unbannable on the Gaming/Hosting/Performance/CDN presets now get banned in seconds. **Existing installs keep their old values** — run `sudo openshield reconfigure` to pick up the retuned numbers (or edit scores manually).
- New config sections get defaults automatically; you don't have to add them by hand. Generate an annotated reference with `sudo openshield config` if you want to see every new key.
- If you previously worked around upload bans with high global thresholds, you can now tighten globals back down and rely on `ct_established_exempt` + `port_thresholds` instead.

### License note

Your existing license key is untouched by the upgrade — it lives in `/etc/openshield/openshield.yaml` (`license.key`) with its cache at `/var/lib/openshield/license.json`, both of which survive. No reactivation is needed. If a fresh install asks for a key, use `sudo openshield license activate <key>` or `openshield lic status` to check state.

## Between versions

```bash
cd OpenShield-XDP
git pull
sudo ./install.sh --update
```

::: warning Config struct changes
When upgrading between versions that change the `config` struct, stale pinned maps must be cleared. The installer handles this automatically. If you upgrade manually, run `sudo openshield fix` before loading.
:::

## `openshield upgrade` command (EXPERIMENTAL)

```bash
sudo openshield upgrade
```

Performs a 5-step automated upgrade:
1. `git pull` (or `git clone` if no repo found)
2. `make ebpf` — rebuild BPF programs
3. `make generate` — regenerate bpf2go Go bindings
4. `make userspace` — rebuild Go binaries
5. Stop loader → install new binaries → restart

::: danger Security caveat
`openshield upgrade` runs `git clone` and `make` as **root**. This is comparable to any package manager — but the upgrade pulls from GitHub and executes a build pipeline with root privileges. For production environments, prefer the manual `git pull && sudo ./install.sh --update` workflow, which lets you inspect changes before installing.
:::

## Rolling back

Git tags mark stable releases. To roll back:

```bash
git checkout <tag>
sudo ./install.sh --update
```

## What survives an upgrade

| Data | Survives |
|------|----------|
| Active bans | Yes (pinned maps persist) |
| Subnet bans | Yes |
| Whitelist | Repopulated from YAML |
| Configuration | Kept unless config format changed |
| IP statistics | Cleared (fresh start) |
| Baseline (EMA) | Restored from `baseline.json` |
| Per-IP SYN counters | Cleared (fresh start; rate-based SYN gate re-learns) |

## Verification

After upgrading, confirm the program loaded correctly:

```bash
sudo openshield status
sudo openshield reload   # Verify config is valid
```

## Next steps

- [User Guide](/openshield-xdp/user-guide/) — setup and tuning in plain language
- [Configuration](/openshield-xdp/user-guide/configuration)
- [CLI Reference](/openshield-xdp/user-guide/cli)
