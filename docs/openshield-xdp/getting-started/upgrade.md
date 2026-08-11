# Upgrade

## Automatic updates (v2.16+, recommended)

OpenShield-XDP ships with a signed auto-update channel. On licensed installs it is **on by default**: the loader checks for new releases every 6 hours and installs them unattended.

```bash
# Manual, any time:
sudo openshield update
```

What happens on every update (manual or automatic):

1. The loader fetches the latest release metadata from the license server and verifies its **Ed25519 signature** (the same key that signs your license — a forged release notice fails verification).
2. The updates worker **re-validates your license key** and only then issues a 5-minute download URL. No license, no download.
3. The downloaded zip is checked against the **signed SHA-256** before anything is installed.
4. Current binaries are backed up, the new ones installed, and the service restarted. If the new build fails to come up, the previous version is **restored automatically**.

Config (`/etc/openshield/openshield.yaml`):

```yaml
updates:
  enabled: true   # check for new releases + TUI badge
  auto: true      # install automatically (licensed installs)
  endpoint: ""    # override only for a self-hosted channel
```

- `enabled: true, auto: false` → you get a badge in the TUI top bar (`↑ v2.x.x`) and a log line; install with `sudo openshield update` when ready.
- Unlicensed installs see the badge but are not served downloads.
- Rollback manually if ever needed: the previous binaries are in `/opt/openshield/backup/<version>/`.

## Manual upgrade (from the release zip)

If you prefer to inspect before installing:

```bash
unzip openshield-xdp-X.Y.Z.zip
cd OpenShield-XDP
sudo ./install.sh --update
```

::: warning Config struct changes
When upgrading between versions that change the `config` struct, stale pinned maps must be cleared. The installer handles this automatically. If you upgrade manually, run `sudo openshield fix` before loading.
:::

## Rolling back

An automatic update keeps the previous binaries under `/opt/openshield/backup/<version>/`. To roll back, copy them back over `/opt/openshield/bin/` and `/usr/local/bin/openshield`, then `sudo systemctl restart openshield-loader`.

## License note

Your license key is untouched by upgrades — it lives in `/etc/openshield/openshield.yaml` (`license.key`) with its cache at `/var/lib/openshield/license.json`. No reactivation is needed.
