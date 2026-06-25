# freplace Design

Individual pipeline stages in `ebpf/modules/` can compile as standalone `freplace` programs:

- `ban_check` — replace ban lookup path
- `rate_limit` — replace rate threshold path
- `conn_track` — replace connection tracking
- `dns_amp` — replace DNS amplification check
- `l7_filter` — replace L7 signature matching

**Benefits**: hot-patch individual stages without reloading main XDP, independent compilation, smaller verifier footprint.

Currently `#include`d directly. freplace loading via `cilium/ebpf.AttachFreplace` pending upstream kernel support (kernel ≥ 5.11, `CONFIG_DEBUG_INFO_BTF=y`).

