// Popup UI logic

const statusEl = document.getElementById('status');
const statusText = document.getElementById('statusText');
const authButton = document.getElementById('authButton');

async function checkAuthStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'checkAuth' });

    if (response.authenticated) {
      statusEl.className = 'status connected';
      statusText.textContent = 'Connected to Gmail';
      authButton.textContent = 'Reconnect Gmail';
    } else {
      statusEl.className = 'status disconnected';
      statusText.textContent = 'Not connected';
      authButton.textContent = 'Connect Gmail';
    }
  } catch (error) {
    statusEl.className = 'status disconnected';
    statusText.textContent = 'Error checking status';
    console.error('Error:', error);
  }
}

authButton.addEventListener('click', async () => {
  authButton.disabled = true;
  authButton.textContent = 'Connecting...';

  try {
    await chrome.runtime.sendMessage({ action: 'checkAuth' });
    await checkAuthStatus();
  } catch (error) {
    alert('Failed to connect. Please try again.');
    console.error('Error:', error);
  } finally {
    authButton.disabled = false;
  }
});

// Check status on load
checkAuthStatus();
