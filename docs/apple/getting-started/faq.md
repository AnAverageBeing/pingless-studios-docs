---
title: FAQ — Apple
description: Frequently asked questions about the Apple admin theme for Pterodactyl — compatibility, updates, performance, mobile and the dashboard patch.
---

# FAQ

## Does Apple replace any Pterodactyl core files?

No — with one deliberate, reversible exception. The theme itself (sidebar, top bar, components, both modes) works entirely through Blueprint's admin wrapper hook. The **bento dashboard** swaps `resources/views/admin/index.blade.php`, but the original is backed up next to it first, the patch is marker-verified and idempotent, the stock markup ships inside the patched file as a runtime fallback, and uninstall restores the original. It can also be switched off from the settings hub without uninstalling.

## Will my other extensions still show up?

Yes — that is the core design. The sidebar is harvested from the panel's own menu at runtime, so any extension that registers an admin link (Blade marker block, Blueprint sidenav yield, JS injection) appears automatically. Their pages inherit the global component reskin too. See [Extension Compatibility](../user-guide/compatibility.md).

## Does it conflict with the Glacier theme?

No. Glacier themes the **client** panel (server console, files, dashboard); Apple themes the **admin** area. They are installed side by side and never touch each other's surfaces.

## What happens when Pterodactyl updates?

Panel updates keep working: no core file is permanently modified. If an update overwrites `resources/views/admin/index.blade.php`, re-run the dashboard patch by reinstalling (`blueprint -i apple-v1.0.0` again — it is idempotent) or flip **Bento dashboard** off in the hub.

## What happens when Blueprint itself is removed?

Without Blueprint there is no wrapper hook, so the theme simply stops rendering and the admin area returns to stock (the dashboard patch remains but is inert markup without Apple's CSS — remove it with the packaged `remove.sh` logic or by restoring the backup). If you plan to drop Blueprint permanently, uninstall Apple first.

## Is there a performance cost?

Negligible. One settings read per admin page (Blueprint-cached), five small stylesheets and one script from your own panel, no external requests, no chart library (the sparkline is inline SVG computed server-side). Backdrop blur is GPU-composited and tunable — lower **Glass blur** to `0–8` on weak hardware.

## Does it work on phones?

Yes. At ≤ 992px the sidebar becomes an off-canvas drawer with a blurred backdrop, the top bar spans full width, tables scroll horizontally instead of breaking layout, and the bento grid collapses to one column (stats stay two-up). Touch targets stay ≥ 34px.

## How do per-user mode choices interact with the panel default?

The hub's **Default mode** applies until a person flips the top-bar toggle; their choice is stored in that browser and wins thereafter. There is no way (by design) to force a mode on someone who has chosen one — clear the browser's `localStorage` (`apple-mode`) to fall back to the default.

## Can I use it without Blueprint?

Yes — the standalone variant injects one marker-delimited include into the admin layout and otherwise behaves identically, minus the settings hub (defaults apply; values can be adjusted in the `settings` table). See [Installation](../getting-started/installation.md#install-standalone).
