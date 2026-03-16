// Popup UI logic — manages 3 states: connect, code, idle

const stateConnect = document.getElementById('stateConnect');
const stateCode = document.getElementById('stateCode');
const stateIdle = document.getElementById('stateIdle');
const statusBadge = document.getElementById('statusBadge');
const trustFooter = document.getElementById('trustFooter');
const authButton = document.getElementById('authButton');
const codeDigits = document.getElementById('codeDigits');
const codeSource = document.getElementById('codeSource');
const codeTime = document.getElementById('codeTime');
const codeEmailFrom = document.getElementById('codeEmailFrom');
const codeEmailSnippet = document.getElementById('codeEmailSnippet');
const btnAutofill = document.getElementById('btnAutofill');
const recentList = document.getElementById('recentList');

let currentCode = null;

function showState(name) {
  stateConnect.classList.remove('active');
  stateCode.classList.remove('active');
  stateIdle.classList.remove('active');

  if (name === 'connect') {
    stateConnect.classList.add('active');
    statusBadge.classList.remove('visible');
    trustFooter.style.display = '';
  } else if (name === 'code') {
    stateCode.classList.add('active');
    statusBadge.classList.add('visible');
    trustFooter.style.display = 'none';
  } else {
    stateIdle.classList.add('active');
    statusBadge.classList.add('visible');
    trustFooter.style.display = 'none';
  }
}

function renderCodeDigits(code) {
  codeDigits.innerHTML = code.split('').map(d =>
    `<div class="code-digit">${d}</div>`
  ).join('');
}

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return '1 min ago';
  return `${minutes} min ago`;
}

function renderRecent(history) {
  if (!history || history.length === 0) {
    recentList.innerHTML = '<div class="no-recent">No recent codes</div>';
    return;
  }

  recentList.innerHTML = history.map(item => `
    <div class="recent-item">
      <div class="recent-item-left">
        <span class="recent-item-name">${item.domain || 'Unknown'}</span>
        <span class="recent-item-time">${timeAgo(item.timestamp)}</span>
      </div>
      <div class="recent-item-done">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6L5 9L10 3" stroke="#2DD4A8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Filled
      </div>
    </div>
  `).join('');
}

async function checkStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'checkAuth' });

    if (!response.authenticated) {
      chrome.storage.local.remove('authCached');
      showState('connect');
      return;
    }

    chrome.storage.local.set({ authCached: true });

    // Authenticated — check for active tab codes
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = new URL(tab.url);
      const domain = url.hostname;

      const codes = await chrome.runtime.sendMessage({
        action: 'findCodes',
        domain: domain,
        afterTimestamp: Date.now() - 5 * 60 * 1000
      });

      if (codes && codes.length > 0) {
        const latest = codes[0];
        currentCode = { code: latest.codes[0], tabId: tab.id };

        renderCodeDigits(latest.codes[0]);
        codeSource.textContent = `Code from ${latest.senderDomain || 'Gmail'}`;
        codeTime.textContent = timeAgo(latest.timestamp);
        codeEmailFrom.textContent = latest.senderDomain || '';
        codeEmailSnippet.textContent = latest.subject || '';
        showState('code');
        return;
      }
    }

    // Connected but no active code
    const history = await getRecentHistory();
    renderRecent(history);
    showState('idle');

  } catch (error) {
    console.error('Status check error:', error);
    showState('connect');
  }
}

async function getRecentHistory() {
  try {
    const result = await chrome.storage.local.get('recentFills');
    return result.recentFills || [];
  } catch {
    return [];
  }
}

// Auth button
const authButtonDefaultHTML = authButton.innerHTML;

authButton.addEventListener('click', async () => {
  console.log('🔑 Connect Gmail clicked');
  authButton.disabled = true;
  authButton.innerHTML = 'Connecting…';

  try {
    // This triggers the interactive OAuth consent flow.
    // Note: Chrome may close the popup when the OAuth window opens.
    // If that happens, the next popup open will detect auth via checkStatus().
    console.log('🔑 Sending authenticate message to background...');
    const response = await chrome.runtime.sendMessage({ action: 'authenticate' });
    console.log('🔑 Auth response:', response);
    if (response && response.authenticated) {
      await checkStatus();
    } else {
      console.log('🔑 Auth failed or cancelled');
      authButton.innerHTML = authButtonDefaultHTML;
    }
  } catch (error) {
    console.error('🔑 Auth error:', error);
    authButton.innerHTML = authButtonDefaultHTML;
  } finally {
    authButton.disabled = false;
  }
});

// Copy code button
btnAutofill.addEventListener('click', async () => {
  if (!currentCode) return;

  try {
    await navigator.clipboard.writeText(currentCode.code);
    btnAutofill.textContent = 'Copied!';
    setTimeout(() => { btnAutofill.textContent = 'Copy code'; }, 1500);

    // Save to recent history
    const history = await getRecentHistory();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const domain = tab?.url ? new URL(tab.url).hostname : 'Unknown';

    history.unshift({ domain, code: currentCode.code, timestamp: Date.now() });
    if (history.length > 5) history.pop();
    await chrome.storage.local.set({ recentFills: history });

  } catch (error) {
    console.error('Copy error:', error);
  }
});

// Init — show cached state instantly, then verify with real check
chrome.storage.local.get('authCached', (result) => {
  if (result.authCached) {
    // Show idle immediately while we check for codes
    showState('idle');
  } else {
    showState('connect');
  }
  checkStatus();
});
