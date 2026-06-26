import{_ as t,o as a,c as i,a2 as n}from"./chunks/framework.ByXR59UU.js";const o=JSON.parse('{"title":"Pipeline","description":"","frontmatter":{},"headers":[],"relativePath":"openshield-xdp/architecture/pipeline.md","filePath":"openshield-xdp/architecture/pipeline.md","lastUpdated":1782412920000}'),e={name:"openshield-xdp/architecture/pipeline.md"};function l(p,s,d,r,h,E){return a(),i("div",null,[...s[0]||(s[0]=[n(`<h1 id="pipeline" tabindex="-1">Pipeline <a class="header-anchor" href="#pipeline" aria-label="Permalink to &quot;Pipeline&quot;">​</a></h1><p>12 ordered stages. Drop checks ordered by cost.</p><div class="language-mermaid vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">mermaid</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">graph TD</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    A[Packet] --&gt; B{MAC filter}</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    B --&gt;|drop| DROP[DROP]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    B --&gt;|pass| C[parse]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    C --&gt; D{Malformed}</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    D --&gt;|yes| DROP</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    D --&gt;|no| E{SYNPROXY}</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    E --&gt;|SYN| F[Cookie, XDP_TX]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    E --&gt;|ACK| G{Valid}</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    G --&gt;|no| DROP</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    G --&gt;|yes| H[XDP_PASS]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    E --&gt;|other| I{Whitelist}</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    I --&gt;|bypass| H</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    I --&gt;|no| J{Ban}</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    J --&gt;|yes| DROP</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    J --&gt;|no| K{Validation}</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    K --&gt;|fail| DROP</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    K --&gt;|pass| L{UDP amp}</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    L --&gt;|yes| DROP</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    L --&gt;|no| M{L7 sig}</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    M --&gt;|yes| DROP</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    M --&gt;|no| N{Conn track}</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    N --&gt;|fail| DROP</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    N --&gt;|pass| O{Rate limit}</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    O --&gt;|fail| DROP</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    O --&gt;|pass| H</span></span></code></pre></div><table tabindex="0"><thead><tr><th>#</th><th>Stage</th><th>Action</th></tr></thead><tbody><tr><td>0</td><td>MAC filter</td><td>L2 blacklist/whitelist before IP parse</td></tr><tr><td>1</td><td>Packet parse</td><td>Ethernet, VLAN (×2), IPv4/IPv6, ext headers, TCP/UDP</td></tr><tr><td>2</td><td>SYNPROXY</td><td>Cookie-based SYN flood mitigation (when enabled)</td></tr><tr><td>3</td><td>Panic breaker</td><td>Per-CPU probabilistic bulk drop</td></tr><tr><td>4</td><td>Whitelist</td><td>Per-IP bypass flags, empty-map fast path</td></tr><tr><td>5</td><td>Ban / subnet ban</td><td>Single IP + LPM trie CIDR bans</td></tr><tr><td>6</td><td>Validation</td><td>Private/bogon source, bogus TCP, malformed L4</td></tr><tr><td>7</td><td>UDP amplification</td><td>DNS + generic 8-port</td></tr><tr><td>8</td><td>L7 signatures</td><td>16 configurable pattern rules</td></tr><tr><td>9</td><td>Connection tracking</td><td>Blind SYN-ACK/RST detection</td></tr><tr><td>10</td><td>Rate limiting</td><td>Threshold scoring or token bucket</td></tr><tr><td>11</td><td>PASS</td><td>Packet reaches kernel</td></tr></tbody></table>`,4)])])}const c=t(e,[["render",l]]);export{o as __pageData,c as default};
