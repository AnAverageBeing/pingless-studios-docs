---
title: Glacier Pack for Pterodactyl
description: A family of 46 standalone addons for Pterodactyl Panel v1.12.x plus the Glacier Pack hub — a single custom admin dashboard that hosts every addon's complete management UI in one Glacier-styled page.
---

# Glacier Pack for Pterodactyl

**A family of 46 standalone addons for Pterodactyl Panel v1.12.x, managed from one hub.** Glacier Pack installs as self-contained packages — no Blueprint, no module daemons on your nodes — and replaces the sprawl of 46 separate admin pages with a single custom dashboard at `/admin/glacier-pack` that hosts every addon's complete management UI in one Glacier-styled page.

<div class="tip custom-block" style="margin-top: 1.5rem;">

**Built for ALTIS TECH SOLUTIONS**
[xdp.network](https://xdp.network) · Standalone packages, installed directly on the panel

</div>

---

## Architecture

```mermaid
flowchart LR
    subgraph Pack["Glacier Addons family (46 addons)"]
        BASIC["Basic pack<br/>18 addons"]
        ADV["Advanced pack<br/>28 addons"]
    end

    subgraph Panel["Pterodactyl Panel v1.12.x"]
        HUB["Glacier Pack hub<br/>/admin/glacier-pack"]
        EP["Addon action endpoints<br/>POST / DELETE routes"]
        CLIENT["Client-facing surfaces<br/>console · files · account · network"]
        BASIC --> HUB
        ADV --> HUB
        HUB -->|"_hub return URL"| EP
        BASIC --> CLIENT
        ADV --> CLIENT
    end

    ADMIN["Root admin"] -->|one sidebar tab| HUB
    USERS["Panel users"] --> CLIENT
```

The hub is the **only admin surface**. Each addon's original admin pages and sidebar links are removed on install; everything an admin could do there — every table, form, action, filter and stat — renders inside a hub pane instead. Forms still post to each addon's own endpoints and land back on the same pane, so nothing about how the addons work changes — only where you manage them.

---

## Key Features

- **One admin dashboard for everything.** A single "Glacier Pack" sidebar tab opens a standalone, full-page admin UI styled after the Glacier theme editor — near-black surfaces, teal accent, its own chrome (not AdminLTE). Root-admin only, guarded twice.
- **46 addons, two packs.** The Basic pack covers panel operations (recycle bin, URL downloads, logs, alerts, uptime, audit trail, schedule/startup presets, PWA shell); the Advanced pack covers hosting workflows (S3 backups, plugin/mod/modpack installers, staff delegation, subdomains, server imports, world and version management, game-specific tooling).
- **Full pages in-hub, not summaries.** Each addon renders its complete original UI as a hub pane — tables, forms, pagination, stat cards — with pill-style sub-tabs for multi-page addons.
- **Uniform save flow.** Every form carries a `_hub` return URL; successful saves land back on the same pane with a success banner, and validation errors render in a hub-styled callout above the form.
- **Standalone packaging, zero framework dependencies.** Every addon is a self-contained directory that mirrors the panel root (`PanelFiles/`) with an idempotent `data/install.sh` installer — no Blueprint, no external CDN assets, no core-file replacement (marker-delimited patches only).
- **Client surfaces without rebuilds.** Addons ship their client UI as static JS/CSS loaded at runtime — no `yarn build` (Recycle Bin additionally offers an optional compiled SPA integration). The panel's React app is enhanced, never forked.
- **Glacier theme compatible.** Client-facing addon styles consume Glacier design tokens (`var(--gl-*, fallback)`), so every addon inherits Glacier's accent, surfaces and radius when the theme is installed — and keeps its own look when it isn't.
- **Safe delegation built in.** Permission Manager gives staff a restricted admin area at `/admin/staff` with real, auto-provisioned Pterodactyl subusers — no `root_admin` grants, enforced by the panel itself.
- **Idempotent installers.** Every `install.sh` is safe to re-run (and should be re-run after panel updates overwrite patched files), registers one service provider, runs migrations, and clears caches.

---

## Quick Install

Install the hub first — it is the only admin surface for the whole family:

```bash
cd glacier-pack && sudo bash data/install.sh
```

Then install any addon the same way:

```bash
cd recycle-bin && sudo bash data/install.sh
```

Open **Admin → Glacier Pack** (or `/admin/glacier-pack`) as a root admin. See [Installation](./getting-started/installation.md) for prerequisites, verification and troubleshooting.

---

## Pack Contents

### Basic pack — 18 addons

| Addon | Purpose |
| --- | --- |
| **Audit Log** | Filterable trail of everything the panel's activity feed records. |
| **Auto Suspend** | Per-server expiry dates with warning emails, suspension and optional auto-delete. |
| **Command History** | Per-server console command history with one-click re-run. |
| **Config Editor** | Edit the panel's `.env` safely from the browser, with backups and validation. |
| **Console Log Share** | One-click console log copying and sharing from the server console. |
| **Login Activity** | Record of every sign-in, with geolocation, VPN flags and session revocation. |
| **Move Files** | Browsable directory picker for the file manager move/copy dialog. |
| **Node Status** | Uptime graphs, incidents, custom monitors and a public status page. |
| **Panel Logs** | Live view of the panel's own log files (plus nginx/Wings sources), no SSH required. |
| **PWA** | Installable app shell with service-worker caching and an offline page. |
| **Quick Files** | Pin files and folders as one-click chips in the file manager. |
| **Recycle Bin** | Recoverable file deletion with quotas and per-egg retention windows. |
| **Resource Alerts** | Threshold notifications the moment a server crosses a usage limit. |
| **Schedule Presets** | Admin-defined schedule templates users apply in one click. |
| **Server Timezone** | Per-server IANA timezone delivered to the container as `TZ`. |
| **Server Wiper** | Scheduled and on-demand file wipes with Rust map-rotation options. |
| **Startup Presets** | Admin-approved startup commands applied from the Startup page. |
| **URL Download** | Fetch remote files straight into a server from the file manager. |

### Advanced pack — 28 addons

| Addon | Purpose |
| --- | --- |
| **Ark Mod Installer** | CurseForge (ASA) and Steam Workshop (ASE) mod management for ARK servers. |
| **Arma Reforger Tools** | Workshop mod manager, config editor and admin-tools integration for Reforger. |
| **Backup Pro** | Scheduled server backups to S3-compatible storage with a full restore flow. |
| **Bedrock Addon Installer** | One-click Bedrock behavior/resource packs, scripts and world templates. |
| **Bedrock Version Changer** | Switch Bedrock servers between Vanilla BDS and PocketMine-MP builds. |
| **Database Manager** | Import and export for panel-managed server MySQL databases. |
| **FastDL Manager** | Per-node FastDL URLs with one-click `sv_downloadurl` config sync. |
| **FiveM Utils** | Cache cleaner, game build, txAdmin, artifact and MySQL helpers for FiveM. |
| **Git Source Control** | Clone, stage, commit, pull and push from the server page. |
| **Hytale Mod Installer** | Browse and install Hytale mods from the CurseForge catalogue. |
| **Hytale World Manager** | Install, activate and remove Hytale worlds from the server page. |
| **Mod Installer** | Browse and install Minecraft mods from Modrinth and CurseForge. |
| **Modpack Installer** | One-click Modrinth and CurseForge modpack installs from the file manager. |
| **Node Stats** | Node analytics: historical tracking, capacity planning, and forecasting. |
| **Permission Manager** | Staff roles with a restricted admin area — no `root_admin` required. |
| **Player List** | Live online-player list with a count badge on the server console. |
| **Player Manager** | Full Minecraft Java player management over plain RCON, nothing on the node. |
| **Plugin Installer** | Browse, install, and manage Minecraft plugins from live catalogues. |
| **Reverse Proxy** | Tracked domain-to-allocation proxy rules with SSL modes and DNS checks. |
| **Server Importer** | Move servers from another Pterodactyl panel via the source's Application API. |
| **Server Properties** | Categorized server.properties editor with MOTD, icon and YAML editors. |
| **Server Splitter** | Split one server's resources into sub-servers on the same node. |
| **Server Type Changer** | Guided nest/egg switches with backup/wipe options and per-server whitelists. |
| **Staff Requests** | Users request server access from each other with owner approval. |
| **Subdomain Manager** | Self-service DNS A, CNAME and SRV subdomains for game servers. |
| **Version Changer** | Change the Minecraft: Java Edition software and version of a server. |
| **Votifier Tester** | Send a real test vote to a Votifier/NuVotifier listener and see the result. |
| **World Manager** | Install CurseForge worlds and switch the server's active world directory. |

---

## Works with the Glacier theme

Every addon's client-facing UI is **Glacier-compatible**: styles reference the theme's design tokens through `var(--gl-*, fallback)` chains, so with the [Glacier theme](../glacier/index.md) installed, addon surfaces inherit its accent color, surfaces, borders and radius automatically — in both dark and light mode. Without Glacier, the fallback values render each addon's own standalone look, pixel-identical to how it shipped. Nothing is required, nothing breaks either way.

::: info
Glacier compatibility applies to **client-facing** surfaces only (server pages, account area, login page). The hub and the admin area are styled by the hub's own stylesheet, independent of any theme.
:::

---

## Next Steps

- **[Installation →](./getting-started/installation.md)** — prerequisites, hub install, per-addon install, verify, uninstall.
- **[Quick Start →](./getting-started/quick-start.md)** — hub plus three starter addons in minutes.
- **[Configuration Reference →](./configuration/reference.md)** — every setting, every default, per addon.
- **[The Hub Dashboard →](./user-guide/dashboard.md)** — a tour of the unified admin UI.
- **[Architecture →](./architecture/overview.md)** — how the packaging format and hub contract work.

---

<div class="footer-note">

**Developed for [ALTIS TECH SOLUTIONS](https://xdp.network)**

Questions or licensing — reach us at [xdp.network](https://xdp.network).

</div>

<style scoped>
.footer-note {
  margin-top: 3rem;
  padding: 1.5rem;
  border-top: 1px solid var(--vp-c-divider);
  text-align: center;
  font-size: 0.875rem;
  color: var(--vp-c-text-2);
}
.footer-note a {
  font-weight: 600;
}
</style>
