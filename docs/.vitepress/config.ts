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
      { text: 'Bandwidth', link: '/bandwidth-manager/' },
    ],

    sidebar: [
    {
      text: 'OpenShield-XDP',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/openshield-xdp/' },
            { text: 'Installation', link: '/openshield-xdp/getting-started/installation' },
            { text: 'Quick Start', link: '/openshield-xdp/getting-started/quick-start' },
            { text: 'Upgrade', link: '/openshield-xdp/getting-started/upgrade' },
            { text: 'FAQ', link: '/openshield-xdp/getting-started/faq' },
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'Configuration', link: '/openshield-xdp/user-guide/configuration' },
            { text: 'CLI Reference', link: '/openshield-xdp/user-guide/cli' },
            { text: 'TUI', link: '/openshield-xdp/user-guide/tui' },
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/openshield-xdp/architecture/overview' },
            { text: 'Pipeline', link: '/openshield-xdp/architecture/pipeline' },
            { text: 'Bloom Filter', link: '/openshield-xdp/architecture/bloom-filter' },
          ]
        },
        {
          text: 'Detection Engine',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/openshield-xdp/detection-engine/overview' },
            { text: 'L3/L4 Validation', link: '/openshield-xdp/detection-engine/l3-l4' },
            { text: 'Rate-Based Scoring', link: '/openshield-xdp/detection-engine/rate-based' },
          ]
        },
        {
          text: 'Performance',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/openshield-xdp/performance/overview' },
            { text: 'Tuning', link: '/openshield-xdp/performance/tuning' },
            { text: 'Attack Testing Analysis', link: '/openshield-xdp/performance/attack-testing' },
          ]
        },
        {
          text: 'Development',
          collapsed: true,
          items: [
            { text: 'Guide', link: '/openshield-xdp/development/guide' },
            { text: 'Adding a Module', link: '/openshield-xdp/development/adding-module' },
          ]
        },
      ]
    },
    {
      text: 'LiteShield-XDP',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/liteshield-xdp/' },
            { text: 'Installation', link: '/liteshield-xdp/getting-started/installation' },
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/liteshield-xdp/configuration/reference' },
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'CLI Reference', link: '/liteshield-xdp/user-guide/cli' },
            { text: 'TUI Guide', link: '/liteshield-xdp/user-guide/tui' },
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/liteshield-xdp/architecture/overview' },
          ]
        },
        {
          text: 'Performance',
          collapsed: true,
          items: [
            { text: 'Benchmarks', link: '/liteshield-xdp/performance/benchmarks' },
          ]
        },
      ]
    },
    {
      text: 'RouteX Reverse Proxy',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/routex/' },
            { text: 'Installation', link: '/routex/getting-started/installation' },
            { text: 'Quick Start', link: '/routex/getting-started/quick-start' },
            { text: 'FAQ', link: '/routex/getting-started/faq' },
          ]
        },
        {
          text: 'Reference',
          collapsed: true,
          items: [
            { text: 'Global Config', link: '/routex/reference/global-config' },
            { text: 'Proxy Config', link: '/routex/reference/proxy-config' },
              { text: 'Comparison', link: '/routex/reference/comparison' },
          ]
        },
        {
          text: 'API',
          collapsed: true,
          items: [
            { text: 'Endpoints', link: '/routex/api/endpoints' },
          ]
        },
      ]
    },
    {
      text: 'Bandwidth Manager',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/bandwidth-manager/' },
            { text: 'Installation', link: '/bandwidth-manager/getting-started/installation' },
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/bandwidth-manager/configuration/reference' },
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'CLI Reference', link: '/bandwidth-manager/user-guide/cli' },
            { text: 'TUI Guide', link: '/bandwidth-manager/user-guide/tui' },
            { text: 'Webhooks', link: '/bandwidth-manager/user-guide/webhooks' },
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'System Overview', link: '/bandwidth-manager/architecture/overview' },
            { text: 'TC Deep Dive', link: '/bandwidth-manager/architecture/tc-explained' },
          ]
        },
      ]
    },
    {
      text: 'S3 Database Storage for VPS',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/s3-database-storage-for-vps/' },
            { text: 'Installation', link: '/s3-database-storage-for-vps/getting-started/installation' }
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/s3-database-storage-for-vps/configuration/reference' }
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'CLI Reference', link: '/s3-database-storage-for-vps/user-guide/cli' },
            { text: 'The Extractor', link: '/s3-database-storage-for-vps/user-guide/extractor' },
            { text: 'Discord Webhooks', link: '/s3-database-storage-for-vps/user-guide/webhooks' }
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/s3-database-storage-for-vps/architecture/overview' }
          ]
        }
      ]
    },
    {
      text: 'Penetration-v3',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/pentest-v3/' },
            { text: 'Installation', link: '/pentest-v3/getting-started/installation' }
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/pentest-v3/configuration/reference' }
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'CLI Reference', link: '/pentest-v3/user-guide/cli' },
            { text: 'Methods', link: '/pentest-v3/user-guide/methods' }
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/pentest-v3/architecture/overview' }
          ]
        }
      ]
    },
    {
      text: 'Bandwidth Monitor (Pterodactyl)',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/pterodactyl-bandwidth-monitor/' },
            { text: 'Installation', link: '/pterodactyl-bandwidth-monitor/getting-started/installation' },
            { text: 'Quick Start', link: '/pterodactyl-bandwidth-monitor/getting-started/quick-start' },
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/pterodactyl-bandwidth-monitor/configuration/reference' }
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'Admin Panel', link: '/pterodactyl-bandwidth-monitor/user-guide/admin-panel' },
            { text: 'CLI Reference', link: '/pterodactyl-bandwidth-monitor/user-guide/cli' },
            { text: 'REST API', link: '/pterodactyl-bandwidth-monitor/user-guide/api' },
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/pterodactyl-bandwidth-monitor/architecture/overview' },
            { text: 'Enforcement Engine', link: '/pterodactyl-bandwidth-monitor/architecture/enforcement' },
          ]
        }
      ]
    },
    {
      text: 'Glacier Theme (Pterodactyl)',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/glacier/' },
            { text: 'Installation', link: '/glacier/getting-started/installation' }
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/glacier/configuration/reference' }
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'Admin Hub', link: '/glacier/user-guide/admin-hub' },
            { text: 'Tab Manager', link: '/glacier/user-guide/tabs' },
            { text: 'Per-User Settings', link: '/glacier/user-guide/user-settings' }
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/glacier/architecture/overview' }
          ]
        }
      ]
    },
    {
      text: 'Protection Plus',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/protection/' },
            { text: 'Installation', link: '/protection/getting-started/installation' },
            { text: 'Quick Start', link: '/protection/getting-started/quick-start' },
            { text: 'FAQ', link: '/protection/getting-started/faq' },
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/protection/configuration/reference' },
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'CLI Reference', link: '/protection/user-guide/cli' },
            { text: 'Detection Methods', link: '/protection/user-guide/detection' },
            { text: 'Antivirus', link: '/protection/user-guide/antivirus' },
            { text: 'Alerts', link: '/protection/user-guide/alerts' },
            { text: 'Actions & Rules', link: '/protection/user-guide/actions-rules' },
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/protection/architecture/overview' },
          ]
        },
      ]
    },
    {
      text: 'NitroCord',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/nitrocord/' },
            { text: 'Installation', link: '/nitrocord/getting-started/installation' },
            { text: 'Quick Start', link: '/nitrocord/getting-started/quick-start' },
            { text: 'Licensing', link: '/nitrocord/getting-started/licensing' },
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/nitrocord/configuration/reference' },
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'Command Reference', link: '/nitrocord/user-guide/cli' },
            { text: 'Plugin API', link: '/nitrocord/user-guide/api' },
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/nitrocord/architecture/overview' },
            { text: 'Attack Mode', link: '/nitrocord/architecture/attack-mode' },
            { text: 'Fall-Check Verification', link: '/nitrocord/architecture/verification' },
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