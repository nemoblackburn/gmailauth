# Reload the Extension

1. Go to chrome://extensions/
2. Find "Gmail Auth Code AutoFill"
3. Click the refresh/reload icon
4. Go back to app.usetapestry.dev
5. Focus on the auth code field
6. Check the browser console (F12) to see the matching logs

## What Changed:

The extension now does **3-tier matching**:

### Tier 1: Exact Domain Match (strict)
- `notifications.dynamicauth.com` vs `app.usetapestry.dev` → ✗

### Tier 2: Content-Based Match (smart)
- Extracts keywords from current domain: `app.usetapestry.dev` → `["tapestry", "usetapestry", "app"]`
- Searches email subject/body for those keywords
- Subject: "Tapestry login code" contains "tapestry" → ✓

### Tier 3: Trusted Services (lenient)
- Recognizes third-party auth services like:
  - dynamicauth.com
  - sendgrid.net
  - mailgun.org
  - etc.

## Debug Output:
Open the console (F12) and you'll see:
```
🔍 Extracted keywords from "app.usetapestry.dev": ["app", "tapestry", "usetapestry"]
✓ Domain match found: "tapestry" in email content
```
