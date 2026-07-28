---
title: Configuration Reference — Glacier
description: Every Glacier setting documented — key, type, default, range, what it does and when to change it.
---

# Configuration Reference

Every setting Glacier owns, grouped by the admin hub tab it lives on (**Admin → Extensions → Glacier**). All values are stored panel-wide and apply immediately after save; users may need one refresh.

Conventions:

- **Switch** — a boolean toggle stored as `1` (on) or `0` (off).
- **Hex** — a `#rrggbb` color. The hub provides a color picker everywhere a Hex is expected.
- **Integer ranges** are inclusive; out-of-range values are rejected on save with a field hint.
- Keys are listed by their internal name — the hub labels match one-to-one.

---

## Appearance

Mode, corner radius, both color palettes, and small identity extras.

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `mode` | `dark` · `light` · `auto` | `dark` | Panel-wide color mode. `auto` follows each visitor's OS preference. |
| `radius` | int 8–16 | `14` | Corner radius (px) shared by cards, containers, inputs and buttons. Lower = squarer, higher = softer. |
| `accent` | Hex | `#4ec5b1` | Dark-mode accent: links, active states, focus rings, chips. |
| `bg` | Hex | `#070707` | Dark-mode page background. |
| `surface` | Hex | `#141414` | Dark-mode base surface (lists, tables). |
| `elevated` | Hex | `#1e1e1e` | Dark-mode raised surface (cards, popovers). |
| `ink` | Hex | `#f2f2f2` | Dark-mode primary text. |
| `muted` | Hex | `#9e9e9e` | Dark-mode secondary text and icons. |
| `border` | Hex | `#2e2e2e` | Dark-mode strong borders. |
| `success` | Hex | `#59c886` | Dark-mode success/online states. |
| `warning` | Hex | `#ebbd57` | Dark-mode warning/starting states. |
| `danger` | Hex | `#f75d59` | Dark-mode danger/offline states. |
| `light_accent` | Hex | `#148d7f` | Light-mode accent. Slightly deeper than the dark accent keeps contrast on white. |
| `light_bg` | Hex | `#ffffff` | Light-mode page background. |
| `light_surface` | Hex | `#f7f7f7` | Light-mode base surface. |
| `light_elevated` | Hex | `#ffffff` | Light-mode raised surface. |
| `light_ink` | Hex | `#181818` | Light-mode primary text. |
| `light_muted` | Hex | `#585858` | Light-mode secondary text. |
| `light_border` | Hex | `#dedede` | Light-mode strong borders. |
| `light_success` | Hex | `#1c985a` | Light-mode success. |
| `light_warning` | Hex | `#c28e24` | Light-mode warning. |
| `light_danger` | Hex | `#d73431` | Light-mode danger. |
| `mode_toggle` | Switch | `1` | Lets users switch dark/light themselves from the account menu. Disable to enforce one mode for everyone. |
| `sounds_default` | Switch | `0` | Default state of interface sounds for users who never touched the toggle. Users can override per browser. |
| `account_edit_email` | Switch | `0` | Allow users to edit their own email on the account page. Off = view-only (matches stock behavior). |
| `footer_text` | string ≤120 | *(empty)* | Replaces the stock footer line on client pages. Empty keeps the stock footer. |
| `watermark` | string ≤60 | *(empty)* | Login-page watermark text. Empty hides it. |
| `favicon_url` | URL | *(empty)* | Custom favicon. Must be a full `http(s)` URL. |
| `theme_color` | Hex | *(empty)* | Browser UI theme-color (mobile address bar tint). Empty = derive from the palette. |

::: tip Palettes come in pairs
Every dark token has a `light_*` twin. The hub's **seed-color generator** and curated presets fill both palettes at once — hand-tuning one mode without the other is the most common way to end up with a lopsided UI.
:::

---

## Background

