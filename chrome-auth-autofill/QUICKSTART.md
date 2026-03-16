# Quick Start - 5 Minutes to Working Extension

## Prerequisites
- Chrome browser
- Gmail account
- Google Cloud account (free)

## Fast Track Setup

### 1. Google Cloud Setup (2 minutes)

**Create OAuth Credentials:**
1. Go to https://console.cloud.google.com/apis/credentials
2. Create new project or select existing
3. Click "Enable APIs and Services" → Search "Gmail API" → Enable
4. Go to "OAuth consent screen":
   - External → Create
   - App name: "Gmail AutoFill", your email → Save
   - Add scope: `../auth/gmail.readonly` → Save
   - Add test user: your Gmail → Save
5. Go to "Credentials" → Create Credentials → OAuth client ID:
   - Type: **Chrome Extension**
   - Name: anything
   - **COPY THE CLIENT ID** (format: `xxx.apps.googleusercontent.com`)

### 2. Load Extension (1 minute)

1. Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. "Load unpacked" → Select `chrome-auth-autofill` folder
4. **COPY THE EXTENSION ID** (long string under extension name)

### 3. Link OAuth to Extension (1 minute)

1. Back to Google Cloud Console → Credentials
2. Click your OAuth Client ID
3. "Authorized redirect URIs" → Add URI:
   ```
   https://YOUR_EXTENSION_ID_HERE.chromiumapp.org/
   ```
   (Replace with your actual extension ID)
4. Save

### 4. Configure Extension (30 seconds)

1. Open `manifest.json`
2. Line 24: Replace `YOUR_CLIENT_ID` with your actual Client ID
3. Save file
4. Chrome → `chrome://extensions/` → Click refresh icon on extension

### 5. Authorize (30 seconds)

1. Click extension icon in toolbar
2. "Connect Gmail"
3. Sign in → Allow access

## Test It!

**Easy test:**
1. Open `test-page.html` in Chrome (from extension folder)
2. Send yourself an email:
   - Subject: "Your code is 123456"
   - Wait a few seconds for it to arrive
3. Click any code input field on test page
4. Should see autofill popup with "123456"!

**Real-world test:**
1. Go to GitHub → Settings → Security → Enable 2FA
2. GitHub will send you a code via email
3. On the 2FA setup page, click the code input
4. See the code from your email appear in the popup!

## Troubleshooting

**Extension won't load**
- Icons created? Check `icons/` folder has PNG files
- Run: `node create-png-icons.js` if missing

**"Not connected" in popup**
- Client ID correct in manifest.json?
- Extension ID added to OAuth redirect URIs?
- Try: Click "Connect Gmail" again

**No autofill popup appears**
- Email less than 5 minutes old?
- Check browser console (F12) for errors
- Sender domain matches current site?
  - Example: Email from `noreply@github.com` only works on `github.com`

**OAuth/Permission errors**
- Extension ID in redirect URIs?
- Gmail API enabled in Cloud Console?
- Test user added to OAuth consent screen?

## How Domain Matching Works

The extension extracts domains like this:

| Email Sender | Extracted Domain | Matches Sites |
|-------------|-----------------|---------------|
| `noreply@github.com` | `github.com` | `github.com`, `www.github.com`, `api.github.com` |
| `no-reply@accounts.google.com` | `google.com` | `google.com`, `accounts.google.com` |
| `auth@vercel.com` | `vercel.com` | `vercel.com`, `*.vercel.com` |

**Base domain matching:** Subdomains are normalized (e.g., `api.github.com` → `github.com`)

## Usage Tips

- **Focus the field**: Click into the verification code input
- **Recent emails only**: Last 5 minutes (prevents stale codes)
- **Multiple codes**: If email has multiple codes, all are shown
- **One-click fill**: Click the code button to auto-fill

## Privacy

✓ Read-only Gmail access
✓ Only checks last 5 minutes
✓ No data stored locally
✓ Codes never cached
✓ Domain matching prevents wrong-site filling

## Next Steps

- [ ] Customize field detection patterns (`content.js`)
- [ ] Adjust time window (`background.js` line 14)
- [ ] Add more code patterns (`background.js` lines 3-10)
- [ ] Replace placeholder icons with real ones
- [ ] Publish to Chrome Web Store (optional)

---

**Need help?** Check `SETUP.md` for detailed instructions or open an issue.
