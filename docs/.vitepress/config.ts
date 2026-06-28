import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid({
  title: 'PingLess Studios',
  description: 'Open-source infrastructure tools',
  base: '/pingless-studios-docs/',
  lang: 'en-US',
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: true,
  mermaid: {
    theme: 'dark',
  },

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/pingless-studios-docs/pingles.png' }],
    ['meta', { name: 'theme-color', content: '#89b4fa' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'PingLess Studios Docs' }],
    ['meta', { property: 'og:site_name', content: 'PingLess Studios' }],
  ],

  themeConfig: {
    logo: '/pingles.png',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/openshield-xdp/' },
      { text: 'GitHub', link: 'https://github.com/AnAverageBeing' },
    ],

    sidebar: {
      '/openshield-xdp/': [
        {
          text: 'OpenShield-XDP',
          collapsible: true,
          collapsed: false,
          items: [
            {
              text: 'Getting Started',
              collapsible: true,
              collapsed: false,
              items: [
                { text: 'Overview', link: '/openshield-xdp/getting-started/overview' },
                { text: 'Installation', link: '/openshield-xdp/getting-started/installation' },
                { text: 'Quick Start', link: '/openshield-xdp/getting-started/quick-start' },
                { text: 'Upgrade', link: '/openshield-xdp/getting-started/upgrade' },
                { text: 'FAQ', link: '/openshield-xdp/getting-started/faq' },
              ]
            },
            {
              text: 'User Guide',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Configuration', link: '/openshield-xdp/user-guide/configuration' },
                { text: 'CLI Reference', link: '/openshield-xdp/user-guide/cli' },
                { text: 'TUI', link: '/openshield-xdp/user-guide/tui' },
              ]
            },
            {
              text: 'Configuration',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Reference', link: '/openshield-xdp/configuration/reference' },
                { text: 'Validation & Runtime Updates', link: '/openshield-xdp/configuration/validation' },
                { text: 'Alerter & Telemetry', link: '/openshield-xdp/configuration/alerter' },
              ]
            },
            {
              text: 'Architecture',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Overview', link: '/openshield-xdp/architecture/overview' },
                { text: 'Pipeline', link: '/openshield-xdp/architecture/pipeline' },
                { text: 'Map Layout', link: '/openshield-xdp/architecture/maps' },
                { text: 'Bloom Filter', link: '/openshield-xdp/architecture/bloom-filter' },
                { text: 'freplace Design', link: '/openshield-xdp/architecture/freplace' },
                { text: 'Kernel Feature Gates', link: '/openshield-xdp/architecture/kernel-gates' },
              ]
            },
            {
              text: 'Detection Engine',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Overview', link: '/openshield-xdp/detection-engine/overview' },
                { text: 'Pipeline', link: '/openshield-xdp/detection-engine/pipeline' },
                { text: 'L2/L3/L4 Validation', link: '/openshield-xdp/detection-engine/l3-l4' },
                { text: 'Rate-Based Scoring', link: '/openshield-xdp/detection-engine/rate-based' },
                { text: 'Connection Tracking', link: '/openshield-xdp/detection-engine/conn-track' },
                { text: 'SYNPROXY', link: '/openshield-xdp/detection-engine/synproxy' },
              ]
            },
            {
              text: 'Mitigation',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Overview', link: '/openshield-xdp/mitigation/overview' },
                { text: 'Ban System', link: '/openshield-xdp/mitigation/bans' },
                { text: 'Rate Limiting', link: '/openshield-xdp/mitigation/rate-limiting' },
                { text: 'Whitelist', link: '/openshield-xdp/mitigation/whitelist' },
              ]
            },
            {
              text: 'Security',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Threat Model', link: '/openshield-xdp/security/threat-model' },
              ]
            },
            {
              text: 'Performance',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Overview', link: '/openshield-xdp/performance/overview' },
                { text: 'Optimizations', link: '/openshield-xdp/performance/optimizations' },
                { text: 'Tuning', link: '/openshield-xdp/performance/tuning' },
              ]
            },
            {
              text: 'Reference',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Benchmarks', link: '/openshield-xdp/reference/benchmarks' },
              ]
            },
            {
              text: 'Development',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Environment Setup', link: '/openshield-xdp/development/guide' },
                { text: 'Developer Guide', link: '/openshield-xdp/developer-guide/overview' },
                { text: 'Adding a Module', link: '/openshield-xdp/development/adding-module' },
                { text: 'BPF Patterns', link: '/openshield-xdp/development/bpf-patterns' },
                { text: 'Config Alignment', link: '/openshield-xdp/development/config-alignment' },
              ]
            },
          ]
        },
      ],
    },
,    '/routex/': [
      {
        text: 'RouteX Reverse Proxy',
        collapsible: true,
        collapsed: false,
        items: [
          {
            text: 'Getting Started',
            collapsible: true,
            collapsed: false,
            items: [
              { text: 'Overview', link: '/routex/getting-started/overview' },
              { text: 'Installation', link: '/routex/getting-started/installation' },
              { text: 'Quick Start', link: '/routex/getting-started/quick-start' },
              { text: 'FAQ', link: '/routex/getting-started/faq' },
            ]
          },
          {
            text: 'Reference',
            collapsible: true,
            collapsed: true,
            items: [
              { text: 'Global Config', link: '/routex/reference/global-config' },
              { text: 'Proxy Config', link: '/routex/reference/proxy-config' },
            ]
          },
          {
            text: 'API',
            collapsible: true,
            collapsed: true,
            items: [
              { text: 'Endpoints', link: '/routex/api/endpoints' },
            ]
          },
        ]
      },
    ],


    socialLinks: [
      { icon: 'github', link: 'https://github.com/AnAverageBeing' },
      { icon: 'discord', link: 'https://discord.gg/qgBMREWWgp' },
    ],

    footer: {
      message: 'Maintained by <a href="https://github.com/AnAverageBeing">AnAverageBeing</a> — <a href="https://studio.pingless.org">PingLess Studios</a>',
    },

    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/AnAverageBeing/OpenShield-XDP/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
})
