// Content script for detecting auth code fields and auto-filling

console.log('🚀 Gmail Auth AutoFill extension loaded');
console.log('   Domain:', window.location.hostname);

let currentDomain = window.location.hostname;
let pageLoadTime = Date.now(); // Track when page loaded
let observerActive = false;
let shadowObservers = new Map(); // Track observers for shadow roots
let suppressAutofillUntil = 0;
let activeRequestNonce = 0;
let currentUrl = window.location.href;
let authEnabled = true;

const AUTOFILL_SUPPRESSION_MS = 15000;

// Patterns to detect auth code input fields
const AUTH_FIELD_PATTERNS = {
  id: /code|otp|token|pin|verify|verification|2fa|mfa|auth/i,
  name: /code|otp|token|pin|verify|verification|2fa|mfa|auth/i,
  placeholder: /code|otp|token|pin|verify|verification|enter.*code/i,
  autocomplete: /one-time-code/i,
  type: /tel|text|number/i,
  inputmode: /numeric/i
};

// Recursively find all inputs including those inside Shadow DOM
function findAllInputs(root = document) {
  const inputs = [];

  // Get inputs in this root
  const directInputs = root.querySelectorAll('input:not([type="password"]):not([type="email"])');
  inputs.push(...directInputs);

  // Find all elements that might have shadow roots
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      // Recursively search inside shadow root
      const shadowInputs = findAllInputs(el.shadowRoot);
      inputs.push(...shadowInputs);
    }
  }

  return inputs;
}

// Find sibling inputs (handles both regular DOM and Shadow DOM)
function findSiblingInputs(input) {
  const parent = input.parentElement;
  if (!parent) return [input];

  // Try to find siblings in the same parent
  let siblings = Array.from(parent.querySelectorAll('input'));

  // If we're in a shadow root and didn't find many siblings, go up further
  if (siblings.length < 4) {
    const grandparent = parent.parentElement;
    if (grandparent) {
      siblings = Array.from(grandparent.querySelectorAll('input'));
    }
  }

  return siblings;
}

function isAutofillSuppressed() {
  return Date.now() < suppressAutofillUntil;
}

function suppressAutofill(reason, durationMs = AUTOFILL_SUPPRESSION_MS) {
  suppressAutofillUntil = Math.max(suppressAutofillUntil, Date.now() + durationMs);
  activeRequestNonce += 1;
  stopPolling();
  console.log(`🚫 Suppressing autofill for ${Math.ceil(durationMs / 1000)}s (${reason})`);
}

function applyAuthState(authenticated) {
  authEnabled = authenticated;
  activeRequestNonce += 1;
  stopPolling();

  if (authEnabled) {
    console.log('🔑 Auth state changed, re-scanning for auth fields...');
    suppressAutofillUntil = 0;
    setTimeout(attachListeners, 300);
  } else {
    console.log('🔒 Auth disconnected, stopping autofill checks');
  }
}

// Check if input field is likely an auth code field
function isAuthCodeField(input) {
  if (!input || input.type === 'password' || input.type === 'email') {
    return false;
  }

  // Check for single-digit input pattern (common in verification codes)
  if (input.maxLength === 1 || input.size === 1) {
    // Look for siblings with similar pattern (6-digit code inputs)
    const siblings = findSiblingInputs(input).filter(i => i.maxLength === 1 || i.size === 1);
    if (siblings.length >= 4 && siblings.length <= 8) {
      console.log('✓ Detected multi-digit input pattern:', siblings.length, 'fields');
      return true;
    }
  }

  // Check for numeric inputMode (common in OTP fields like Dynamic auth)
  // Dynamic uses inputMode="numeric" with type="text"
  if (input.inputMode === 'numeric' && input.type === 'text') {
    const siblings = findSiblingInputs(input).filter(i => i.inputMode === 'numeric');
    if (siblings.length >= 4 && siblings.length <= 8) {
      console.log('✓ Detected numeric inputMode pattern:', siblings.length, 'fields');
      return true;
    }
  }

  // Check various attributes
  const checks = [
    AUTH_FIELD_PATTERNS.id.test(input.id || ''),
    AUTH_FIELD_PATTERNS.name.test(input.name || ''),
    AUTH_FIELD_PATTERNS.placeholder.test(input.placeholder || ''),
    AUTH_FIELD_PATTERNS.autocomplete.test(input.autocomplete || ''),
    input.maxLength >= 4 && input.maxLength <= 8,
    input.inputMode === 'numeric'
  ];

  // Check parent labels
  const label = input.labels?.[0] || input.closest('label');
  if (label) {
    checks.push(AUTH_FIELD_PATTERNS.name.test(label.textContent || ''));
  }

  // Check for verification/code context in surrounding text
  const parentText = input.closest('form, div[class*="modal"], div[class*="card"]')?.textContent || '';
  if (AUTH_FIELD_PATTERNS.name.test(parentText)) {
    checks.push(true);
  }

  return checks.filter(Boolean).length >= 2;
}

