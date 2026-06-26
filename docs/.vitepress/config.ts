import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'PingLess Studios',
  description: 'Open-source infrastructure tools — XDP firewalls, DDoS mitigation, developer utilities',
  base: '/pingless-studios-docs/',
  lang: 'en-US',
  lastUpdated: true,
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', href: '/pingless.svg' }],
    ['meta', { name: 'theme-color', content: '#89b4fa' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'PingLess Studios Docs' }],
    ['meta', { property: 'og:site_name', content: 'PingLess Studios' }],
  ],

  themeConfig: {
    logo: '/pingless.svg',
    nav: [
      { text: 'OpenShield-XDP', link: '/openshield-xdp/' },
      { text: 'Projects', link: '/projects/' },
    ],

    sidebar: {
      '/openshield-xdp/': [
        {
          text: 'OpenShield-XDP',
          items: [
            { text: 'Overview', link: '/openshield-xdp/' },
            { text: 'Installation', link: '/openshield-xdp/guide/installation' },
            { text: 'Quick Start', link: '/openshield-xdp/guide/quick-start' },
          ]
        },
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/openshield-xdp/architecture/overview' },
            { text: 'Pipeline', link: '/openshield-xdp/architecture/pipeline' },
            { text: 'Map Layout', link: '/openshield-xdp/architecture/maps' },
            { text: 'freplace Design', link: '/openshield-xdp/architecture/freplace' },
          ]
        },
        {
          text: 'Configuration',
          items: [
            { text: 'Reference', link: '/openshield-xdp/configuration/reference' },
            { text: 'Validation & Whitelist', link: '/openshield-xdp/configuration/validation' },
            { text: 'Alerter & Telemetry', link: '/openshield-xdp/configuration/alerter' },
          ]
        },
        {
          text: 'Detection',
          items: [
            { text: 'Overview', link: '/openshield-xdp/detection/overview' },
            { text: 'L2 / L3 / L4', link: '/openshield-xdp/detection/l3-l4' },
            { text: 'Rate-Based', link: '/openshield-xdp/detection/rate-based' },
            { text: 'Connection Tracking', link: '/openshield-xdp/detection/conn-track' },
            { text: 'Amplification & L7', link: '/openshield-xdp/detection/amplification' },
            { text: 'Statistical', link: '/openshield-xdp/detection/statistical' },
            { text: 'SYNPROXY', link: '/openshield-xdp/detection/synproxy' },
          ]
        },
        {
          text: 'Mitigation',
          items: [
            { text: 'Overview', link: '/openshield-xdp/mitigation/overview' },
            { text: 'Ban System', link: '/openshield-xdp/mitigation/bans' },
            { text: 'Rate Limiting', link: '/openshield-xdp/mitigation/rate-limiting' },
            { text: 'Whitelist', link: '/openshield-xdp/mitigation/whitelist' },
          ]
        },
        {
          text: 'Performance',
          items: [
            { text: 'Benchmarks', link: '/openshield-xdp/performance/overview' },
            { text: 'Optimizations', link: '/openshield-xdp/performance/optimizations' },
            { text: 'Tuning', link: '/openshield-xdp/performance/tuning' },
          ]
        },
        {
          text: 'TUI',
          items: [
            { text: 'Overview', link: '/openshield-xdp/tui/overview' },
            { text: 'Screens', link: '/openshield-xdp/tui/screens' },
            { text: 'Shortcuts', link: '/openshield-xdp/tui/shortcuts' },
          ]
        },
        {
          text: 'CLI Reference',
          items: [
            { text: 'Commands', link: '/openshield-xdp/cli/commands' },
            { text: 'openshield load', link: '/openshield-xdp/cli/load' },
            { text: 'openshield fix', link: '/openshield-xdp/cli/fix' },
            { text: 'openshield status', link: '/openshield-xdp/cli/status' },
          ]
        },
        {
          text: 'Developer Guide',
          items: [
            { text: 'Setup & Build', link: '/openshield-xdp/development/guide' },
            { text: 'BPF Verifier Patterns', link: '/openshield-xdp/development/bpf-patterns' },
            { text: 'Adding a Detection Module', link: '/openshield-xdp/development/adding-module' },
            { text: 'Config Struct Alignment', link: '/openshield-xdp/development/config-alignment' },
          ]
        },
        { text: 'FAQ', link: '/openshield-xdp/faq/' },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/AnAverageBeing/OpenShield-XDP' },
      { icon: 'discord', link: 'https://discord.gg/qgBMREWWgp' },
    ],

    footer: {
      message: 'Maintained by <a href="https://github.com/AnAverageBeing">AnAverageBeing</a> — PingLess Studios',
    },

    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/AnAverageBeing/OpenShield-XDP/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
})
