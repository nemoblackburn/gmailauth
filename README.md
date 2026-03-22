# fromGmail

Chrome extension that auto-fills verification codes from your Gmail inbox. No tab switching, no copy-pasting.

## How it works

1. A verification code arrives in Gmail
2. fromGmail detects it instantly
3. The code fills automatically on the page

## Install

Get it from the [Chrome Web Store](#) or load it unpacked:

```
git clone https://github.com/nemoblackburn/gmailauth.git
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `chrome-auth-autofill` folder

## Privacy

- Codes are read locally and never stored
- Only reads emails when you're on a page with a code input
- No data leaves your browser
- Requires `gmail.readonly` — never sends or modifies emails

## Structure

```
chrome-auth-autofill/   # Chrome extension
landing/                # Marketing site (fromgmail.com)
```

## License

MIT