// Find all auth code fields on page (including Shadow DOM)
function findAuthCodeFields() {
  const inputs = findAllInputs(document);
  const authFields = [];

  console.log(`🔎 Scanning ${inputs.length} total inputs (including Shadow DOM)`);

  for (const input of inputs) {
    // Visibility check - for shadow DOM elements, offsetParent might be null
    // so we also check if the element has dimensions
    const rect = input.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0;

    if (isAuthCodeField(input) && isVisible) {
      authFields.push(input);
    }
  }

  return authFields;
}

// Show loading indicator below the field
function showLoadingIndicator(field) {
  if (document.getElementById('gmail-auth-autofill-loading')) return;
  if (!field.isConnected) return;

  const rect = field.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;

  const loader = document.createElement('div');
  loader.id = 'gmail-auth-autofill-loading';
  loader.className = 'gmail-auth-autofill-suggestion';
  loader.style.top = `${rect.bottom + window.scrollY + 4}px`;
  loader.style.left = `${rect.left + window.scrollX}px`;
  loader.style.width = `${Math.max(rect.width, 200)}px`;
  loader.innerHTML = `
    <div class="auth-suggestion-header">
      <svg width="16" height="16" viewBox="0 0 70 70" fill="none">
        <rect width="70" height="70" rx="16" fill="#2DD4A8"/>
        <path d="M35 14L35 56" stroke="#0F0F12" stroke-width="12" stroke-linecap="round"/>
        <path d="M14 23.5L56 46.5" stroke="#0F0F12" stroke-width="12" stroke-linecap="round"/>
        <path d="M14 46.5L56 23.5" stroke="#0F0F12" stroke-width="12" stroke-linecap="round"/>
      </svg>
      <span class="auth-loading-text">Checking Gmail<span class="auth-loading-dots"></span></span>
    </div>
  `;
  document.body.appendChild(loader);
}

function removeLoadingIndicator() {
  document.getElementById('gmail-auth-autofill-loading')?.remove();
}

// Create and show autofill suggestion UI
function showAutofillSuggestion(field, codeData) {
  if (isAutofillSuppressed()) {
    return;
  }

  // Don't show if the field is no longer in the DOM
  if (!field.isConnected) {
    stopPolling();
    return;
  }

  // Remove loading indicator and any existing suggestions
  removeLoadingIndicator();
  removeAutofillSuggestion();

  const suggestion = document.createElement('div');
  suggestion.id = 'gmail-auth-autofill-suggestion';
  suggestion.className = 'gmail-auth-autofill-suggestion';

  const rect = field.getBoundingClientRect();

  // Don't show if the field has no dimensions (hidden or removed)
  if (rect.width === 0 && rect.height === 0) {
    stopPolling();
    return;
  }

  suggestion.style.top = `${rect.bottom + window.scrollY + 4}px`;
  suggestion.style.left = `${rect.left + window.scrollX}px`;
  suggestion.style.width = `${Math.max(rect.width, 200)}px`;

  // Create suggestion content
  const mostRecentCode = codeData[0];
  const codes = mostRecentCode.codes;

  suggestion.innerHTML = `
    <div class="auth-suggestion-header">
      <svg width="16" height="16" viewBox="0 0 70 70" fill="none">
        <rect width="70" height="70" rx="16" fill="#2DD4A8"/>
        <path d="M35 14L35 56" stroke="#0F0F12" stroke-width="12" stroke-linecap="round"/>
        <path d="M14 23.5L56 46.5" stroke="#0F0F12" stroke-width="12" stroke-linecap="round"/>
        <path d="M14 46.5L56 23.5" stroke="#0F0F12" stroke-width="12" stroke-linecap="round"/>
      </svg>
      <span>from<strong style="color:#F5F5F0;font-weight:700">Gmail</strong></span>
    </div>
    <div class="auth-suggestion-codes">
      ${codes.map(code => `
        <button class="auth-code-button" data-code="${code}">
          ${code}
        </button>
      `).join('')}
    </div>
    <div class="auth-suggestion-info">
      ${mostRecentCode.senderDomain}
    </div>
  `;

  document.body.appendChild(suggestion);

  // Add click handlers
  suggestion.querySelectorAll('.auth-code-button').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const code = button.getAttribute('data-code');
      fillCode(field, code);
      onCodeFilled();
    });
  });

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', onOutsideClick);
  }, 100);
}

