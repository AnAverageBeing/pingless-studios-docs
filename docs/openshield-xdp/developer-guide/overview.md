# Developer Guide

::: warning Separate from user docs
This section is for developers working on OpenShield-XDP itself. If you're deploying OpenShield as a user, see [Getting Started](/openshield-xdp/getting-started/overview).
:::

## Development setup

```bash
git clone https://github.com/AnAverageBeing/OpenShield-XDP.git
cd OpenShield-XDP
make vmlinux     # Generate vmlinux.h (first time)
make all         # Full build
```

## Build targets

| Command | What it does |
|---------|-------------|
| `make ebpf` | Compile BPF kernel code (clang -target bpf) |
| `make generate` | Regenerate bpf2go Go bindings from BPF ELF |
| `make userspace` | Build Go binaries |
| `make all` | ebpf + generate + userspace |
| `make install` | Install to /opt/openshield |

## Fast iteration

```bash
# Edit BPF code in ebpf/
make ebpf && make generate && make userspace
cp bin/openshield-* /opt/openshield/bin/
sudo openshield fix && sudo openshield load --stats-off
```

## BPF verifier patterns

### Pointer bounds

Every pointer access must be bounds-checked before use:

```c
void *data = (void *)(long)ctx->data;
void *data_end = (void *)(long)ctx->data_end;

struct ethhdr *eth = data;
if ((void *)(eth + 1) > data_end)
    return XDP_DROP;
// eth->h_proto is now valid
```

### Packet pointer arithmetic

The verifier cannot track packet pointers through scalar arithmetic. Pre-load into a local:

```c
u64 pload = *(u64 *)(l4 + doff);  // One validated load
u8 byte0 = (u8)pload;             // Local access
u8 byte1 = (u8)(pload >> 8);
```

### Loop unrolling

All loops must have compile-time bounds. Use `#pragma unroll` or explicit unroll.

### Always inline

Every function in the XDP call chain must be `__always_inline`.

## Adding a detection module

1. Create `ebpf/modules/your_module.c`
2. Include headers from `../headers/`
3. Implement with `__always_inline`; return `0` (continue), `XDP_DROP`, `XDP_PASS`, or `XDP_TX`
4. Add prof index in `maps.h` (increment `max_entries`)
5. Add config fields in `config.h` (maintain 8-byte alignment)
6. Include in `openshield.bpf.c` and add call site
7. Add Go config fields in `config.go`, defaults in `defaults.go`
8. Wire in `loader.go`'s `writeConfig()`
9. Run `make generate && make userspace`

## Config struct alignment

Fields must be 8-byte aligned between C and Go. Verify:

```bash
bpftool btf dump file ebpf/openshield.bpf.o | grep 'config'
```

## Verifier check

```bash
bpftool prog load ebpf/openshield.bpf.o /sys/fs/bpf/test_verify type xdp
rm /sys/fs/bpf/test_verify
```

## Linting

```bash
cd userspace && go vet ./... && gofmt -l .
```
