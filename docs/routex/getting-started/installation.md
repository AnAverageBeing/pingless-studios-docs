# Installation

## Automated Installer (Recommended)

```bash
curl -sSL https://raw.githubusercontent.com/AnAverageBeing/RouteX-Reverse-Proxy/main/install.sh | sudo bash
```

Or locally:
```bash
sudo bash install.sh /opt/routex
```

### Supported Distributions

| Distribution | Package Manager |
|-------------|----------------|
| Debian / Ubuntu / Pop!_OS / Mint / Kali | apt |
| RHEL / CentOS / Rocky / Alma / Fedora / Amazon Linux | dnf / yum |
| Arch / Manjaro / EndeavourOS | pacman |
| Alpine Linux | apk |

### What the Installer Does

1. Detects OS automatically
2. Installs all system dependencies (iptables, sqlite3, gcc, pkg-config)
3. Installs Go 1.22+ if not present
4. Checks iptables kernel modules (xt_hashlimit, xt_connlimit, xt_recent, xt_state)
5. Builds RouteX → `/usr/local/bin/routex`
6. Installs systemd service with appropriate capabilities
7. Verifies firewall (UFW/firewalld) configuration

## Manual Installation

### Prerequisites

- Go 1.22+
- iptables
- sqlite3 + development headers
- gcc + pkg-config

### Build

```bash
git clone https://github.com/AnAverageBeing/RouteX-Reverse-Proxy.git
cd RouteX-Reverse-Proxy
go mod download
make build
```

### Run

```bash
./bin/routex -config configs/global.yaml -proxies configs/proxies
```
