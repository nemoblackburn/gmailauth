# Gmail Auth AutoFill - Development Progress

## Status: Working (OTP autofill functional)

## What Was Built
A Chrome extension that automatically detects OTP/verification code input fields and fetches matching codes from Gmail to autofill them.

## Completed Features

### 1. OTP Field Detection (`content.js`)
- Detects 6-digit OTP input fields including those in Shadow DOM (like Dynamic Auth modals)
- Uses MutationObserver to detect dynamically added fields
- Works with multi-input OTP patterns (6 separate boxes)

### 2. Gmail Integration (`background.js`)
- OAuth2 authentication with Gmail API
- Fetches recent emails (last 5 minutes)
- Extracts 6-digit codes from email body

### 3. Domain Matching (`background.js`)
- Strict domain matching: only shows codes from emails that match current site
- Supports trusted third-party auth services (Dynamic Auth, SendGrid, etc.)
- Extracts brand keywords from domain (e.g., `app.usetapestry.dev` -> `["usetapestry", "tapestry"]`)
- Matches if email content contains the brand name

### 4. Auto-Popup UI (`content.js`, `styles/autofill.css`)
- Automatically polls for codes every 3 seconds when OTP fields detected
- Only shows codes from emails received AFTER page load (prevents stale codes)
- High z-index (2147483647) to appear above Dynamic Auth modals
- Click to autofill into OTP fields

## Key Bug Fixes Applied

1. **`chrome.runtime.sendMessage` error** - Added check for extension context validity before calling
2. **Popup hidden behind modal** - Increased z-index from 999999 to 2147483647
3. **Wrong codes shown (LinkedIn instead of Tapestry)** - Fixed domain matching to be stricter
4. **Too many false positive codes** - Simplified to only match exactly 6-digit codes
5. **Time filtering** - Only shows codes from emails received after page load

## File Structure
```
chrome-auth-autofill/
├── manifest.json        # Extension config, OAuth client ID
├── background.js        # Gmail API, code extraction, domain matching
├── content.js           # OTP field detection, UI, autofill logic
├── popup.html/js        # Extension popup (connect Gmail button)
├── styles/
│   └── autofill.css     # Autofill suggestion UI styles
└── icons/               # Extension icons
```

## Key Code Locations

- **Domain matching**: `background.js` - `domainsMatch()` and `extractBrandKeywords()`
- **Code extraction**: `background.js` - `extractCodes()` and `CODE_PATTERNS`
- **OTP field detection**: `content.js` - `isAuthCodeField()` and `findAllInputs()`
- **Auto-popup logic**: `content.js` - `attachListeners()` with polling interval
- **Time filtering**: `content.js` - `pageLoadTime` passed to background, filtered in `findCodesForDomain()`

## Testing
Tested on: `app.usetapestry.dev/login` with Dynamic Auth OTP flow
- Email sender: `authentication@notifications.dynamicauth.com`
- Email contains "Tapestry" in body, 6-digit code

---

## Next Task: Magic Link Auto-Open

### Goal
Automatically detect and open magic login links from Gmail emails.

### Suggested Approach

1. **Add magic link detection in `background.js`**:
   ```javascript
   const MAGIC_LINK_PATTERNS = [
     /https?:\/\/[^\s]+\/(magic|login|auth|verify)\?[^\s]+token=[^\s]+/gi,
     /https?:\/\/[^\s]+\/callback\?[^\s]+/gi
   ];
   ```

2. **Extract magic links in `extractCodes()` or new `extractMagicLinks()` function**

3. **Add UI option to open link** - Button in the autofill popup that opens the magic link in current tab

4. **Security considerations**:
   - Only open links from trusted/matched domains
   - Maybe require user click rather than auto-opening (security)
   - Validate link domain matches current site's auth provider

5. **Content script changes**:
   - Detect "check your email" / "magic link sent" UI patterns
   - Show magic link button when detected

### Files to Modify
- `background.js` - Add magic link extraction
- `content.js` - Add magic link UI and detection
- `styles/autofill.css` - Style for magic link button