Page background for the dashboard, and a fully independent set for the login/auth pages.

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `bg_type` | `none` · `pattern` · `image` | `pattern` | What paints behind the panel content. |
| `bg_pattern` | 16 patterns | `grid` | Pure-CSS pattern: `grid`, `lines`, `dots`, `cross`, `waves`, `curves`, `mesh`, `diamond`, `noise`, `plus`, `hex`, `circuit`, `topo`, `diagonal`, `weave`, `brick`, `rings`. |
| `bg_pattern_size` | int 16–128 | `32` | Pattern tile size (px). |
| `bg_pattern_opacity` | int 0–40 | `8` | Pattern strength (%). Keep it low — patterns should whisper. |
| `bg_image_url` | URL or path | *(empty)* | Custom background image. Accepts a full URL, a panel-relative path, or the upload field's stored file. |
| `bg_image_opacity` | int 0–100 | `35` | Image strength (%). |
| `bg_image_blur` | int 0–40 | `0` | Image blur (px). |
| `bg_dim` | int 0–80 | `15` | Darkening veil over the background (%) so content stays readable. |
| `login_bg_url` | URL or path | *(empty)* | Image override for auth pages only. Empty = the auth background follows `auth_bg_type`. |
| `login_card` | `center` · `left` | `center` | Login card alignment. `left` pairs well with a strong login image. |
| `auth_bg_type` | `same` · `none` · `pattern` · `image` | `same` | Auth pages get their own background pipeline, or `same` to mirror the main one. |
| `auth_bg_pattern` | 16 patterns | `grid` | Auth pattern (same set as `bg_pattern`). |
| `auth_bg_pattern_size` | int 16–128 | `32` | Auth pattern tile size. |
| `auth_bg_pattern_opacity` | int 0–40 | `8` | Auth pattern strength. |
| `auth_bg_image_url` | URL or path | *(empty)* | Auth image. |
| `auth_bg_image_opacity` | int 0–100 | `35` | Auth image strength. |
| `auth_bg_image_blur` | int 0–40 | `0` | Auth image blur. |

::: warning Hotlinked images break silently
`bg_image_url` pointing at a host that blocks hotlinking (or needs auth) fails only in the browser — the save succeeds. Prefer the **upload** field: uploaded files are served from your own panel and always work.
:::

---

## Sidebar

Navigation structure, dock, tab rows, brand block and the server block.

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `sidebar_style` | `expanded` · `collapsed` | `expanded` | Full labels or icon-only rail. Users get tooltips on the collapsed rail. |
| `sidebar_dock` | `sticking` · `floating` · `floating_v2` | `floating` | Edge-docked rail, floating panel, or the second floating variant with separated blocks. |
| `sidebar_nav_style` | `default` · `pill` | `default` | Row shape for tabs. |
| `sidebar_tab_effect` | `box` · `rounded` · `pill` · `dot` · `solid` | `rounded` | How the *active* tab is highlighted. |
| `sidebar_hover_style` | `soft` · `active` · `minimal` | `soft` | Hover treatment: a quiet tint, a preview of the active effect, or icon-brighten only. |
| `sidebar_tab_jump` | Switch | `1` | Subtle nudge animation when a tab becomes active. |
| `sidebar_separators` | Switch | `1` | Hairlines between sidebar category groups. |
| `sidebar_categories` | Switch | `1` | Show category headers (General, Server, Account…) in the rail. |
| `icon_scale` | int 80–120 | `100` | Sidebar icon size (%). |
| `sidebar_logo_url` | URL or path | *(empty)* | Custom logo image. Empty = default mark. |
| `sidebar_name` | string ≤30 | *(empty)* | Brand text next to the logo. Empty = the panel name. |
| `sidebar_brand` | `both` · `icon` · `text` | `both` | Which brand parts render. |
| `sidebar_avatar` | `gravatar` · `initial` | `gravatar` | User chip avatar: profile image or first-letter disc. |
| `server_bar` | Switch | `1` | Server identity block (name, address, power actions) pinned above the sidebar on server pages. |
| `sidebar_server_actions` | Switch | `0` | Add Start/Restart/Stop power buttons to the server block. |
| `server_actions_colors` | `theme` · `custom` | `custom` | Power button coloring: theme-quiet or explicit green/red. |
| `server_switcher` | Switch | `1` | Quick server switcher in the server block. |
| `blur_server_address` | Switch | `0` | Blur the server address until hovered — stream-safe default; users can still reveal on demand. |