function onOutsideClick(e) {
  const suggestion = document.getElementById('gmail-auth-autofill-suggestion');
  if (suggestion && !suggestion.contains(e.target)) {
    removeAutofillSuggestion();
  }
}

function removeAutofillSuggestion() {
  // Remove all instances in case duplicates were created by race conditions
  document.querySelectorAll('#gmail-auth-autofill-suggestion, .gmail-auth-autofill-suggestion').forEach(el => el.remove());
  document.removeEventListener('click', onOutsideClick);
}

// Fill the code into the field
function fillCode(field, code) {
  // Check if this is a multi-input pattern (single-digit or numeric inputMode)
  const isMultiInput = field.maxLength === 1 || field.size === 1 ||
    (field.inputMode === 'numeric' && field.type === 'text');

  if (isMultiInput) {
    // Find sibling inputs (works with Shadow DOM too)
    let siblings = findSiblingInputs(field);

    // Filter to only similar inputs
    if (field.maxLength === 1 || field.size === 1) {
      siblings = siblings.filter(i => i.maxLength === 1 || i.size === 1);
    } else if (field.inputMode === 'numeric') {
      siblings = siblings.filter(i => i.inputMode === 'numeric');
    }

    if (siblings.length >= code.length) {
      // Fill each digit into separate inputs
      for (let i = 0; i < code.length && i < siblings.length; i++) {
        siblings[i].value = code[i];
        siblings[i].dispatchEvent(new Event('input', { bubbles: true }));
        siblings[i].dispatchEvent(new Event('change', { bubbles: true }));
      }
      siblings[code.length - 1].focus();
      console.log('✓ Filled code into multi-digit inputs');
      return;
    }
  }

  // Standard single-field fill
  field.value = code;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  field.focus();
}

function getCompletedCode(field) {
  if (!field || !field.isConnected) {
    return null;
  }

  const isMultiInput = field.maxLength === 1 || field.size === 1 ||
    (field.inputMode === 'numeric' && field.type === 'text');

  if (isMultiInput) {
    let siblings = findSiblingInputs(field);

    if (field.maxLength === 1 || field.size === 1) {
      siblings = siblings.filter(i => i.maxLength === 1 || i.size === 1);
    } else if (field.inputMode === 'numeric') {
      siblings = siblings.filter(i => i.inputMode === 'numeric');
    }

    if (siblings.length < 4 || siblings.length > 8) {
      return null;
    }

    const digits = siblings.map(input => (input.value || '').trim());
    if (digits.every(value => /^\d$/.test(value))) {
      return digits.join('');
    }

    return null;
  }

  const value = (field.value || '').trim();
  if (!/^\d{4,8}$/.test(value)) {
    return null;
  }

  if (field.maxLength > 0 && value.length < Math.min(field.maxLength, 8)) {
    return null;
  }

  return value;
}

function maybeHandleCompletedCode(field, source = 'field input') {
  const completedCode = getCompletedCode(field);
  if (!completedCode) {
    return;
  }

  suppressAutofill(`${source}: ${completedCode.length}-digit code entered`);
}

