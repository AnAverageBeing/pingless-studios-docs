---
layout: home

hero:
  name: "PingLess Studios"
  text: "Open-source infrastructure"
  tagline: "XDP-native DDoS mitigation, developer tools, and networking utilities. Built and maintained by AnAverageBeing."
  actions:
    - theme: brand
      text: View Docs
      link: /openshield-xdp/
    - theme: alt
      text: GitHub
      link: https://github.com/AnAverageBeing

features:
  - icon: <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    title: OpenShield-XDP
    details: DDoS mitigation at the NIC driver level. 42 detection vectors, suspicion scoring, SYNPROXY cookies, entropy spoofing detection. 10M+ PPS per core.
    link: /openshield-xdp/
  - icon: <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
    title: More in Development
    details: Additional open-source infrastructure tools coming soon. Networking, monitoring, and security projects.
---

## Projects

<div class="project-grid">

  <a href="/openshield-xdp/" class="project-card">
    <h3>OpenShield-XDP</h3>
    <p>XDP-native DDoS mitigation firewall. Inspects and drops attack traffic before the kernel allocates an skb. 42 detection vectors, 13 ban reason codes, 17 BPF maps, full TUI.</p>
    <span class="badge">eBPF</span>
    <span class="badge">XDP</span>
    <span class="badge">Go</span>
    <span class="badge">DDoS</span>
  </a>

  <div class="project-card placeholder">
    <h3>More projects under development</h3>
    <p>Additional tools and utilities are in the pipeline. Check back or follow the GitHub for updates.</p>
    <span class="badge">coming soon</span>
  </div>

</div>

<style>
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 24px;
}
.project-card {
  display: block;
  padding: 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  text-decoration: none;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  transition: border-color 0.2s, background 0.2s;
}
.project-card:hover {
  border-color: var(--vp-c-brand);
  background: var(--vp-c-bg-mute);
  text-decoration: none;
}
.project-card h3 {
  margin: 0 0 8px;
  font-size: 1.1em;
  color: var(--vp-c-brand);
}
.project-card p {
  margin: 0 0 12px;
  font-size: 0.9em;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}
.project-card.placeholder {
  opacity: 0.5;
}
.project-card.placeholder h3 {
  color: var(--vp-c-text-2);
}
.badge {
  display: inline-block;
  padding: 2px 8px;
  margin: 2px;
  border-radius: 4px;
  font-size: 0.75em;
  font-weight: 600;
  color: var(--vp-c-brand);
  background: var(--vp-c-brand-soft);
  border: 1px solid var(--vp-c-brand-dim);
}
</style>
