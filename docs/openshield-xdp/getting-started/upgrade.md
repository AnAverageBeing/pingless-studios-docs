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
| SYNPROXY cookies | Cleared (invalid after restart) |

## Verification

After upgrading, confirm the program loaded correctly:

```bash
sudo openshield status
sudo openshield reload   # Verify config is valid
```

## Next steps

- [Configuration](/openshield-xdp/user-guide/configuration)
- [CLI Reference](/openshield-xdp/reference/cli)

