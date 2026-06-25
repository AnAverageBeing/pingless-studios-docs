# openshield fix

Auto-detects and repairs common issues:

- Stale BPF pins from previous versions
- `/sys/fs/bpf` not mounted (auto-mounts)
- Dead PID files
- Stale socket files
- Orphaned XDP programs (force-detach via bpftool)
- Config map struct size mismatches
- Missing required directories

```bash
sudo openshield fix           # Quick repair
sudo openshield fix -v        # Verbose
```

Runs automatically when `openshield load` fails with map-related errors.

