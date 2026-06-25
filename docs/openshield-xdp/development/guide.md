# Developer Guide

## Build

```bash
make vmlinux     # Once: generate vmlinux.h
make all         # Full build
```

## Iteration Loop

```bash
make ebpf && make generate && make userspace
cp bin/openshield-* /opt/openshield/bin/
sudo openshield fix && sudo openshield load --stats-off
```

## Lint

```bash
cd userspace && go vet ./... && gofmt -l .
```

## Verifier Check

```bash
bpftool prog load ebpf/openshield.bpf.o /sys/fs/bpf/test_verify type xdp
rm -f /sys/fs/bpf/test_verify
```

