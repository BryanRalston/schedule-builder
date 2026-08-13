# Schedule Pro — SSO setup (Google + Microsoft)

Schedule Pro ships with **honest preview** Google/Microsoft buttons when OAuth client IDs are empty. Sessions stay on-device (localStorage). Filling `monetization.json` turns those buttons into real browser popups.

**Version:** web **2.5.0**+  
**Live origin (GitHub Pages):** `https://bryanralston.github.io`  
**App path (if project pages):** `https://bryanralston.github.io/schedule-builder/`  
**Local:** `http://localhost` (any port your static server uses)

> **Security note (Phase 1):** ID tokens / access tokens are used only in the browser to read `email`, `name`, `picture`, and verification flags. Payload decode and userinfo fetches are **client-side only**. Server-side token verification, token binding, and backend session APIs are **Phase 2**.

---

## 1. Config fields (`monetization.json`)

| Field | Default | Purpose |
|--------|---------|---------|
| `googleClientId` | `""` | Google OAuth **Web** client ID. Empty = preview modal (no fake OAuth). |
| `microsoftClientId` | `""` | Azure AD app (client) ID. Empty = preview modal. |
| `microsoftTenantId` | `"common"` | Tenant: `common`, `organizations`, `consumers`, or a directory GUID. |
| `allowedEmailDomains` | `[]` | If non-empty, only these email domains may sign in (all methods **except** offline). Case-insensitive; no leading `@` required. |
| `sessionMaxDays` | `90` | Device session TTL from sign-in. |
| `ssoRequireOrgName` | `true` | After successful OAuth, collect organization name if missing. |

Redeploy or refresh after editing. The app loads this file with `cache: 'no-store'`.

---

## 2. Google Cloud — OAuth Web client

1. Open [Google Cloud Console](https://console.cloud.google.com/) → select or create a project.
2. **APIs & Services → OAuth consent screen**
   - User type: **External** (or Internal for Workspace-only).
   - App name: e.g. `Schedule Pro`
   - Support email: your address
   - Scopes later used by the app: `openid`, `email`, `profile` (and userinfo via access token)
   - Add test users while the app is in **Testing**
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: e.g. `Schedule Pro Web`
   - **Authorized JavaScript origins** (exact origins, no path):
     - `https://bryanralston.github.io`
     - `http://localhost` (and `http://127.0.0.1` if you use it)
     - Add the origin with port if needed, e.g. `http://localhost:5500`
   - **Authorized redirect URIs** (GIS token client often works with origins alone; still add common redirects if Google requires them):
     - `https://bryanralston.github.io`
     - `https://bryanralston.github.io/schedule-builder/`
     - `http://localhost`
     - Matching local URLs you actually open
4. Copy the **Client ID** (ends with `.apps.googleusercontent.com`).
5. Paste into `monetization.json`:

```json
"googleClientId": "YOUR_ID.apps.googleusercontent.com"
```

6. Commit/deploy. Hard-refresh the app. **Continue with Google** should open a Google account chooser/popup, not the full manual email form.

### Google troubleshooting

| Symptom | Check |
|---------|--------|
| Popup blocked | Allow popups for the site; retry |
| `origin_mismatch` / 403 | Origin in Google Console must match `location.origin` exactly |
| Works locally, not on Pages | Add `https://bryanralston.github.io` as origin |
| Cancel / close | App shows an error; no fake success session |

Optional: empty div `#google-btn-host` can host One Tap / GIS button when GIS is loaded.

---

## 3. Microsoft Entra ID (Azure AD) — app registration

1. Open [Azure Portal](https://portal.azure.com/) → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name: e.g. `Schedule Pro`
3. Supported account types:
   - **Accounts in any organizational directory and personal Microsoft accounts** → maps to tenant `common`
   - Or single tenant → use that directory’s **Directory (tenant) ID** in `microsoftTenantId`
4. **Redirect URI**
   - Platform: **Single-page application (SPA)**
   - URIs:
     - `https://bryanralston.github.io/schedule-builder/`
     - `https://bryanralston.github.io/` (if you ever host at site root)
     - `http://localhost` and/or `http://localhost:PORT/` matching your dev URL
   - Redirect URI must match what MSAL sends (app uses current page origin + pathname).
5. Register → copy **Application (client) ID**.
6. **Authentication**
   - Ensure SPA platform entries exist
   - **Allow public client flows**: not required for browser popup SPA
   - Implicit grant: not required for MSAL.js auth code + PKCE (default in modern msal-browser)
7. **API permissions**
   - Microsoft Graph: `openid`, `profile`, `email`, `User.Read` (delegated)
   - Grant admin consent if your tenant requires it
8. Paste into `monetization.json`:

```json
"microsoftClientId": "YOUR-AZURE-APP-CLIENT-ID",
"microsoftTenantId": "common"
```

9. Commit/deploy and hard-refresh.

### Microsoft troubleshooting

| Symptom | Check |
|---------|--------|
| `AADSTS50011` redirect mismatch | SPA redirect URI must exactly match the URL bar path |
| `AADSTS700016` application not found | Wrong client ID or wrong tenant |
| Popup closed | User cancel → app error, no session |
| Only work accounts | Set `microsoftTenantId` to `organizations` or a tenant GUID |

CDN: app loads **msal-browser** from jsDelivr when Microsoft sign-in is configured.

---

## 4. Domain allowlist (optional)

```json
"allowedEmailDomains": ["acme.com", "acme.co.uk"]
```

- Empty array / missing → any email domain allowed  
- Non-empty → Google, Microsoft, and work-email flows reject others with:  
  `Use your company email (@acme.com)`  
- **Continue offline** is never blocked by the allowlist  

---

## 5. What works without client IDs

| Path | Behavior |
|------|----------|
| Google / Microsoft buttons | Labeled **(preview)**; open “device workspace setup” modal (email, name, org). **No** claim of real OAuth tokens. |
| Work email | Local accounts (hashed password on device) |
| Continue offline | Device session, no email |
| Session TTL | Still applied via `sessionMaxDays` |
| Domain allowlist | Still applied to email + preview provider modal |

---

## 6. Session fields (auth v2)

Device session includes: `providerSub`, `emailVerified`, `authVersion: 2`, `expiresAt`, optional `sessionCheck` (SHA-256 of `id+email+method+signedInAt`). Expired or integrity-failed sessions clear and return to the auth shell. Sign-out clears session; wiping schedules remains an optional checkbox.

---

## 7. Quick verify checklist

1. Empty client IDs → buttons say preview; modal is honest device setup.  
2. Set Google client ID → real Google popup → session method `google` with real email/name.  
3. Set Microsoft client ID → MSAL popup → method `microsoft`.  
4. Org required → “Complete your workspace” (org only) when OAuth succeeds without org.  
5. `allowedEmailDomains: ["example.com"]` → `user@other.com` rejected.  
6. Account panel: “Signed in with Google/Microsoft · verified” when `emailVerified`.  
7. Offline continue + generate/export still work.  
