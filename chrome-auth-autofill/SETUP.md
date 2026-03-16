# Quick Setup Guide

## Step 1: Create Icons (Temporary Placeholders)

Since we need icons to load the extension, create placeholder images:

**Option A: Use any image tool**
- Create 3 PNG files: `icon16.png`, `icon48.png`, `icon128.png`
- Save them in the `icons/` folder
- Any simple blue/white images will work

**Option B: Download from web**
```bash
cd icons
# Use any 16x16, 48x48, 128x128 PNG images
# Or create simple colored squares for testing
```

**Option C: Quick Base64 method**
Open `create-icons.html` in your browser - it will auto-download the 3 icon files. Move them to the `icons/` folder.

## Step 2: Google Cloud Setup (5 minutes)

### Create Project
1. Go to https://console.cloud.google.com/
2. Click "Select a project" → "New Project"
3. Name: `Gmail AutoFill` → Create

### Enable Gmail API
1. Go to "APIs & Services" → "Library"
2. Search "Gmail API"
3. Click "Enable"

### Create OAuth Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure OAuth consent screen:
   - User Type: **External**
   - App name: `Gmail Auth AutoFill`
   - User support email: your email
   - Developer contact: your email
   - Click "Save and Continue"
   - Scopes: Click "Add or Remove Scopes"
     - Search for `gmail.readonly`
     - Check the box
     - Click "Update" → "Save and Continue"
   - Test users: Add your Gmail address
   - Click "Save and Continue" → "Back to Dashboard"

4. Go back to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Application type: **Chrome Extension**
6. Name: `Gmail Auth AutoFill`
7. **COPY THE CLIENT ID** (looks like: `123456-abc.apps.googleusercontent.com`)
8. Click "Create"

## Step 3: Load Extension & Get Extension ID

1. Open Chrome: `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `chrome-auth-autofill` folder
5. **COPY THE EXTENSION ID** (under the extension name, looks like: `abcdefghijklmnop`)

## Step 4: Link Extension to OAuth

1. Go back to Google Cloud Console → Credentials
2. Click on your OAuth Client ID (the one you just created)
3. Under "Authorized redirect URIs", click "Add URI"
4. Paste: `https://YOUR_EXTENSION_ID.chromiumapp.org/`
   - Replace `YOUR_EXTENSION_ID` with the actual ID from step 3
5. Click "Save"

## Step 5: Update manifest.json

1. Open `manifest.json` in your editor
2. Find the `oauth2` section
3. Replace `YOUR_CLIENT_ID` with your actual Client ID from Step 2
4. Save the file

## Step 6: Reload & Authorize

1. Go to `chrome://extensions/`
2. Click the **refresh icon** on your extension
3. Click the extension icon in Chrome toolbar
4. Click "Connect Gmail"
5. Sign in and grant permissions

## Step 7: Test It!

1. Go to any site with a verification code field (try GitHub, Google, etc.)
2. Have someone send you an email with a code (or trigger a real auth flow)
3. Focus the verification code field
4. You should see the auto-fill popup!

## Common Issues

**Extension won't load**
- Make sure icons exist in `icons/` folder
- Check manifest.json for syntax errors

**OAuth error**
- Double-check Extension ID is in authorized redirect URIs
- Make sure it ends with `.chromiumapp.org/`

**"Not connected"**
- Make sure Gmail API is enabled
- Check Client ID in manifest.json matches Google Cloud Console
- Try revoking and re-granting permissions

**No codes appearing**
- Email must be less than 5 minutes old
- Sender domain must match current site domain
- Check browser console for errors (F12)

## Security Note

This extension:
- Only reads Gmail (read-only permission)
- Only checks last 5 minutes of email
- Never stores codes or emails
- Only shows codes for domain-matched sites
- Uses OAuth (no passwords stored)