// Check for codes when field is focused
async function onFieldFocus(field, { showLoading = false } = {}) {
  if (!authEnabled || isAutofillSuppressed()) return;

  console.log('🎯 Auth field focused, checking for codes...');
  console.log('   Current domain:', currentDomain);

  // Check if extension context is still valid
  if (!chrome.runtime || !chrome.runtime.sendMessage) {
    console.warn('⚠️ Extension context invalidated. Please refresh the page.');
    return;
  }

  // Show loading indicator if no suggestion is visible yet
  if (showLoading && !document.getElementById('gmail-auth-autofill-suggestion')) {
    showLoadingIndicator(field);
  }

  try {
    const requestNonce = activeRequestNonce;
    const response = await chrome.runtime.sendMessage({
      action: 'findCodes',
      domain: currentDomain,
      afterTimestamp: Date.now() - 5 * 60 * 1000
    });

    console.log('📬 Response from background:', response);
    console.log('   domain sent:', currentDomain);

    // Re-check after async gap — code may have been filled while awaiting
    if (requestNonce !== activeRequestNonce || isAutofillSuppressed() || !field.isConnected) {
      removeLoadingIndicator();
      return;
    }

    if (response && response.length > 0) {
      console.log('✅ Showing autofill suggestion');
      showAutofillSuggestion(field, response);
    } else {
      console.log('❌ No codes found for this domain');
    }
  } catch (error) {
    removeLoadingIndicator();
    // Handle extension context invalidation error specifically
    if (error.message?.includes('Extension context invalidated')) {
      console.warn('⚠️ Extension was reloaded. Please refresh the page.');
    } else {
      console.error('❌ Error fetching codes:', error);
    }
  }
}

let pollingInterval = null;

function stopPolling() {
  if (pollingInterval) {
    if (typeof pollingInterval === 'number') clearTimeout(pollingInterval);
    pollingInterval = null;
    console.log('⏹️ Stopped code polling');
  }
  removeLoadingIndicator();
  removeAutofillSuggestion();
}

function onCodeFilled() {
  suppressAutofill('autofill code applied');
  console.log('✅ Code filled, polling paused while auth completes');
}

// Attach focus listeners to auth fields AND auto-check for codes
function attachListeners() {
  if (!authEnabled) {
    stopPolling();
    return;
  }

  if (isAutofillSuppressed()) return;

  const authFields = findAuthCodeFields();

  if (authFields.length > 0) {
    console.log(`🔍 Found ${authFields.length} auth code field(s)`);

    // Start polling for codes when OTP fields are detected
    const firstField = authFields[0];
    if (!pollingInterval) {
      console.log('🚀 Starting code polling (back-to-back)...');
      // Use a sentinel value to indicate polling is active
      pollingInterval = true;
      // Poll as fast as possible: fire next check immediately after previous completes
      (async function pollLoop() {
        if (!pollingInterval) return;
        if (!firstField.isConnected) { stopPolling(); return; }
        // Only check if suggestion not already shown
        if (!document.getElementById('gmail-auth-autofill-suggestion')) {
          await onFieldFocus(firstField, { showLoading: true });
        }
        if (!pollingInterval) return;
        // Tiny breathing room to avoid a truly tight loop, then go again
        pollingInterval = setTimeout(pollLoop, 200);
      })();
    }
  } else if (pollingInterval) {
    // OTP fields are gone, stop polling
    stopPolling();
  }

  authFields.forEach(field => {
    if (!field.dataset.authAutofillAttached) {
      field.dataset.authAutofillAttached = 'true';
      field.addEventListener('focus', () => onFieldFocus(field));
    }

    if (!field.dataset.authAutofillCompletionAttached) {
      field.dataset.authAutofillCompletionAttached = 'true';
      field.addEventListener('input', () => maybeHandleCompletedCode(field));
      field.addEventListener('change', () => maybeHandleCompletedCode(field, 'field change'));
    }
  });
}

function handleLocationChange() {
  const nextUrl = window.location.href;
  if (nextUrl === currentUrl) {
    return;
  }

  currentUrl = nextUrl;
  currentDomain = window.location.hostname;
  pageLoadTime = Date.now();
  activeRequestNonce += 1;
  stopPolling();

  console.log('↪️ Navigation detected, resetting auth field scan');
  console.log('   New URL:', currentUrl);

  setTimeout(() => {
    if (!isAutofillSuppressed()) {
      attachListeners();
    }
  }, 250);
}

