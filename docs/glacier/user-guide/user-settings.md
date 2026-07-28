---
title: Per-User Settings — Glacier
description: Glacier features your users control themselves — dark/light, privacy mode, sounds, the editor file tree and Ctrl+K search.
---

# Per-User Settings

Glacier is configured panel-wide by admins, but a handful of comforts belong to each user. These live in the **account menu**, the **account page Panel settings card**, or right where they're used — stored per browser (localStorage), never in the panel database, so one user's choices never leak into another's session.

## Dark / light toggle

When `mode_toggle` is on (default), the account menu carries a dark/light switch. With `mode: auto` the panel follows the OS until the user overrides it manually.

## Privacy mode

One toggle blurs every sensitive identifier panel-wide — server IPs and addresses, the console address chip, account email, API fields — until hovered. Built for streaming and screen-shares; the admin can pre-blur just the server address globally with `blur_server_address`.

## Interface sounds

Subtle UI sounds (toggles, reveals), off by default (`sounds_default: 0`). Each user flips them on from the account menu; the admin default only applies to users who never chose.

## Editor file tree

A VS Code-style explorer on the file editor: directory tree with Glacier's file-type icons, the current file highlighted, a dirty marker for unsaved changes, and a drag-resize sash (width remembered per browser). Users enable it from the account page's **Panel settings** card.

## Ctrl+K search palette

With `shortcuts` on (default), `Ctrl+K` (or the topbar search pill) opens a fuzzy palette across **servers and pages**:

- Arrow keys navigate, `Enter` opens, `Esc` closes.
- Results land on the right server-scoped route (e.g. `/server/<id>/files`, not a bare `/files`).
- No result is pre-highlighted — the list only reacts to actual input.

## Account page cards

The account page gains two Glacier cards:

- **Profile** — view-first identity; email becomes editable only when the admin enables `account_edit_email`.
- **Panel settings** — the per-user toggles above, in one place.

::: info Why localStorage?
Per-user UI prefs in localStorage survive re-logins on the same browser, apply instantly (no save round-trip), and keep the panel's settings store strictly admin-owned. Switching browsers or devices resets them to the admin defaults — by design.
:::
