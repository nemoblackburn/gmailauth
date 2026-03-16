# Gmail Auth Code AutoFill - Chrome Extension

Automatically detect and fill verification codes from Gmail, similar to iOS/Android "From Messages" flow.

## Features

- 🔍 **Smart Detection**: Automatically detects auth code input fields on any website
- 📧 **Gmail Integration**: Reads verification codes from your Gmail (last 5 minutes)
- 🔒 **Domain Matching**: Only shows codes from emails matching the current site's domain
- ⚡ **Fast & Secure**: OAuth-based authentication, codes never stored

## Setup Instructions

### 1. Create Google Cloud Project & OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Gmail API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: **Chrome Extension**
   - Name: `Gmail Auth Code AutoFill`
   - Copy the **Client ID** (format: `xxxxx.apps.googleusercontent.com`)

5. Configure OAuth Consent Screen:
   - Go to "APIs & Services" > "OAuth consent screen"
   - User Type: **External** (for personal use) or **Internal** (for workspace)
   - Add scope: `https://www.googleapis.com/auth/gmail.readonly`

### 2. Get Extension ID

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `chrome-auth-autofill` folder
5. Copy the **Extension ID** from the card (format: `abcdefghijklmnopqrstuvwxyz`)

### 3. Add Extension ID to OAuth Credentials

1. Go back to Google Cloud Console > Credentials
2. Edit your OAuth Client ID
3. Under "Authorized redirect URIs", add:
   ```
   https://<EXTENSION_ID>.chromiumapp.org/
   ```
   Replace `<EXTENSION_ID>` with your actual extension ID

### 4. Update manifest.json

Edit `manifest.json` and replace `YOUR_CLIENT_ID` with your actual Client ID:

```json
"oauth2": {
  "client_id": "123456789-abcdefg.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/gmail.readonly"
  ]
}
```

### 5. Reload Extension

1. Go to `chrome://extensions/`
2. Click the refresh icon on your extension
3. Click the extension icon and click "Connect Gmail"
4. Grant Gmail read permissions

## Usage

1. Navigate to any website with a verification code field
2. Focus on the input field
3. If there's a matching code in your recent Gmail, you'll see a popup
4. Click the code to auto-fill

## How It Works

### Domain Matching
- Extracts sender domain from email (e.g., `noreply@github.com` → `github.com`)
- Compares with current site domain
- Only shows codes when domains match (base domain comparison)

### Code Detection
- Looks for 4-8 digit/alphanumeric codes
- Searches email subject and body
- Patterns: "code: 123456", "OTP: 123456", "PIN: 1234", etc.

### Field Detection
- Detects inputs with: `code`, `otp`, `token`, `pin`, `verify` in id/name/placeholder
- Checks for `autocomplete="one-time-code"`
- Looks for numeric input fields with 4-8 character limits

## Privacy & Security

- **Read-only access**: Only reads Gmail, never sends or modifies
- **Recent emails only**: Only checks last 5 minutes
- **No storage**: Codes are never stored locally
- **Domain matching**: Only shows codes relevant to current site
- **OAuth tokens**: Securely managed by Chrome

## Troubleshooting

### "Not connected" status
- Click "Connect Gmail" and grant permissions
- Check that Gmail API is enabled in Google Cloud Console
- Verify Client ID is correct in manifest.json

### No codes appearing
- Make sure the email was received in the last 5 minutes
- Verify sender domain matches current site (check console logs)
- Try manually triggering by refocusing the input field

### "OAuth error"
- Make sure extension ID is added to authorized redirect URIs
- Try removing and re-adding OAuth consent

## Development

To modify code patterns, edit `CODE_PATTERNS` in `background.js`:

```javascript
const CODE_PATTERNS = [
  /\b(\d{4,8})\b/g,  // Add your patterns here
];
```

To modify field detection, edit `AUTH_FIELD_PATTERNS` in `content.js`.

## License

MIT
