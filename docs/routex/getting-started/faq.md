# FAQ

## Does RouteX support UDP?

Yes. RouteX supports TCP, UDP, and TCP+UDP simultaneously on the same port range. UDP uses a session-based model with configurable idle timeout.

## Can I run multiple proxies at once?

Yes. Each `.yaml` file in `configs/proxies/` is a separate proxy instance. They run in isolated goroutine groups — a panic in one never crashes others.

## How does hot reload work?

RouteX watches the proxies directory with inotify (fsnotify). When a proxy config file changes, only that proxy is reloaded. Existing connections continue until EOF or the drain timeout. The file watcher debounces rapid saves (200ms window).

## Does L7 protection add latency?

No. The L7 engine wraps `net.Conn` with minimal overhead. The first read buffers N bytes for inspection, then forwards directly. Subsequent reads have zero inspection overhead. When L7 is disabled (`enabled: false`), the engine is never created.

## What happens when bandwidth quota is exceeded?

If `suspend_on_limit: true`, the proxy stops accepting new connections. Existing connections complete normally. The proxy resumes automatically when the quota window resets (hourly at the top of the hour, daily at midnight in the configured timezone).

## Can I manage ACL rules without restarting?

Yes. All 8 ACL API endpoints work live:
```bash
# Add a global blacklist rule
curl -X POST -H "X-API-Key: admin" \
  -H "Content-Type: application/json" \
  -d '{"action":"deny","cidr":"1.2.3.0/24","comment":"bad subnet"}' \
  http://localhost:9000/api/acl/global/rules
```
