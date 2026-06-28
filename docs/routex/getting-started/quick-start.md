# Quick Start

## 1. Build

```bash
git clone https://github.com/AnAverageBeing/RouteX-Reverse-Proxy.git
cd RouteX-Reverse-Proxy
make build
```

## 2. Configure

Edit `configs/global.yaml` to set your API keys:

```yaml
api:
  enabled: true
  bind: "0.0.0.0:9000"
  api_keys:
    - key: "your-secret-key"
      label: "admin"
      permissions: ["*"]
```

Edit `configs/proxies/minecraft.yaml` to point to your backend:

```yaml
name: "minecraft-main"
origin-ip: "0.0.0.0"
origin-port: "25565"
dest-ip: "10.0.0.1"
dest-port: "25565"
protocol: "tcp"
```

## 3. Run

```bash
./bin/routex -config configs/global.yaml -proxies configs/proxies
```

## 4. Verify

```bash
# Health check
curl http://localhost:9000/api/health

# List proxies (requires API key)
curl -H "X-API-Key: your-secret-key" http://localhost:9000/api/proxies

# View metrics
curl -H "X-API-Key: your-secret-key" "http://localhost:9000/metrics?format=prometheus"
```
