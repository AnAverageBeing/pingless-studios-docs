---
title: Architecture Overview — Glacier
description: How Glacier themes Pterodactyl without touching a core file — Blueprint wrappers, server-rendered design tokens, and the data-attribute contract with the stock React app.
---

# Architecture Overview

Glacier's defining constraint: **zero core-file replacement**. Everything below exists to make a deep, structural theme possible inside that constraint — and to keep it working across panel updates.

## The big picture

```mermaid
flowchart TD
    subgraph Server["Server (panel)"]
        CTRL["controller.php<br/>SCHEMA: 120 keys · rules · defaults"]
        VIEW["view.blade.php<br/>admin hub (settings UI)"]
        DB[("settings table<br/>glacier::* rows")]
        WRAPD["client/wrapper.blade.php"]
        WRAPA["admin/wrapper.blade.php"]
        VARS["src/views/variables.blade.php"]
        CFG["src/views/script.blade.php"]
        CTRL --> DB
        VIEW --> CTRL
        DB --> WRAPD
        DB --> WRAPA
    end

    subgraph Page["Every page render"]
        TOKENS["1 · <style> design tokens<br/>(:root dark + light block)"]
        ATTRS["2 · inline data-* attributes<br/>(anti-FOUC boot flags)"]
        CONF["3 · GLACIER_CONFIG<br/>(runtime settings JSON)"]
        LIBS["4 · 9 CSS + 8 JS libraries<br/>(cache-busted ?timestamp)"]
        VARS --> TOKENS
        VARS --> ATTRS
        CFG --> CONF
        CFG --> LIBS
    end

    subgraph Client["Browser"]
        STOCK["Stock React app<br/>(untouched)"]
        ENH["Glacier enhancers<br/>MutationObserver, idempotent"]
        LIBS --> ENH
        CONF --> ENH
        ENH -.->|"tags data-* on stock nodes,<br/>re-asserts own elements"| STOCK
    end
```

## Stage 1 — server-rendered tokens (no FOUC)

The theme cannot wait for JavaScript: a dark panel flashing white on every navigation is unacceptable. So `variables.blade.php` renders, inside every page's initial HTML:

1. A `<style>` block with the full design-token set as CSS custom properties — dark values in `:root`, the light palette under `html[data-glacier="light"]`. Backgrounds, patterns and glass derive from the same tokens.
2. An inline script setting boot-critical `data-*` attributes on `<html>` (icon style, reveal mode, hover style, card style…) before first paint.

First paint is therefore already themed — CSS and JS only refine it.

## Stage 2 — the libraries

Static assets ship in the package (`public/`), served from the panel and cache-busted with a per-save timestamp.

| Layer | Files | Role |
| --- | --- | --- |
| CSS | `core`, `patterns`, `sidebar`, `console`, `panel`, `home`, `auth`, `mobile`, `editor` | Token-driven restyle of every surface; mobile is a dedicated layer, not an afterthought |
| JS | `icons`, `locationchange`, `sounds`, `sidebar`, `console-stats`, `home`, `activity`, `editor` | Enhancement runtimes (below) |

No external fonts, CDNs or requests: Glacier contacts nothing outside the panel.

## The React contract

Pterodactyl's client is a React SPA that reconciles DOM aggressively. Glacier's JS survives it with three rules, enforced everywhere:

1. **Never move React's nodes.** Stock elements are tagged with `data-*` attributes (React leaves unknown attributes alone) — classes and inline styles on React nodes get stripped on re-render, so Glacier never relies on them there.
2. **Own elements are siblings, re-asserted.** Console header, filter toolbars, stat cards and docks are Glacier-owned nodes inserted next to React's. React drops foreign children on remount, so a `MutationObserver` re-asserts them every pass — idempotently, so duplicate passes cost nothing.
3. **All enhancement is idempotent and silent.** Every pass is safe to re-run at any time; every DOM access is null-checked; failure never throws into the console.

`locationchange.js` wraps history navigation so SPA route changes trigger the same enhancement passes as full loads.

## Settings flow

```mermaid
sequenceDiagram
    participant A as Admin
    participant H as view.blade.php (hub)
    participant C as controller.php
    participant S as settings (glacier::*)
    participant W as wrappers + variables
    participant B as Browser

    A->>H: edit + save
    H->>C: POST (one form)
    C->>C: validate against SCHEMA rules<br/>(all-or-nothing)
    C->>S: dbSet each key
    Note over S: cache-bust timestamp bumps
    B->>W: next page load
    W->>B: tokens + attrs + GLACIER_CONFIG
    Note over B: already themed at first paint
```

Defaults seed on first load, so a fresh install is coherent before any save. Validation mirrors the hub's client-side hints; a rejected save writes nothing.

## File layout

```
glacier/
├── conf.yml                  # Blueprint manifest
├── controller.php            # SCHEMA, validation, save handlers, uploads
├── view.blade.php            # admin hub (tabs, fields, live preview)
├── admin/wrapper.blade.php   # admin-side boot
├── client/wrapper.blade.php  # client-side boot (defaults → vars → libs)
├── src/views/                # variables/script blades (tokens, GLACIER_CONFIG)
├── data/                     # uploaded assets (backgrounds, logos)
└── public/
    ├── libraries/            # 9 CSS + 8 JS runtime files
    ├── editor/               # hub editor assets
    └── presets/              # curated palette presets
```

## Design principles worth knowing

- **Tokens over literals.** Stock utility colors are remapped to Glacier tokens globally (`bg-gray-700` → `--gl-elevated`), so even un-themed stock corners and other extensions inherit the palette.
- **One radius, one motion language.** `radius` and the animation switches are honored by every component Glacier ships or restyles.
- **Reduced motion is a first-class path.** Every animation has an instant alternative under `prefers-reduced-motion`, independent of the admin switches.
- **Accessibility floors.** Body text ≥ 4.5:1 contrast on both palettes; focus rings on all interactive Glacier elements.
