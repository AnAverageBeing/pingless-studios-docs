import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'PingLess Studios',
  description: 'Open-source infrastructure tools',
  base: '/pingless-studios-docs/',
  lang: 'en-US',
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: true,

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
      { text: 'Projects', link: '/projects/' },
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
              text: 'Detection Engine',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Overview', link: '/openshield-xdp/detection-engine/overview' },
                { text: 'Pipeline', link: '/openshield-xdp/detection-engine/pipeline' },
              ]
            },
            {
              text: 'Mitigation',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Overview', link: '/openshield-xdp/mitigation/overview' },
              ]
            },
            {
              text: 'Architecture',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Overview', link: '/openshield-xdp/architecture/overview' },
              ]
            },
            {
              text: 'Developer Guide',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Overview', link: '/openshield-xdp/developer-guide/overview' },
              ]
            },
          ]
        },
      ],
    },

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
