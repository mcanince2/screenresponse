/**
 * ScreenResponse Chrome Extension - Content Script
 * Handles DOM interaction, text selection, and widget injection
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__screenresponseInjected) return;
  window.__screenresponseInjected = true;

  // State
  let widget = null;
  let isWidgetVisible = false;
  let currentText = '';
  let currentResponse = '';
  let messageAnalysis = null;

  // Platform detection based on URL
  const PLATFORM_DETECTORS = {
    gmail: () => window.location.hostname.includes('mail.google.com'),
    outlook: () => window.location.hostname.includes('outlook'),
    slack: () => window.location.hostname.includes('slack.com'),
    teams: () => window.location.hostname.includes('teams.microsoft.com'),
    linkedin: () => window.location.hostname.includes('linkedin.com'),
    twitter: () => window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com'),
    discord: () => window.location.hostname.includes('discord.com'),
    whatsapp: () => window.location.hostname.includes('web.whatsapp.com')
  };

  // Detect current platform
  function detectPlatform() {
    for (const [platform, detector] of Object.entries(PLATFORM_DETECTORS)) {
      if (detector()) return platform;
    }
    return 'other';
  }

  // Create and inject the floating widget
  function createWidget() {
    if (widget) return widget;

    widget = document.createElement('div');
    widget.id = 'screenresponse-widget';
    widget.innerHTML = `
      <div class="sr-widget-container">
        <div class="sr-drag-handle">
          <div class="sr-drag-dots"><span></span><span></span><span></span></div>
        </div>
        <div class="sr-header">
          <div class="sr-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M8 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="sr-title">ScreenResponse</span>
          <div class="sr-actions">
            <button class="sr-icon-btn" id="sr-minimize-btn" title="Minimize">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <button class="sr-icon-btn" id="sr-close-btn" title="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="sr-content">
          <!-- Welcome State -->
          <div class="sr-state sr-welcome-state" id="sr-welcome-state">
            <p>Select text on the page and click the button below, or use <kbd>⌘/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd></p>
            <button class="sr-btn sr-btn-primary" id="sr-use-selection-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 9h6M9 13h6M9 17h4"/>
              </svg>
              Use Selection
            </button>
          </div>

          <!-- Loading State -->
          <div class="sr-state sr-loading-state sr-hidden" id="sr-loading-state">
            <div class="sr-spinner"></div>
            <p id="sr-loading-text">Processing...</p>
          </div>

          <!-- Input State -->
          <div class="sr-state sr-input-state sr-hidden" id="sr-input-state">
            <div class="sr-badges">
              <span class="sr-badge" id="sr-msg-type">Message</span>
              <span class="sr-badge" id="sr-msg-tone">Professional</span>
            </div>
            <div class="sr-preview" id="sr-preview-text"></div>
            <button class="sr-btn sr-btn-primary sr-btn-full" id="sr-generate-btn">
              Generate Response
            </button>
          </div>

          <!-- Response State -->
          <div class="sr-state sr-response-state sr-hidden" id="sr-response-state">
            <textarea class="sr-response-text" id="sr-response-text" placeholder="Response..."></textarea>
            <div class="sr-quick-actions">
              <button class="sr-chip" data-action="shorter">📝 Shorter</button>
              <button class="sr-chip" data-action="formal">👔 Formal</button>
              <button class="sr-chip" data-action="casual">😊 Casual</button>
            </div>
            <div class="sr-command-row">
              <input type="text" class="sr-command-input" id="sr-command-input" placeholder="Custom instruction...">
              <button class="sr-btn sr-btn-small" id="sr-apply-cmd-btn">Apply</button>
            </div>
            <div class="sr-button-row">
              <button class="sr-btn sr-btn-secondary" id="sr-insert-btn">Insert</button>
              <button class="sr-btn sr-btn-success" id="sr-copy-btn">Copy</button>
            </div>
          </div>

          <!-- Error State -->
          <div class="sr-state sr-error-state sr-hidden" id="sr-error-state">
            <p id="sr-error-text">An error occurred</p>
            <button class="sr-btn sr-btn-secondary" id="sr-retry-btn">Try Again</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(widget);
    setupWidgetEvents();
    makeDraggable(widget.querySelector('.sr-widget-container'), widget.querySelector('.sr-drag-handle'));

    return widget;
  }

  // Make widget draggable
  function makeDraggable(element, handle) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      handle.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      element.style.left = `${initialX + dx}px`;
      element.style.top = `${initialY + dy}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      handle.style.cursor = 'grab';
    });
  }

  // Setup widget event listeners
  function setupWidgetEvents() {
    // Close button
    document.getElementById('sr-close-btn').addEventListener('click', hideWidget);

    // Minimize button
    document.getElementById('sr-minimize-btn').addEventListener('click', minimizeWidget);

    // Use selection button
    document.getElementById('sr-use-selection-btn').addEventListener('click', () => {
      const selection = window.getSelection().toString().trim();
      if (selection) {
        handleTextDetected(selection);
      }
    });

    // Generate button
    document.getElementById('sr-generate-btn').addEventListener('click', generateResponse);

    // Quick action chips
    document.querySelectorAll('.sr-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        applyQuickAction(chip.dataset.action);
      });
    });

    // Command input
    document.getElementById('sr-command-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        applyCommand();
      }
    });
    document.getElementById('sr-apply-cmd-btn').addEventListener('click', applyCommand);

    // Copy button
    document.getElementById('sr-copy-btn').addEventListener('click', copyResponse);

    // Insert button
    document.getElementById('sr-insert-btn').addEventListener('click', insertResponse);

    // Retry button
    document.getElementById('sr-retry-btn').addEventListener('click', () => showState('welcome'));
  }

  // State management
  function showState(stateName) {
    const states = ['welcome', 'loading', 'input', 'response', 'error'];
    states.forEach(state => {
      const element = document.getElementById(`sr-${state}-state`);
      if (element) {
        element.classList.toggle('sr-hidden', state !== stateName);
      }
    });
  }

  // Show widget
  function showWidget() {
    createWidget();
    widget.classList.add('sr-visible');
    isWidgetVisible = true;
  }

  // Hide widget
  function hideWidget() {
    if (widget) {
      widget.classList.remove('sr-visible');
      isWidgetVisible = false;
    }
  }

  // Minimize widget
  function minimizeWidget() {
    if (widget) {
      widget.querySelector('.sr-widget-container').classList.toggle('sr-minimized');
    }
  }

  // Handle detected text
  async function handleTextDetected(text) {
    currentText = text;
    showWidget();
    showState('loading');
    document.getElementById('sr-loading-text').textContent = 'Analyzing...';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'detectMessage',
        text: text
      });

      messageAnalysis = response;

      document.getElementById('sr-msg-type').textContent = response.type || 'Message';
      document.getElementById('sr-msg-tone').textContent = response.tone || 'Professional';
      document.getElementById('sr-preview-text').textContent = truncateText(text, 200);

      showState('input');
    } catch (error) {
      showError('Failed to analyze message');
    }
  }

  // Generate response
  async function generateResponse() {
    if (!currentText) {
      showError('No text to generate response for');
      return;
    }

    showState('loading');
    document.getElementById('sr-loading-text').textContent = 'Generating...';

    try {
      const platform = detectPlatform();
      const context = {
        messageType: messageAnalysis?.type || platform,
        tone: messageAnalysis?.tone || 'professional',
        language: messageAnalysis?.language || 'auto'
      };

      const response = await chrome.runtime.sendMessage({
        action: 'generateAIResponse',
        text: currentText,
        context: context
      });

      if (response.success) {
        currentResponse = response.response;
        document.getElementById('sr-response-text').value = response.response;
        showState('response');
      } else {
        showError(response.error || 'Failed to generate response');
      }
    } catch (error) {
      showError(error.message || 'An error occurred');
    }
  }

  // Apply quick action
  async function applyQuickAction(action) {
    const instructions = {
      shorter: 'Make this shorter while keeping the key points',
      formal: 'Make this more formal and professional',
      casual: 'Make this more casual and friendly'
    };

    const instruction = instructions[action];
    if (instruction) {
      await modifyResponse(instruction);
    }
  }

  // Apply custom command
  async function applyCommand() {
    const command = document.getElementById('sr-command-input').value.trim();
    if (!command) return;

    await modifyResponse(command);
    document.getElementById('sr-command-input').value = '';
  }

  // Modify response
  async function modifyResponse(instruction) {
    const currentText = document.getElementById('sr-response-text').value;
    if (!currentText) return;

    showState('loading');
    document.getElementById('sr-loading-text').textContent = 'Modifying...';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'modifyAIResponse',
        response: currentText,
        instruction: instruction
      });

      if (response.success) {
        currentResponse = response.response;
        document.getElementById('sr-response-text').value = response.response;
        showState('response');
      } else {
        showError(response.error || 'Failed to modify response');
      }
    } catch (error) {
      showError(error.message || 'An error occurred');
    }
  }

  // Copy response
  function copyResponse() {
    const text = document.getElementById('sr-response-text').value;
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied!');
    }).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('Copied!');
    });
  }

  // Insert response into active element
  function insertResponse() {
    const text = document.getElementById('sr-response-text').value;
    if (!text) return;

    const activeElement = document.activeElement;

    // Try to find the most appropriate input element
    let target = findTextInputElement();

    if (target) {
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        target.value = text;
        target.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (target.contentEditable === 'true' || target.getAttribute('role') === 'textbox') {
        target.innerHTML = text.replace(/\n/g, '<br>');
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
      showToast('Inserted!');
    } else {
      // Fallback to clipboard
      copyResponse();
    }
  }

  // Find text input element on the page
  function findTextInputElement() {
    // Platform-specific selectors
    const selectors = {
      gmail: '[role="textbox"][aria-label*="Message"]',
      outlook: '[role="textbox"]',
      slack: '[data-qa="message_input"]',
      linkedin: '.msg-form__contenteditable',
      twitter: '[data-testid="tweetTextarea_0"]',
      default: 'textarea:focus, [contenteditable="true"]:focus, input[type="text"]:focus'
    };

    const platform = detectPlatform();
    const selector = selectors[platform] || selectors.default;

    return document.querySelector(selector) || document.activeElement;
  }

  // Show error
  function showError(message) {
    document.getElementById('sr-error-text').textContent = message;
    showState('error');
  }

  // Show toast notification
  function showToast(message) {
    const existing = document.querySelector('.sr-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'sr-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2500);
  }

  // Truncate text
  function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'generateResponse') {
      handleTextDetected(request.text);
      sendResponse({ success: true });
    }

    if (request.action === 'getSelectedText') {
      const selection = window.getSelection().toString().trim();
      if (selection) {
        handleTextDetected(selection);
      } else {
        showWidget();
        showState('welcome');
      }
      sendResponse({ success: true });
    }

    return true;
  });

  // Listen for text selection
  document.addEventListener('mouseup', (e) => {
    // Don't trigger if clicking within the widget
    if (widget && widget.contains(e.target)) return;

    const selection = window.getSelection().toString().trim();
    if (selection && selection.length > 20) {
      // Show a small floating button near the selection
      showSelectionButton(e.clientX, e.clientY, selection);
    }
  });

  // Selection button
  let selectionButton = null;

  function showSelectionButton(x, y, text) {
    hideSelectionButton();

    selectionButton = document.createElement('div');
    selectionButton.className = 'sr-selection-btn';
    selectionButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 12l2 2 4-4"/>
      </svg>
    `;
    selectionButton.title = 'Generate AI Response';
    selectionButton.style.left = `${x + 10}px`;
    selectionButton.style.top = `${y - 30}px`;

    selectionButton.addEventListener('click', () => {
      handleTextDetected(text);
      hideSelectionButton();
    });

    document.body.appendChild(selectionButton);

    // Auto-hide after 5 seconds
    setTimeout(hideSelectionButton, 5000);
  }

  function hideSelectionButton() {
    if (selectionButton) {
      selectionButton.remove();
      selectionButton = null;
    }
  }

  // Hide selection button when clicking elsewhere
  document.addEventListener('mousedown', (e) => {
    if (selectionButton && !selectionButton.contains(e.target)) {
      hideSelectionButton();
    }
  });

  // Keyboard shortcut (Escape to close)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isWidgetVisible) {
      hideWidget();
    }
  });

  console.log('ScreenResponse content script loaded');
})();
