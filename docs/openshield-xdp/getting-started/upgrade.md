# Upgrade

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

- [Configuration](/openshield-xdp/user-guide/configuration)
- [CLI Reference](/openshield-xdp/cli/commands)
