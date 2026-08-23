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
      { text: 'L7 Proxy', link: '/openshield-l7/' },
      { text: 'GameFilter', link: '/gamefilter-xdp/' },
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
            { text: 'VPS & Dedicated Deployment', link: '/openshield-xdp/getting-started/vps-deployment' },
            { text: 'Upgrade', link: '/openshield-xdp/getting-started/upgrade' },
            { text: 'FAQ', link: '/openshield-xdp/getting-started/faq' },
          ]
        },
        {
          text: 'Features',
          collapsed: false,
          items: [
            { text: 'Everything It Does', link: '/openshield-xdp/features/' },
            { text: 'Attack Coverage', link: '/openshield-xdp/features/attack-coverage' },
            { text: 'Silent Guardians', link: '/openshield-xdp/features/silent-guardians' },
            { text: "What's New (2.0–2.4.0)", link: '/openshield-xdp/features/whats-new' },
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'For Server Owners', link: '/openshield-xdp/user-guide/' },
            { text: 'Config Values in Plain Language', link: '/openshield-xdp/user-guide/config-values' },
            { text: 'Auto-Fetch Blocklists', link: '/openshield-xdp/user-guide/auto-fetch' },
            { text: 'Geo Blocking', link: '/openshield-xdp/user-guide/geo-blocking' },
            { text: 'Recipes', link: '/openshield-xdp/user-guide/recipes' },
            { text: 'Troubleshooting', link: '/openshield-xdp/user-guide/troubleshooting' },
            { text: 'Metrics API', link: '/openshield-xdp/user-guide/metrics-api' },
            { text: 'Baseline Memory (ML Tab)', link: '/openshield-xdp/user-guide/baseline-ml' },
            { text: 'Configuration', link: '/openshield-xdp/user-guide/configuration' },
            { text: 'CLI Reference', link: '/openshield-xdp/user-guide/cli' },
            { text: 'TUI', link: '/openshield-xdp/user-guide/tui' },
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Full Reference', link: '/openshield-xdp/configuration/reference' },
            { text: 'Profiles & Presets', link: '/openshield-xdp/configuration/profiles' },
            { text: 'Validation', link: '/openshield-xdp/configuration/validation' },
            { text: 'Alerter', link: '/openshield-xdp/configuration/alerter' },
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
            { text: 'Adaptive Behavior', link: '/openshield-xdp/detection-engine/behavior' },
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
    {
      text: 'Firewall-Plus (Pterodactyl)',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/firewall-plus/' },
            { text: 'Installation', link: '/firewall-plus/getting-started/installation' },
            { text: 'Quick Start', link: '/firewall-plus/getting-started/quick-start' },
            { text: 'FAQ', link: '/firewall-plus/getting-started/faq' },
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/firewall-plus/configuration/reference' }
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'For Server Owners', link: '/firewall-plus/user-guide/for-server-owners' },
            { text: 'Rule Types', link: '/firewall-plus/user-guide/rules' },
            { text: 'API Reference', link: '/firewall-plus/user-guide/api' },
            { text: 'CLI Reference', link: '/firewall-plus/user-guide/cli' },
            { text: 'Webhooks & Alerts', link: '/firewall-plus/user-guide/webhooks' },
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/firewall-plus/architecture/overview' }
          ]
        }
      ]
    },
    {
      text: 'Panel Firewall (Pterodactyl)',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/panel-firewall/' },
            { text: 'Installation', link: '/panel-firewall/getting-started/installation' }
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/panel-firewall/configuration/reference' }
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'Daemon API', link: '/panel-firewall/user-guide/api' },
            { text: 'Webhooks & Alerts', link: '/panel-firewall/user-guide/webhooks' }
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/panel-firewall/architecture/overview' },
            { text: 'Protection Layers', link: '/panel-firewall/architecture/protection-layers' }
          ]
        }
      ]
    },
    {
      text: 'Glacier Pack (Pterodactyl)',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/glacier-pack/' },
            { text: 'Installation', link: '/glacier-pack/getting-started/installation' },
            { text: 'Quick Start', link: '/glacier-pack/getting-started/quick-start' }
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/glacier-pack/configuration/reference' }
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'The Dashboard', link: '/glacier-pack/user-guide/dashboard' },
            { text: 'Addon Guides', link: '/glacier-pack/user-guide/addons' }
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/glacier-pack/architecture/overview' }
          ]
        }
      ]
    },
    {
      text: 'Pterodactyl Revamp',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/pterodactyl-revamp/' },
            { text: 'Installation', link: '/pterodactyl-revamp/getting-started/installation' },
            { text: 'FAQ', link: '/pterodactyl-revamp/getting-started/faq' }
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/pterodactyl-revamp/configuration/reference' }
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'CLI Reference', link: '/pterodactyl-revamp/user-guide/cli' },
            { text: 'REST API', link: '/pterodactyl-revamp/user-guide/api' }
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/pterodactyl-revamp/architecture/overview' }
          ]
        }
      ]
    },
    {
      text: 'Apple Theme (Pterodactyl Admin)',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/apple/' },
            { text: 'Installation', link: '/apple/getting-started/installation' },
            { text: 'FAQ', link: '/apple/getting-started/faq' },
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/apple/configuration/reference' }
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'Using the Theme', link: '/apple/user-guide/using-the-theme' },
            { text: 'Extension Compatibility', link: '/apple/user-guide/compatibility' }
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/apple/architecture/overview' }
          ]
        }
      ]
    },
    {
      text: 'Sentinel (Pterodactyl)',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/pterodactyl-sentinel/' },
            { text: 'Installation', link: '/pterodactyl-sentinel/getting-started/installation' },
            { text: 'Quick Start', link: '/pterodactyl-sentinel/getting-started/quick-start' },
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/pterodactyl-sentinel/configuration/reference' }
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'Admin Panel', link: '/pterodactyl-sentinel/user-guide/admin-panel' },
            { text: 'CLI Reference', link: '/pterodactyl-sentinel/user-guide/cli' },
            { text: 'REST API', link: '/pterodactyl-sentinel/user-guide/api' },
            { text: 'Webhooks & Alerts', link: '/pterodactyl-sentinel/user-guide/webhooks' },
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/pterodactyl-sentinel/architecture/overview' },
            { text: 'Detectors', link: '/pterodactyl-sentinel/architecture/detectors' },
          ]
        }
      ]
    },
    {
      text: 'Blue Mod Installer (Pterodactyl)',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/blue-mod-installer/' },
            { text: 'Installation', link: '/blue-mod-installer/getting-started/installation' }
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/blue-mod-installer/configuration/reference' }
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'API Reference', link: '/blue-mod-installer/user-guide/api' }
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/blue-mod-installer/architecture/overview' }
          ]
        }
      ]
    },
    {
      text: 'Blue Plugin Installer (Pterodactyl)',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/blue-plugin-installer/' },
            { text: 'Installation', link: '/blue-plugin-installer/getting-started/installation' }
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/blue-plugin-installer/configuration/reference' }
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'API Reference', link: '/blue-plugin-installer/user-guide/api' }
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/blue-plugin-installer/architecture/overview' }
          ]
        }
      ]
    },
    {
      text: 'Blue Server Properties (Pterodactyl)',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/blue-server-properties/' },
            { text: 'Installation', link: '/blue-server-properties/getting-started/installation' }
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/blue-server-properties/configuration/reference' }
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'API Reference', link: '/blue-server-properties/user-guide/api' }
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/blue-server-properties/architecture/overview' }
          ]
        }
      ]
    },
    {
      text: 'Ask Access (Pterodactyl)',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/ask-access/' },
            { text: 'Installation', link: '/ask-access/getting-started/installation' }
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/ask-access/configuration/reference' }
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'Server Access Page', link: '/ask-access/user-guide/server-access-page' },
            { text: 'Client API', link: '/ask-access/user-guide/api' }
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/ask-access/architecture/overview' }
          ]
        }
      ]
    },
    {
      text: 'Trash Bin Pro (Pterodactyl)',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/trash-bin-pro/' },
            { text: 'Installation', link: '/trash-bin-pro/getting-started/installation' },
            { text: 'FAQ', link: '/trash-bin-pro/getting-started/faq' },
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/trash-bin-pro/configuration/reference' }
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'File Manager', link: '/trash-bin-pro/user-guide/file-manager' },
            { text: 'REST API', link: '/trash-bin-pro/user-guide/api' },
            { text: 'CLI Reference', link: '/trash-bin-pro/user-guide/cli' },
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/trash-bin-pro/architecture/overview' }
          ]
        }
      ]
    },
    {
      text: 'OpenShield-L7',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/openshield-l7/' },
            { text: 'Installation', link: '/openshield-l7/getting-started/installation' },
            { text: 'Quick Start', link: '/openshield-l7/getting-started/quick-start' },
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/openshield-l7/configuration/reference' },
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'CLI Reference', link: '/openshield-l7/user-guide/cli' },
            { text: 'Admin API', link: '/openshield-l7/user-guide/api' },
            { text: 'Hot Reload', link: '/openshield-l7/user-guide/hot-reload' },
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/openshield-l7/architecture/overview' },
            { text: 'Transparent Client IP', link: '/openshield-l7/architecture/transparent-ip' },
            { text: 'Testing & Benchmarks', link: '/openshield-l7/architecture/testing' },
          ]
        },
      ]
    },
    {
      text: 'GameFilter XDP',
      collapsed: true,
      items: [
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/gamefilter-xdp/' },
            { text: 'Installation', link: '/gamefilter-xdp/getting-started/installation' },
          ]
        },
        {
          text: 'Configuration',
          collapsed: true,
          items: [
            { text: 'Reference', link: '/gamefilter-xdp/configuration/reference' },
          ]
        },
        {
          text: 'User Guide',
          collapsed: true,
          items: [
            { text: 'CLI Reference', link: '/gamefilter-xdp/user-guide/cli' },
            { text: 'HTTP API', link: '/gamefilter-xdp/user-guide/api' },
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/gamefilter-xdp/architecture/overview' },
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
      message: 'Made by pingless.org — <a href="https://studio.pingless.org">PingLess Studios</a>',
    },

    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/AnAverageBeing/OpenShield-XDP/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
})