---
title: Quick Start — Glacier Pack
description: Get the Glacier Pack hub plus three starter addons — Recycle Bin, URL Download and Site Alerts — running on your panel, and make your first save through the hub.
outline: deep
---

# Quick Start

The fastest useful Glacier Pack setup: the **hub** plus three starter addons — **Recycle Bin** (recoverable deletes), **URL Download** (fetch files straight into a server), and **Site Alerts** (announcement banners). Everything is managed from one page afterwards.

---

## 1. Install the hub

```bash
cd glacier-pack
sudo bash data/install.sh
```

This registers the hub provider, adds the **Glacier Pack** sidebar tab, and clears caches. Open **Admin → Glacier Pack** — the rail lists all 24 addons; the three you are about to install will light up as they land.

---

## 2. Install the starter addons

```bash
cd ../recycle-bin   && sudo bash data/install.sh
cd ../url-download  && sudo bash data/install.sh
cd ../site-alerts   && sudo bash data/install.sh
```

::: warning
Recycle Bin patches the panel's React frontend — run a rebuild after installing it:

```bash
cd /var/www/pterodactyl
yarn build:production
```

URL Download and Site Alerts need no build step.
:::

---

## 3. Your first save through the hub

Open **Admin → Glacier Pack** and click **Recycle Bin** in the rail (or go straight to `/admin/glacier-pack?a=recycle-bin`).

1. Set **Default retention window (hours)** to how long trashed files should stay recoverable — the default is `24`.
2. Set **Default per-server capacity** — `0` means unlimited; trashed files count against the server's real disk quota, so a limit is worth setting on shared nodes.
3. Press **Save settings**.

You land back on the same pane with the green **Settings saved.** banner — that round-trip is how every addon in the family saves.

---

## 4. Try the other two

**URL Download** (`?a=url-download`) — set **Max file size** (default `10 GB`) and **Max URLs per batch** (default `3`), then save. Users get a **Download from URL** button in the server file manager immediately.

**Site Alerts** (`?a=site-alerts`) — click the create form, pick a type (`info`, `success`, `warning`, `danger`), write a message (`**bold**`, `*italic*` and `[links](https://url)` supported), and save. The banner appears on every client page within seconds — users can dismiss it, and editing the alert re-shows it.

---

## 5. See it as a user

- **Recycle Bin:** open any server's file manager, delete a file, then use the **Recycle Bin** toolbar button to restore it.
- **URL Download:** in the same file manager, click **Download from URL**, paste a link, pick a folder, watch it land — no SFTP round-trip.
- **Site Alerts:** open the dashboard as any user; your banner sits above the app content.

---

## Where to go next

- **[All 24 addons →](../user-guide/addons.md)** — what each one does and where it lives.
- **[Configuration Reference →](../configuration/reference.md)** — every setting on every pane.
- **[Installation →](./installation.md)** — full prerequisites, verification and troubleshooting.
