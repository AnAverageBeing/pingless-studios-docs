---
title: Using the Theme — Apple
description: Daily use of the Apple admin theme — light/dark toggle, sidebar rail and filter, mobile drawer, bento dashboard and the boot loader.
---

# Using the Theme

Everything an admin touches day to day. None of it requires the settings hub — these controls live directly in the interface.

## Light / dark toggle

The sun/moon button in the top bar flips between Catppuccin Latte (light) and Mocha (dark) instantly — no page reload. The choice persists in your browser (`localStorage: apple-mode`) and beats the panel-wide default set in the hub.

::: info Per browser, not per account
The toggle state lives in `localStorage`, so it follows the browser, not your admin account. There is deliberately no server round-trip for a visual preference.
:::

## The sidebar

### Navigation

Sections and links are exactly the ones the panel itself defines — core pages under their usual headers, plus every link any extension registers. The active page is marked by a tinted row where **only the icon carries the accent color**; labels always stay neutral for readability.

### Filter

The field at the top filters links by label as you type. Sections with no matching links collapse away; a "No matching entries" row appears when nothing hits. Clear the field to restore the full menu.

### Icon rail

The toggle in the sidebar footer collapses the sidebar to a 76px icon-only rail (labels, sections and the filter hide; everything stays one click away). Your choice persists (`localStorage: apple-rail`). The panel-wide default is settable in the hub.

### Mobile drawer

At ≤ 992px the sidebar becomes an off-canvas drawer: the hamburger in the top bar opens it over a blurred backdrop, and tapping the backdrop, pressing `Esc`, or picking a link closes it. The rail setting is ignored on mobile — the drawer always shows labels.

## The top bar

A floating glass bar with the current page title, the mode toggle, and your account actions (account, extensions, exit to the client panel, logout) moved from the stock header. The logout keeps the panel's own confirmation dialog — Apple moves the original buttons, it does not re-implement them.

## Bento dashboard

The admin home page renders a bento grid:

| Tile | Contents |
| --- | --- |
| Hero | Time-of-day greeting, panel-wide counts, and a live version status pill (up to date / update available with a release link) |
| Activity | New accounts over the last 14 days with an inline SVG sparkline — no chart library, no CDN |
| Stats | Servers, users, nodes and locations as link tiles with per-tile hues |
| Quick actions | New server, new user, new node, panel settings, Application API, Extensions |
| System | Panel version, PHP version, render time, and quiet links (docs, GitHub, Discord, donate) |

Turn it off in the hub (**Bento dashboard** switch) and the stock dashboard renders instead — the fallback ships inside the same file, nothing to reinstall.

## Boot loader

Every admin page opens with a short branded splash — your panel name under the Apple glyph with an accent progress ring — while the theme builds its chrome. It fades the moment the interface is ready and never blocks longer than ~3 seconds even if scripts fail (a CSS-only failsafe hides it). With reduced motion enabled, the ring is static and the fade is instant.

## Keyboard and motion

- `Esc` closes the mobile drawer.
- Every interactive element has a visible focus ring (2px accent at 45%).
- All transitions run 150–250ms and respect `prefers-reduced-motion` everywhere, always — the hub's **Animations** switch can only turn motion off, never override a user's OS preference.
