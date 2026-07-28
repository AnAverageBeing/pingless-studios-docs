---
title: Tab Manager — Glacier
description: Reorder, relabel, re-icon, hide and redirect sidebar tabs in Glacier — separate lists for general and server pages.
---

# Tab Manager

Glacier's sidebar is fully data-driven. The **Tabs** tab in the admin hub edits two independent JSON lists — `tabs` (general and account pages) and `server_tabs` (server pages) — through a visual editor. No code, no restarts.

## What you can do to any tab

- **Reorder** — drag tabs into any sequence; category headers follow.
- **Relabel** — rename without touching routes ("Databases" → "DB").
- **Re-icon** — swap any tab's icon from Glacier's bundled 80+ icon set (all inline SVG, no external assets).
- **Hide** — remove a tab from the rail without disabling the underlying page (direct URLs still work).
- **Redirect tabs** — add brand-new tabs that link anywhere: an external status page, billing portal, or docs site.

## Two lists, two contexts

`tabs` governs what users see on the dashboard, account and general pages. `server_tabs` governs the rail **inside** a server (Console, Files, Databases, Schedules, Users, Backups, Network, Startup, Settings, Activity…). They ship with the stock sets as defaults and diverge only where you edit them.

::: info Addon tabs are automatic
Tabs registered by other Blueprint addons (Billing, and friends) are not in either list — Glacier imports them automatically into a collapsible **More** group at the end of the rail, so extensions never become unreachable no matter how you edit the lists.
:::

## Interaction polish

- **Active effects** — `box`, `rounded`, `pill`, `dot` or `solid` (`sidebar_tab_effect`), all following the corner-radius setting.
- **Hover styles** — `soft` tint, `active` (hover previews the exact active effect), or `minimal` icon-brighten (`sidebar_hover_style`).
- **Jump** — a subtle settle animation when the active tab changes (`sidebar_tab_jump`).
- **Categories** — optional General / Server / Account headers with separators (`sidebar_categories`, `sidebar_separators`).

## Common recipes

| Goal | How |
| --- | --- |
| Cleaner rail for users | Hide admin-only tabs from `tabs`; they stay reachable by URL for staff |
| Status page in the nav | Add a redirect tab → your status URL, external-link icon |
| Match brand wording | Relabel stock tabs ("Servers" → "My Servers") |
| Compact server view | Hide rarely used server tabs from `server_tabs` |

::: warning Hiding ≠ permission
A hidden tab only removes the link. Pterodactyl's own permissions still decide who can open the page — use subuser permissions for real access control.
:::
