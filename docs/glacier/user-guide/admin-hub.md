---
title: Admin Hub — Glacier
description: A tour of Glacier's settings hub — tabs, live preview, presets, import/export and factory reset.
---

# The Admin Hub

Everything Glacier does is configured from **Admin → Extensions → Glacier** — no files to edit, no CLI. The hub groups its 120+ settings into tabs and previews every change live before you save.

## Tabs at a glance

| Tab | What lives there |
| --- | --- |
| **Appearance** | Dark/light/auto mode, radius, both color palettes, mode toggle, footer, favicon, theme-color, watermark |
| **Background** | Page background (none / 16 patterns / image), auth-page background, login card alignment |
| **Sidebar** | Dock, rail style, tab effects, hover style, brand block, server block, server switcher |
| **Console** | Stats style, graph mode, zones layout editor, command input, terminal color |
| **Animations** | Master motion, page reveals, file animations, console reveal |
| **Files** | File manager glass, row tint, icon style and colors |
| **Dashboard** | Server card style and layout, fallback cover image, welcome bar |
| **Topbar** | Utility bar, search pill, clock and date formats |
| **Announcements** | Multi-entry markdown announcements + the dismissable banner with CTA |
| **Tabs** | Visual tab manager (see [Tabs](../tabs.md)) |
| **Glass** | Sidebar and container opacity/blur |
| **Advanced** | Shortcuts, import/export, factory reset |

Every key, type and default is in the [Configuration Reference](../../configuration/reference.md).

## Live preview

The hub renders the theme behind the settings as you edit: palette changes, patterns, radius and glass apply to the page you're looking at before you press **Save**. What you see is literally what your users get — there is no "save and pray" step.

## Presets and the seed generator

Two fast paths to a coherent look:

- **Curated presets** — one click fills both dark and light palettes from a designed set.
- **Seed-color generator** — pick one brand color; Glacier derives a balanced full palette (both modes) around it, including readable text and hairline steps.

::: tip Preset first, then tune
Presets overwrite the palette fields only — your sidebar, console and layout choices are untouched. Starting from a preset and nudging `accent` is the intended workflow.
:::

## Import / export / factory reset

On the **Advanced** tab:

- **Export** downloads the entire configuration as one JSON file — every tab, list and toggle.
- **Import** applies such a file back (validated against the same rules as the form, so a corrupt file fails cleanly instead of half-applying).
- **Factory reset** returns every key to its documented default. This is instant and affects all users; export first if in doubt.

## Announcements vs. the banner

Two independent systems live on the Announcements tab:

- **Announcements list** (`announcements`) — multiple rich entries with markdown bodies for the dashboard; good for news, maintenance notices, changelogs.
- **The banner** (`announcement_*`) — one dismissable, tone-colored strip with an optional CTA button; good for a single important callout.

## Validation behavior

Every field validates on save against the rules in the reference (ranges, hex format, URL shape, JSON validity for lists). A failing field is flagged inline and **nothing is written** — saves are all-or-nothing per form, so you can never strand the panel in a half-saved theme.