---

## Console

Terminal surface, stats blocks, bandwidth graph and the layout zones editor.

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `console_stats_style` | `original` · `custom` · `hidden` | `custom` | Stock stat blocks, Glacier sparkline cards, or no stats at all. |
| `console_stats_position` | `above` · `below` · `side` | `above` | Legacy placement when the zones editor isn't used. |
| `console_zones` | JSON | *(empty)* | Ordered zones map `{"above":[],"side":["stats"],"below":["graph"]}` from the drag-and-drop layout editor. Empty = defaults. |
| `console_graph_mode` | `minimal` · `advanced` | `minimal` | Bandwidth graph density. |
| `console_input_float` | Switch | `1` | Float the command input as its own pill, or dock it to the terminal. |
| `console_show_address` | Switch | `0` | Show the server address chip in the console header. |
| `console_layout_editor` | `modern` · `legacy` | `modern` | Zones editor UI generation. |
| `console_bg` | Hex | `#131a20` | Terminal canvas color — independent of the page palette. |
| `console_bg_opacity` | int 20–100 | `100` | Terminal card opacity (%). Below 100 the page background shows through. |
| `console_bg_blur` | int 0–40 | `0` | Extra backdrop blur for the terminal card (px). |
| `stats_graphs` | Switch | `1` | Master switch for the live bandwidth graph block. |
| `stats_delta` | `off` · `latest` · `10s` · `1m` · `10m` · `custom` | `off` | Show value deltas on stat cards over the chosen window. |
| `stats_delta_custom` | int 5–600 | `30` | Custom delta window (seconds) when `stats_delta` is `custom`. |
| `stats_graph_window` | int 5–600 | `10` | Graph history window (minutes). |
| `stats_uptime_window` | int 1–168 | `24` | Uptime card averaging window (hours). |

::: tip Zones replace positions
`console_zones` is the source of truth once you drag blocks in the layout editor — the legacy `console_stats_position` / `console_graph_position` only seed the initial map. Editing zones JSON by hand is supported (it must stay valid JSON) but the editor is the safe path.
:::

---

## Animations

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `animations` | Switch | `1` | Master motion switch. Off = instant transitions everywhere; also the `prefers-reduced-motion` fallback is always honored. |
| `page_anim` | Switch | `1` | Page/section reveal transitions. |
| `files_anim_ms` | int 100–600 | `250` | File manager row animation duration (ms). |
| `anim_console_reveal` | `instant` · `slow` | `instant` | Terminal mount animation. `slow` adds a staged reveal on first paint. |

---

## Files

File manager container and iconography.

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `files_container_opacity` | int 20–100 | `100` | File browser card opacity (%). |
| `files_container_blur` | int 0–40 | `0` | File browser backdrop blur (px). |
| `files_row_bg` | Hex | *(empty)* | Row tint override. Empty = theme surface. |
| `files_icon_style` | `custom` · `legacy` | `custom` | Glacier per-type icons or the stock set. |
| `files_icon_folder_color` | Hex | `#e8934a` | Folder icon color (custom set). |
| `files_icon_archive_color` | Hex | `#a78bfa` | Archive icon color (custom set). |
| `files_icon_edit_color` | Hex | `#4ec5b1` | Editable-file icon color (custom set). |

---

## Dashboard