function installNavigationObserver() {
  const wrapHistoryMethod = (methodName) => {
    const original = window.history[methodName];

    window.history[methodName] = function (...args) {
      const result = original.apply(this, args);
      setTimeout(handleLocationChange, 0);
      return result;
    };
  };

  wrapHistoryMethod('pushState');
  wrapHistoryMethod('replaceState');

  window.addEventListener('popstate', () => setTimeout(handleLocationChange, 0));
  window.addEventListener('hashchange', handleLocationChange);
}

// Observe a shadow root for changes
function observeShadowRoot(shadowRoot) {
  if (shadowObservers.has(shadowRoot)) return;

  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            if (node.matches?.('input') || node.querySelector?.('input')) {
              console.log('🆕 New input(s) detected in Shadow DOM');
              shouldCheck = true;
            }
            // Check for new shadow roots
            if (node.shadowRoot) {
              observeShadowRoot(node.shadowRoot);
            }
          }
        });
      }
    }
    if (shouldCheck) {
      setTimeout(attachListeners, 100);
    }
  });

  observer.observe(shadowRoot, {
    childList: true,
    subtree: true
  });
  shadowObservers.set(shadowRoot, observer);
  console.log('👀 Shadow DOM observer attached');
}

// Find and observe all shadow roots
function observeAllShadowRoots(root = document) {
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      observeShadowRoot(el.shadowRoot);
      // Recursively observe nested shadow roots
      observeAllShadowRoots(el.shadowRoot);
    }
  }
}

// Watch for new fields being added (SPAs)
function startObserver() {
  if (observerActive) return;

  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        // Check if any added nodes contain inputs or shadow roots
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            if (node.matches?.('input') || node.querySelector?.('input')) {
              console.log('🆕 New input(s) detected via mutation observer');
              shouldCheck = true;
            }
            // Check for new shadow roots
            if (node.shadowRoot) {
              console.log('🆕 New shadow root detected');
              observeShadowRoot(node.shadowRoot);
              shouldCheck = true;
            }
            // Check children for shadow roots
            const children = node.querySelectorAll?.('*') || [];
            for (const child of children) {
              if (child.shadowRoot) {
                observeShadowRoot(child.shadowRoot);
                shouldCheck = true;
              }
            }
          }
        });
      }
    }
    if (shouldCheck) {
      setTimeout(attachListeners, 100);
    }
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    observerActive = true;
    console.log('👀 Mutation observer started');

    // Also observe any existing shadow roots
    observeAllShadowRoots(document);
  } else {
    // Body not ready, try again
    setTimeout(startObserver, 100);
  }
}

// Initialize
function init() {
  console.log('🔧 Initializing auth code detector...');
  installNavigationObserver();
  attachListeners();
  startObserver();

  // Re-check periodically for dynamic content (SPAs)
  let checkCount = 0;
  const checkInterval = setInterval(() => {
    checkCount++;

    // Also check for new shadow roots periodically
    observeAllShadowRoots(document);

    const allInputs = findAllInputs(document);
    if (allInputs.length > 0 && checkCount <= 5) {
      console.log(`✓ Found ${allInputs.length} inputs (including Shadow DOM) on attempt ${checkCount}`);
    }
    attachListeners();

    // Stop aggressive checking after 30 seconds
    if (checkCount > 30) {
      clearInterval(checkInterval);
      // But keep checking every 5 seconds
      setInterval(() => {
        observeAllShadowRoots(document);
        attachListeners();
      }, 5000);
    }
  }, 1000);
}

// Listen for messages from popup (autofill button or auth changes)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'authChanged') {
    applyAuthState(request.authenticated !== false);
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'fillCode' && request.code) {
    const authFields = findAuthCodeFields();
    if (authFields.length > 0) {
      fillCode(authFields[0], request.code);
      onCodeFilled();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No auth field found' });
    }
    return true;
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !Object.prototype.hasOwnProperty.call(changes, 'authCached')) {
    return;
  }

  applyAuthState(Boolean(changes.authCached.newValue));
});

// Start immediately and also on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Also try when page fully loaded
window.addEventListener('load', () => {
  console.log('📄 Page fully loaded, re-checking...');
  setTimeout(attachListeners, 500);
  setTimeout(attachListeners, 1500);
  setTimeout(attachListeners, 3000);
});
