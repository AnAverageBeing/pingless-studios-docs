---
title: Using Server Access
description: The Server Access account page — requesting access, handling incoming requests, blocking users, and managing active grants.
---

# Using Server Access

Everything a user needs lives at **Account → Server Access** in the Pterodactyl client area. The page has three tabs — **Received**, **Sent**, and **Active** — plus request, preferences, and blocking panels on the left.

---

## Requesting access

Open **Request Access**, pick a request type, and send:

| Type | Identifier | What the owner approves |
|---|---|---|
| A single server | Server ID — short ID (`1a2b3c4d`) or full UUID | Access to that one server |
| All servers of a user | The owner's account email | Access to **every** server they own |

Pick an **access level** (`Read-only`, `Standard`, `Full access`) and optionally add a short message (max 500 characters, HTML stripped). You can expand *"Show what each access level includes"* under **My Preferences** to see the exact permission list behind each level before asking.

::: info Email requests are private by design
When you request by email, the response is identical whether or not that email has an account — so the feature can't be used to probe who's registered. If the account exists and accepts requests, your request lands in their **Received** tab; otherwise nothing happens.
:::

While a request is pending you can **Cancel** it from the **Sent** tab. Handled requests (approved/denied/expired) can be removed from the list with **Remove**.

---

## Handling incoming requests

The **Received** tab shows everyone asking for access to your servers. For each pending request you can:

1. **Adjust the access level** — override the preset the requester asked for.
2. **Choose a duration** — *Permanent*, or temporary from 1 hour up to 30 days.
3. **Approve** or **Deny**.

Approving creates real Pterodactyl subusers — the requester sees the server(s) in their dashboard immediately. Temporary grants expire automatically: the subuser is removed and any live SFTP session is revoked within a minute of the deadline.

Approved requests show a **Revoke access** button for as long as the grant is live. Revoking deletes exactly the subusers that approval created — nothing else.

::: tip Requests expire on their own
Pending requests decay after the admin-configured TTL (24 hours by default). You don't need to deny old requests — the scheduler marks them expired automatically.
:::

---

## The Active tab

**Active** is your fleet-wide access manager. It lists **every subuser on every server you own or manage**, grouped by user. For each person you can:

- **Edit permissions** — click the ⚙ icon, toggle individual permissions grouped by category, and save. The full permission catalogue is shown with descriptions.
- **Change duration** — switch a grant between permanent and temporary, or extend/shorten temporary access.
- **Add another server** — use the *+ add server…* dropdown on their row to grant them access to more of your servers with the current preset.
- **Remove access** — the ✕ on a server chip revokes just that server; *Remove access* in the editor does the same.

Rows tagged **mgr** hold the `accessmanager.manage` permission — those users can manage access on that server themselves from their own Server Access page. Rows tagged **temp** have a live expiry countdown.

---

## My Preferences

| Setting | Effect |
|---|---|
| Accept incoming requests | When **off**, nobody can send you new requests (existing ones are unaffected). |
| Default access level offered | The preset pre-selected in your request form. |

---

## Blocking users

The **Blocked Users** panel stops specific accounts from ever requesting access to you:

- Add a block with the user's **account email**.
- Blocking immediately **auto-denies** any pending requests from that user to you.
- Blocked users get no error when they try — their requests are silently discarded, so they can't tell they've been blocked.
- **Unblock** removes the block instantly.

Blocks are rate-limited server-side (10 per minute by default) to prevent abuse.
