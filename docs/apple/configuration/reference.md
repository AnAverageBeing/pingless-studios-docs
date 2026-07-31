---
title: Configuration Reference — Apple
description: Every Apple theme setting documented — keys, types, defaults, ranges, what they change and common mistakes, plus the conf.yml manifest and CSS token reference.
---

# Configuration Reference

Every value Apple reads, its default, and when to change it. Settings are stored as `apple::<key>` rows in the panel `settings` table and edited from **Admin → Apple Theme** (Blueprint). There is no YAML config file.

## Theme settings

### `mode_default`

| | |
| --- | --- |
| Type | `system` · `dark` · `light` |
| Default | `system` |
| Stored as | `apple::mode_default` |

The mode used until someone picks one with the top-bar toggle. `system` follows the visitor's OS preference (`prefers-color-scheme`, defaulting to dark when unknown). A user's manual choice is stored in their browser (`localStorage: apple-mode`) and always wins over this default.

**Change it when:** your brand is dark-first and you want first-time visitors to land in dark regardless of their OS.

**Common mistake:** assuming this forces the mode. It is only the default — the per-browser toggle always overrides it.

---

### `accent`

| | |
| --- | --- |
| Type | one of 12 Catppuccin accents |
| Default | `sapphire` |
| Stored as | `apple::accent` |

The single accent color used for selection, primary actions, focus rings and the active sidebar icon. One value covers both modes — each accent has an official Mocha (dark) and Latte (light) hex:

| Accent | Dark (Mocha) | Light (Latte) |
| --- | --- | --- |
| `blue` | `#89b4fa` | `#1e66f5` |
| `sapphire` | `#74c7ec` | `#209fb5` |
| `sky` | `#89dceb` | `#04a5e5` |
| `teal` | `#94e2d5` | `#179299` |
| `green` | `#a6e3a1` | `#40a02b` |
| `yellow` | `#f9e2af` | `#df8e1d` |
| `peach` | `#fab387` | `#fe640b` |
| `red` | `#f38ba8` | `#d20f39` |
| `pink` | `#f5c2e7` | `#ea76cb` |
| `mauve` | `#cba6f7` | `#8839ef` |
| `lavender` | `#b4befe` | `#7287fd` |
| `flamingo` | `#f2cdcd` | `#dd7878` |

In dark mode filled primary buttons use the accent with near-black text; in light mode the accent is deepened (`65% accent + black`) so white text keeps ≥ 4.5:1 contrast. You never need to handle this — it is computed.

**Change it when:** matching a brand color. Sapphire and sky read most "iOS"; mauve/lavender are the loudest options.

**Common mistake:** none really — invalid values fall back to `sapphire` server-side.

---

### `glass_blur`

| | |
| --- | --- |
| Type | integer `0–30` (px) |
| Default | `18` |
| Stored as | `apple::glass_blur` |

Backdrop blur behind the sidebar, top bar and cards. Lower values read more matte and cost less GPU on weak machines; `0` disables frosted glass entirely (surfaces become translucent tints).

**Change it when:** you want a flatter, more matte look (try `8–12`), or a stronger frost (try `24–30`).

**Common mistake:** cranking blur up *and* opacity down together — text over busy backgrounds can drop below readable contrast. Raise opacity instead.

---

### `glass_opacity`

| | |
| --- | --- |
| Type | integer `50–95` (%) |
| Default | `72` |
| Stored as | `apple::glass_opacity` |

How solid frosted surfaces are. This modifies surface **alpha only, never hue** — the theme's "matte" character comes from high opacity + moderate blur. Higher is more solid; lower is more see-through.

**Change it when:** lowering blur (raise opacity to compensate) or when the page background shows through too much.

---

### `radius`

| | |
| --- | --- |
| Type | integer `10–22` (px) |
| Default | `16` |
| Stored as | `apple::radius` |

Corner radius for cards and containers. Buttons, inputs and nav rows automatically stay a step squarer (`radius − 6px`), modals a step rounder (`+ 2px`) — one value drives the whole shape scale.

