// Gmail API service worker

const GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1';
// Only match 6-digit numeric codes (standard OTP format)
const CODE_PATTERNS = [
  /\b(\d{6})\b/g,                             // Exactly 6 digits
];

// Get OAuth token
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}

// Fetch recent emails (last 5 minutes)
async function fetchRecentEmails(token) {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
  const query = `after:${fiveMinutesAgo}`;

  try {
    const response = await fetch(
      `${GMAIL_API_BASE}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status}`);
    }

    const data = await response.json();
    return data.messages || [];
  } catch (error) {
    console.error('Error fetching emails:', error);
    return [];
  }
}

// Get full email details
async function getEmailDetails(token, messageId) {
  try {
    const response = await fetch(
      `${GMAIL_API_BASE}/users/me/messages/${messageId}?format=full`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching email details:', error);
    return null;
  }
}

// Extract domain from email address or URL
function extractDomain(text) {
  if (!text) return null;

  // Email format: user@domain.com
  const emailMatch = text.match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
  if (emailMatch) {
    return emailMatch[1].toLowerCase();
  }

  // URL format
  try {
    const url = new URL(text.includes('://') ? text : `https://${text}`);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

// Get base domain (remove subdomains except www)
function getBaseDomain(domain) {
  if (!domain) return null;
  const parts = domain.split('.');
  if (parts.length > 2) {
    return parts.slice(-2).join('.');
  }
  return domain;
}

// Check if domains match
function domainsMatch(emailDomain, currentDomain, emailSubject = '', emailBody = '') {
  if (!emailDomain || !currentDomain) return false;

  // 1. Exact base domain match (strict)
  const baseEmailDomain = getBaseDomain(emailDomain);
  const baseCurrentDomain = getBaseDomain(currentDomain);

  if (baseEmailDomain === baseCurrentDomain) {
    console.log(`✓ Exact domain match: ${baseEmailDomain}`);
    return true;
  }

  // 2. Check for trusted third-party auth services
  // These services send emails on behalf of other domains
  const trustedAuthServices = [
    'dynamic.xyz',
    'dynamicauth.com',
    'privy.io',
    'sendgrid.net',
    'mailgun.org',
    'amazonses.com',
    'postmarkapp.com',
    'mailchimp.com',
    'mandrill.com'
  ];

  const isFromTrustedService = trustedAuthServices.some(service =>
    emailDomain.includes(service)
  );

  if (isFromTrustedService) {
    // For emails from trusted auth services, check if the email content
    // explicitly mentions the current domain or brand name
    const fullEmailText = `${emailSubject} ${emailBody}`.toLowerCase();

    // Extract meaningful brand keywords (not generic words like "app")
    const brandKeywords = extractBrandKeywords(currentDomain);

    for (const keyword of brandKeywords) {
      if (fullEmailText.includes(keyword)) {
        console.log(`✓ Trusted service match: "${keyword}" found in email from ${emailDomain}`);
        return true;
      }
    }

    // Also check if the full current domain appears in the email
    if (fullEmailText.includes(currentDomain.toLowerCase())) {
      console.log(`✓ Full domain found in email: ${currentDomain}`);
      return true;
    }
  }

  console.log(`✗ No match: ${emailDomain} vs ${currentDomain}`);
  return false;
}

// Extract brand-specific keywords from domain (not generic words)
// e.g., "app.usetapestry.dev" -> ["tapestry", "usetapestry"]
function extractBrandKeywords(domain) {
  if (!domain) return [];

  const keywords = new Set();

  // Generic prefixes/suffixes to strip from brand names
  const genericPrefixes = ['use', 'get', 'try', 'go', 'my', 'the', 'app'];
  const genericSuffixes = ['app', 'hq', 'io', 'co', 'inc', 'labs', 'tech'];

  // Generic words to exclude entirely
  const genericWords = new Set([
    'app', 'www', 'api', 'auth', 'login', 'mail', 'email',
    'dev', 'staging', 'prod', 'test', 'beta', 'admin',
    'dashboard', 'portal', 'web', 'mobile', 'cloud'
  ]);

  // Remove protocol and common TLDs
  const cleanDomain = domain
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/\.(com|net|org|io|dev|co|app|xyz|ai)$/i, '');

  // Split by dots and dashes
  const parts = cleanDomain.split(/[.-]/);

  for (const part of parts) {
    const lowerPart = part.toLowerCase();

    // Skip generic words
    if (genericWords.has(lowerPart)) continue;

    // Add the full part if it's meaningful (5+ chars)
    if (lowerPart.length >= 5) {
      keywords.add(lowerPart);
    }

    // Try to extract core brand by removing generic prefixes
    for (const prefix of genericPrefixes) {
      if (lowerPart.startsWith(prefix) && lowerPart.length > prefix.length + 3) {
        const coreBrand = lowerPart.slice(prefix.length);
        if (coreBrand.length >= 4 && !genericWords.has(coreBrand)) {
          keywords.add(coreBrand);
        }
      }
    }

    // Try to extract core brand by removing generic suffixes
    for (const suffix of genericSuffixes) {
      if (lowerPart.endsWith(suffix) && lowerPart.length > suffix.length + 3) {
        const coreBrand = lowerPart.slice(0, -suffix.length);
        if (coreBrand.length >= 4 && !genericWords.has(coreBrand)) {
          keywords.add(coreBrand);
        }
      }
    }
  }

  const keywordsArray = Array.from(keywords);
  console.log(`🔍 Brand keywords from "${domain}":`, keywordsArray);
  return keywordsArray;
}


// Decode base64 email content
function decodeEmailBody(body) {
  if (!body) return '';
  try {
    const decoded = atob(body.replace(/-/g, '+').replace(/_/g, '/'));
    return decoded;
  } catch {
    return '';
  }
}

// Extract verification codes from email
function extractCodes(emailData) {
  let bodyText = '';

  // Extract subject
  const subject = emailData.payload.headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';

  // Extract body
  if (emailData.payload.body?.data) {
    bodyText = decodeEmailBody(emailData.payload.body.data);
  } else if (emailData.payload.parts) {
    for (const part of emailData.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText += decodeEmailBody(part.body.data);
      }
    }
  }

  const fullText = `${subject} ${bodyText}`;
  const codes = new Set();

  // Try each pattern
  for (const pattern of CODE_PATTERNS) {
    const matches = fullText.matchAll(pattern);
    for (const match of matches) {
      const code = match[1] || match[0];
      // Only keep numeric codes, filter out false positives
      if (code && /^\d{4,8}$/.test(code)) {
        // Avoid years (2020-2030) and common numbers
        if (!/^(19|20)\d{2}$/.test(code) && !/^(1234|0000|1111)/.test(code)) {
          codes.add(code);
        }
      }
    }
  }

  // Return only the single most likely code (prefer 6-digit codes)
  const codesArray = Array.from(codes);
  codesArray.sort((a, b) => {
    // Prefer 6-digit codes (most common OTP)
    if (a.length === 6 && b.length !== 6) return -1;
    if (b.length === 6 && a.length !== 6) return 1;
    return 0;
  });

  // Return only the best match
  return codesArray.slice(0, 1);
}

// Get sender domain from email
function getSenderDomain(emailData) {
  const from = emailData.payload.headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
  return extractDomain(from);
}

// Find verification codes for a domain
async function findCodesForDomain(currentDomain, afterTimestamp = 0) {
  try {
    console.log(`\n🔍 Looking for codes for domain: ${currentDomain}`);
    console.log(`   Only emails after: ${new Date(afterTimestamp).toLocaleTimeString()}`);
    const token = await getAuthToken();
    console.log('✓ Got auth token');

    const recentMessages = await fetchRecentEmails(token);
    console.log(`📬 Found ${recentMessages.length} recent emails (last 5 minutes)`);

    const results = [];

    for (const message of recentMessages) {
      const emailData = await getEmailDetails(token, message.id);
      if (!emailData) continue;

      // Skip emails received before page load
      const emailTime = parseInt(emailData.internalDate);
      if (afterTimestamp && emailTime < afterTimestamp) {
        console.log(`⏭️ Skipping old email (received ${new Date(emailTime).toLocaleTimeString()})`);
        continue;
      }

      const senderDomain = getSenderDomain(emailData);

      // Extract subject and body for domain matching
      const subject = emailData.payload.headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
      let bodyText = '';
      if (emailData.payload.body?.data) {
        bodyText = decodeEmailBody(emailData.payload.body.data);
      } else if (emailData.payload.parts) {
        for (const part of emailData.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            bodyText += decodeEmailBody(part.body.data);
          }
        }
      }

      // Check domain match (now with email content)
      console.log(`📧 Checking email from: ${senderDomain}`);
      console.log(`   Subject: "${subject}"`);

      if (domainsMatch(senderDomain, currentDomain, subject, bodyText)) {
        const codes = extractCodes(emailData);

        if (codes.length > 0) {
          console.log(`✅ Found ${codes.length} code(s):`, codes);
          results.push({
            codes,
            senderDomain,
            subject,
            timestamp: parseInt(emailData.internalDate)
          });
        } else {
          console.log(`⚠️ Domain matched but no codes found in email`);
        }
      } else {
        console.log(`❌ Domain match failed`);
      }
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp - a.timestamp);

    return results;
  } catch (error) {
    console.error('Error finding codes:', error);
    return [];
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'findCodes') {
    findCodesForDomain(request.domain, request.afterTimestamp).then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (request.action === 'checkAuth') {
    // Silent check — no interactive prompt
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      sendResponse({ authenticated: !!token });
    });
    return true;
  }

  if (request.action === 'disconnect') {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        // Revoke the token with Google so the consent screen shows again
        fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`)
          .finally(() => {
            chrome.identity.removeCachedAuthToken({ token }, () => {
              chrome.identity.clearAllCachedAuthTokens(() => {
                chrome.storage.local.remove(['authCached', 'recentFills']);
                sendResponse({ disconnected: true });
              });
            });
          });
      } else {
        chrome.identity.clearAllCachedAuthTokens(() => {
          chrome.storage.local.remove(['authCached', 'recentFills']);
          sendResponse({ disconnected: true });
        });
      }
    });
    return true;
  }

  if (request.action === 'authenticate') {
    // Interactive — opens OAuth consent flow
    console.log('🔑 authenticate: starting interactive OAuth flow');
    getAuthToken()
      .then((token) => {
        console.log('🔑 authenticate: got token', !!token);
        sendResponse({ authenticated: true });
      })
      .catch((err) => {
        console.error('🔑 authenticate: failed', err);
        sendResponse({ authenticated: false });
      });
    return true;
  }
});
