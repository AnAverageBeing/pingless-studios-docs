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
        { text: 'Overview', link: '/openshield-xdp/' },
        { text: 'Getting Started', link: '/openshield-xdp/getting-started/overview' },
        { text: 'Installation', link: '/openshield-xdp/getting-started/installation' },
        { text: 'Quick Start', link: '/openshield-xdp/getting-started/quick-start' },
        { text: 'Configuration', link: '/openshield-xdp/user-guide/configuration' },
        { text: 'CLI Reference', link: '/openshield-xdp/user-guide/cli' },
        { text: 'Architecture', link: '/openshield-xdp/architecture/overview' },
        { text: 'Detection Engine', link: '/openshield-xdp/detection-engine/overview' },
        { text: 'Mitigation', link: '/openshield-xdp/mitigation/overview' },
        { text: 'Performance', link: '/openshield-xdp/performance/overview' },
        { text: 'Development', link: '/openshield-xdp/development/guide' },
      ]
    },
    {
      text: 'RouteX Reverse Proxy',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/routex/' },
        { text: 'Installation', link: '/routex/getting-started/installation' },
        { text: 'Quick Start', link: '/routex/getting-started/quick-start' },
        { text: 'FAQ', link: '/routex/getting-started/faq' },
        { text: 'Global Config', link: '/routex/reference/global-config' },
        { text: 'Proxy Config', link: '/routex/reference/proxy-config' },
        { text: 'API Endpoints', link: '/routex/api/endpoints' },
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
