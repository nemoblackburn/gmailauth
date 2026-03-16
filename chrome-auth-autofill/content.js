// Content script for detecting auth code fields and auto-filling

console.log('🚀 Gmail Auth AutoFill extension loaded');
console.log('   Domain:', window.location.hostname);

let currentDomain = window.location.hostname;
let pageLoadTime = Date.now(); // Track when page loaded
let observerActive = false;
let shadowObservers = new Map(); // Track observers for shadow roots

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

// Create and show autofill suggestion UI
function showAutofillSuggestion(field, codeData) {
  // Remove any existing suggestions
  removeAutofillSuggestion();

  const suggestion = document.createElement('div');
  suggestion.id = 'gmail-auth-autofill-suggestion';
  suggestion.className = 'gmail-auth-autofill-suggestion';

  const rect = field.getBoundingClientRect();
  suggestion.style.top = `${rect.bottom + window.scrollY + 4}px`;
  suggestion.style.left = `${rect.left + window.scrollX}px`;
  suggestion.style.width = `${Math.max(rect.width, 200)}px`;

  // Create suggestion content
  const mostRecentCode = codeData[0];
  const codes = mostRecentCode.codes;

  suggestion.innerHTML = `
    <div class="auth-suggestion-header">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        <polyline points="22,6 12,13 2,6"></polyline>
      </svg>
      <span>From Gmail</span>
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
      removeAutofillSuggestion();
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
  const existing = document.getElementById('gmail-auth-autofill-suggestion');
  if (existing) {
    existing.remove();
  }
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

// Check for codes when field is focused
async function onFieldFocus(field) {
  console.log('🎯 Auth field focused, checking for codes...');
  console.log('   Current domain:', currentDomain);

  // Check if extension context is still valid
  if (!chrome.runtime || !chrome.runtime.sendMessage) {
    console.warn('⚠️ Extension context invalidated. Please refresh the page.');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'findCodes',
      domain: currentDomain,
      afterTimestamp: pageLoadTime
    });

    console.log('📬 Response from background:', response);

    if (response && response.length > 0) {
      console.log('✅ Showing autofill suggestion');
      showAutofillSuggestion(field, response);
    } else {
      console.log('❌ No codes found for this domain');
    }
  } catch (error) {
    // Handle extension context invalidation error specifically
    if (error.message?.includes('Extension context invalidated')) {
      console.warn('⚠️ Extension was reloaded. Please refresh the page.');
    } else {
      console.error('❌ Error fetching codes:', error);
    }
  }
}

let pollingInterval = null;

// Attach focus listeners to auth fields AND auto-check for codes
function attachListeners() {
  const authFields = findAuthCodeFields();

  if (authFields.length > 0) {
    console.log(`🔍 Found ${authFields.length} auth code field(s)`);

    // Start polling for codes when OTP fields are detected
    const firstField = authFields[0];
    if (!pollingInterval) {
      console.log('🚀 Starting code polling (every 3s)...');
      // Check immediately
      onFieldFocus(firstField);
      // Then poll every 3 seconds
      pollingInterval = setInterval(() => {
        // Only poll if popup not already shown
        if (!document.getElementById('gmail-auth-autofill-suggestion')) {
          onFieldFocus(firstField);
        }
      }, 3000);
    }
  }

  authFields.forEach(field => {
    if (!field.dataset.authAutofillAttached) {
      field.dataset.authAutofillAttached = 'true';
      field.addEventListener('focus', () => onFieldFocus(field));
    }
  });
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
