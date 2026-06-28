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

    sidebar: [
    {
      text: 'OpenShield-XDP',
      collapsed: false,
      items: [
        {
          text: 'Getting Started',
          collapsed: false,
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
      text: 'RouteX Reverse Proxy',
      collapsed: false,
      items: [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/routex/' },
            { text: 'Installation', link: '/routex/getting-started/installation' },
            { text: 'Quick Start', link: '/routex/getting-started/quick-start' },
            { text: 'FAQ', link: '/routex/getting-started/faq' },
          ]
        },
        {
          text: 'Reference',
          collapsed: false,
          items: [
            { text: 'Global Config', link: '/routex/reference/global-config' },
            { text: 'Proxy Config', link: '/routex/reference/proxy-config' },
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
