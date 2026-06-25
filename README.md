# PingLess Studios Docs

Documentation hub for PingLess Studios open-source projects. Built with VitePress and the [Catppuccin](https://github.com/catppuccin/vitepress) theme.

Maintained by [AnAverageBeing](https://github.com/AnAverageBeing).

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Static site to docs/.vitepress/dist
```

## Adding a Project

1. Create `docs/<project-name>/` with your markdown pages
2. Add sidebar entries in `docs/.vitepress/config.ts`
3. Add nav link under `themeConfig.nav`

The Catppuccin mocha theme (dark) with blue accent is configured in `docs/.vitepress/theme/index.ts`.

## Deploy

Push to `main`. GitHub Actions builds and deploys to Pages.

**Repo Settings → Pages → Source: GitHub Actions**