**Change it when:** you want a squarer, more utilitarian feel (`10–12`) or maximum iOS softness (`20–22`).

---

### `sidebar_rail`

| | |
| --- | --- |
| Type | switch `0` / `1` |
| Default | `0` (expanded) |
| Stored as | `apple::sidebar_rail` |

Whether the sidebar starts collapsed to a 76px icon rail. Anyone can expand it with the sidebar footer toggle; their choice persists in their browser (`localStorage: apple-rail`) and wins over this default. On mobile (≤ 992px) the rail is ignored — the drawer always shows labels.

---

### `animations`

| | |
| --- | --- |
| Type | switch `0` / `1` |
| Default | `1` (on) |
| Stored as | `apple::animations` |

Interface transitions (150–250ms, ease-out). Off makes everything effectively instant. `prefers-reduced-motion: reduce` is **always** respected regardless of this setting — you cannot force motion on users who opted out.

---

### `dashboard_custom`

| | |
| --- | --- |
| Type | switch `0` / `1` |
| Default | `1` (bento) |
| Stored as | `apple::dashboard_custom` |

Whether the admin home page renders Apple's bento grid. Off renders the stock Pterodactyl dashboard markup, which ships inside the same patched view as a runtime fallback — no reinstall needed to flip this.

::: info Serialization note
Blueprint's settings library serializes values (`s:1:"1";`). Apple's runtime unwraps this everywhere it reads the table directly (dashboard view, standalone wrapper), so toggles behave correctly in both variants.
:::

---

### `init` (system)

Version marker written on every hub load. Never accepted from input; safe to ignore.

---

## `conf.yml` manifest (Blueprint)

| YAML path | Value | Purpose |
| --- | --- | --- |
| `info.name` | `Apple` | Display name |
| `info.identifier` | `apple` | Unique ID (lowercase, no hyphens) |
| `info.version` | `1.0.0` | SemVer |
| `info.target` | `beta-2026-05` | Blueprint build target |
| `info.author` | `Pingless.org (AnAverageBeing)` | Author |
| `info.icon` | `icon.svg` | Extension list icon |
| `admin.view` | `admin/view.blade.php` | Settings hub partial |
| `admin.controller` | `admin/controller.php` | Settings hub controller |
| `admin.wrapper` | `admin/wrapper.blade.php` | Rendered on **every** admin page — the theme's only entry point |
| `dashboard.wrapper` | `""` | Unused (admin-only theme) |
| `data.directory` | `private` | Install/remove hooks |
| `data.public` | `public` | Assets → `public/extensions/apple` |
| `requests.views` | `src/views` | Blade partials (`variables`, `dashboard`) |

---

## CSS custom properties (for extension authors)

All values land in `--ap-*` variables on `<html>`; the active mode is `html[data-apple="dark"|"light"]`. If you build admin UI for an extension, consuming these keeps you visually native:

| Token group | Variables |
| --- | --- |
| Surfaces | `--ap-base` `--ap-mantle` `--ap-crust` `--ap-surface0/1/2` |
| Text | `--ap-text` `--ap-subtext0` `--ap-subtext1` `--ap-overlay0/1` |
| Accent | `--ap-accent` `--ap-accent-strong` `--ap-on-accent` `--ap-active` `--ap-ring` |
| Semantic | `--ap-green` `--ap-yellow` `--ap-red` `--ap-info` |
| Structure | `--ap-card` `--ap-fill` `--ap-hairline` `--ap-hover` `--ap-radius` `--ap-radius-sm` `--ap-radius-lg` |
| Behavior | `--ap-glass-blur` `--ap-glass-opacity` `--ap-ease` `--ap-dur` `--ap-z-*` |
| Type | `--ap-font` `--ap-mono` |

::: warning Do not hardcode palette hexes in your extension
Values like `#1e1e2e` or `#74c7ec` change with the admin's accent choice and the light/dark toggle. Always consume the variables — `var(--ap-accent)`, `var(--ap-text)` — so your UI follows the theme.
:::