Server cards and the welcome bar on the server list.

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `server_card_style` | `default` · `banner` · `fade` | `banner` | Card art: stock row, banner strip image, or full-bleed cover with a bottom fade and a state edge bar. |
| `server_card_layout` | `rows` · `grid` | `rows` | One elongated card per row, or the shrink grid. |
| `server_card_image` | URL or path | *(empty)* | Global fallback cover image for cards without a matching rule. |
| `welcome_bar` | Switch | `1` | Greeting bar (user + Settings CTA) for non-admin users above the server list. |

---

## Topbar

Optional top utility bar (complements, never duplicates, the sidebar).

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `topbar_enabled` | Switch | `1` | Render the topbar. |
| `topbar_sticky` | Switch | `1` | Keep it pinned on scroll. |
| `topbar_style` | `modern` · `clean` | `modern` | Visual density. |
| `topbar_search` | Switch | `1` | Search pill in the bar; opens the same Ctrl+K palette. |
| `topbar_clock` | Switch | `0` | Live clock in the bar. |
| `clock_time_format` | `12` · `24` | `24` | Hour cycle. |
| `clock_timezone` | `local` · `utc` | `local` | Clock timezone. |
| `clock_tz_label` | Switch | `1` | Show the GMT offset label next to the time. |
| `clock_date_format` | 6 formats + `off` | `off` | Optional date next to the time (`dd/mm/yyyy`, `mm/dd/yyyy`, short variants). |

---

## Home (structured lists)

Two JSON-backed lists edited with dedicated UI in the hub, not raw text.

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `social_links` | JSON list | `[]` | Footer/social icon links (icon + URL entries) rendered on the dashboard. |
| `server_card_rules` | JSON list | `[]` | Per-server card image rules — match servers (by name/egg) to cover images, falling back to `server_card_image`. |

::: warning Edit these in the hub
Both are validated as JSON on save. Hand-editing the stored value with broken JSON is rejected — use the hub's list editors, which always emit valid payloads.
:::

---

## Announcements

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `announcements` | JSON list | `[]` | Rich multi-entry announcements (markdown body, scheduling) shown on the dashboard. |
| `announcement_enabled` | Switch | `0` | The single dismissable banner. |
| `announcement_type` | `info` · `success` · `warning` · `danger` | `info` | Banner tone. |
| `announcement_text` | string ≤500 | *(empty)* | Banner body. |
| `announcement_dismissable` | Switch | `1` | Users can close the banner (remembered per browser). |
| `announce_cta_label` | string ≤30 | *(empty)* | Call-to-action button label. |
| `announce_cta_url` | URL or path | *(empty)* | Call-to-action target. Both CTA fields together render the button. |

---

## Tabs

Managed in the hub's visual tab manager — see the [Tabs guide](../../user-guide/tabs.md).

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `tabs` | JSON list | *(stock set)* | Sidebar tabs for general/account pages: order, label, icon, visibility, redirect targets. |
| `server_tabs` | JSON list | *(stock set)* | The same, for server pages — an independent list. |

---

## Glass

Frosted-glass tuning for the two container families. Opacity below 100 % lets the page background bleed through; blur frosts it.

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `sidebar_opacity` | int 20–100 | `75` | Sidebar background opacity (%). |
| `sidebar_blur` | int 0–40 | `18` | Sidebar backdrop blur (px). |
| `container_opacity` | int 20–100 | `55` | Content containers opacity (%). |
| `container_blur` | int 0–40 | `14` | Content containers backdrop blur (px). |

::: tip Glass needs a background to show
Opacity/blur are invisible over the flat `bg` color — they only read as glass when `bg_type` is `pattern` or `image`. Strong blur with `bg_type: none` just dims things.
:::

---

## Advanced

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `shortcuts` | Switch | `1` | Keyboard shortcuts (Ctrl+K search palette). |

The Advanced tab also carries the **import/export as JSON** and **factory reset** actions — these act on the whole configuration, they are not settings themselves. See the [Admin Hub guide](../../user-guide/admin-hub.md#import--export--factory-reset).
