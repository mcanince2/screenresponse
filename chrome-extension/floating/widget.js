/**
 * ScreenResponse - Floating Widget Logic
 * This file is loaded by content.js and handles the floating widget functionality
 */

// Widget state management (exported for content.js)
const WidgetManager = {
  isVisible: false,
  isMinimized: false,
  currentText: '',
  currentResponse: '',
  messageAnalysis: null,

  show() {
    const widget = document.getElementById('screenresponse-widget');
    if (widget) {
      widget.classList.add('sr-visible');
      this.isVisible = true;
    }
  },

  hide() {
    const widget = document.getElementById('screenresponse-widget');
    if (widget) {
      widget.classList.remove('sr-visible');
      this.isVisible = false;
    }
  },

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  },

  minimize() {
    const container = document.querySelector('.sr-widget-container');
    if (container) {
      container.classList.toggle('sr-minimized');
      this.isMinimized = container.classList.contains('sr-minimized');
    }
  },

  showState(stateName) {
    const states = ['welcome', 'loading', 'input', 'response', 'error'];
    states.forEach(state => {
      const element = document.getElementById(`sr-${state}-state`);
      if (element) {
        element.classList.toggle('sr-hidden', state !== stateName);
      }
    });
  },

  setLoadingText(text) {
    const loadingText = document.getElementById('sr-loading-text');
    if (loadingText) {
      loadingText.textContent = text;
    }
  },

  setError(message) {
    const errorText = document.getElementById('sr-error-text');
    if (errorText) {
      errorText.textContent = message;
    }
    this.showState('error');
  },

  setPreview(text, analysis) {
    this.currentText = text;
    this.messageAnalysis = analysis;

    const previewText = document.getElementById('sr-preview-text');
    const msgType = document.getElementById('sr-msg-type');
    const msgTone = document.getElementById('sr-msg-tone');

    if (previewText) {
      previewText.textContent = text.length > 200 ? text.substring(0, 200) + '...' : text;
    }
    if (msgType) {
      msgType.textContent = analysis?.type || 'Message';
    }
    if (msgTone) {
      msgTone.textContent = analysis?.tone || 'Professional';
    }

    this.showState('input');
  },

  setResponse(response) {
    this.currentResponse = response;
    const responseText = document.getElementById('sr-response-text');
    if (responseText) {
      responseText.value = response;
    }
    this.showState('response');
  },

  getResponse() {
    const responseText = document.getElementById('sr-response-text');
    return responseText ? responseText.value : '';
  }
};

// Export for use in content.js
if (typeof window !== 'undefined') {
  window.ScreenResponseWidget = WidgetManager;
}
