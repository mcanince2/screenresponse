/**
 * ScreenResponse Chrome Extension - Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  await loadSettings();

  // Setup event listeners
  setupEventListeners();
});

async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get({
      apiKey: '',
      language: 'auto'
    });

    document.getElementById('apiKey').value = settings.apiKey;
    document.getElementById('language').value = settings.language;
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

function setupEventListeners() {
  // Generate from selection
  document.getElementById('generateFromSelection').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
      window.close();
    }
  });

  // Open widget
  document.getElementById('openWidget').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
      window.close();
    }
  });

  // Toggle API key visibility
  document.getElementById('toggleApiKey').addEventListener('click', () => {
    const input = document.getElementById('apiKey');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Save settings
  document.getElementById('saveSettings').addEventListener('click', saveSettings);

  // Enter key on API key input
  document.getElementById('apiKey').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveSettings();
    }
  });
}

async function saveSettings() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const language = document.getElementById('language').value;

  try {
    await chrome.storage.sync.set({
      apiKey,
      language
    });

    showToast('Settings saved!');
    updateStatus('Ready');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showToast('Failed to save');
  }
}

function showToast(message) {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2000);
}

function updateStatus(text) {
  document.getElementById('status').textContent = text;
}
