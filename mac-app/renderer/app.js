/**
 * ScreenResponse — Renderer
 */

class ScreenResponseApp {
  constructor() {
    this.currentText = '';
    this.currentResponse = '';
    this.messageAnalysis = null;
    this.selectedResponseType = 'auto';
    this.currentState = 'welcome';
    this.settings = {
      apiKey: '',
      theme: 'dark',
      language: 'auto',
      model: 'gpt-4',
      autoClipboard: false
    };

    this.states = {
      welcome: document.getElementById('welcomeState'),
      loading: document.getElementById('loadingState'),
      input: document.getElementById('inputState'),
      response: document.getElementById('responseState'),
      settings: document.getElementById('settingsState'),
      error: document.getElementById('errorState'),
      history: document.getElementById('historyState'),
      shortcuts: document.getElementById('shortcutsState'),
      clipboard: document.getElementById('clipboardState'),
      video: document.getElementById('videoState')
    };

    this.elements = {
      loadingText: document.getElementById('loadingText'),
      detectedText: document.getElementById('detectedText'),
      messageType: document.getElementById('messageType'),
      messageTone: document.getElementById('messageTone'),
      messageLanguage: document.getElementById('messageLanguage'),
      responseText: document.getElementById('responseText'),
      instructionInput: document.getElementById('instructionInput'),
      commandInput: document.getElementById('commandInput'),
      errorText: document.getElementById('errorText'),
      apiKeyInput: document.getElementById('apiKeyInput'),
      modelSelect: document.getElementById('modelSelect'),
      themeSelect: document.getElementById('themeSelect'),
      languageSelect: document.getElementById('languageSelect'),
      autoClipboardToggle: document.getElementById('autoClipboardToggle'),
      historyList: document.getElementById('historyList'),
      clipboardList: document.getElementById('clipboardList'),
      previewResizeHandle: document.getElementById('previewResizeHandle')
    };

    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.setupIPCListeners();
    this.setupKeyboardShortcuts();
    this.setupResize();
    this.applyTheme(this.settings.theme);
  }

  async loadSettings() {
    try {
      this.settings = await window.electronAPI.getSettings();
      this.elements.apiKeyInput.value = this.settings.apiKey;
      this.elements.modelSelect.value = this.settings.model || 'gpt-4';
      this.elements.themeSelect.value = this.settings.theme;
      this.elements.languageSelect.value = this.settings.language;
      this.elements.autoClipboardToggle.checked = this.settings.autoClipboard || false;
    } catch (e) {
      console.error('Settings load failed:', e);
    }
  }

  setupResize() {
    const handle = this.elements.previewResizeHandle;
    const preview = this.elements.detectedText;
    if (!handle || !preview) return;

    let startY = 0;
    let startH = 0;

    const onMouseMove = (e) => {
      const delta = e.clientY - startY;
      const newH = Math.max(60, Math.min(300, startH + delta));
      preview.style.height = newH + 'px';
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startY = e.clientY;
      startH = preview.offsetHeight;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  setupEventListeners() {
    // Header
    document.getElementById('shortcutsBtn').addEventListener('click', () => this.showState('shortcuts'));
    document.getElementById('historyBtn').addEventListener('click', () => this.showHistory());
    document.getElementById('clipboardBtn').addEventListener('click', () => this.showClipboard());
    document.getElementById('settingsBtn').addEventListener('click', () => this.showState('settings'));
    document.getElementById('closeBtn').addEventListener('click', () => window.electronAPI.hideWidget());

    // Welcome
    document.getElementById('captureBtn').addEventListener('click', () => window.electronAPI.captureScreen());
    document.getElementById('captureAreaBtn').addEventListener('click', () => window.electronAPI.captureArea());

    // Input
    document.getElementById('generateBtn').addEventListener('click', () => this.generateResponse());

    // Response types
    document.querySelectorAll('.type-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedResponseType = chip.dataset.type;
      });
    });

    // Response
    document.getElementById('regenerateBtn').addEventListener('click', () => this.generateResponse());
    document.getElementById('copyBtn').addEventListener('click', () => this.copyResponse());
    document.getElementById('copyIconBtn').addEventListener('click', () => this.copyResponse());
    document.getElementById('applyCommandBtn').addEventListener('click', () => this.applyCommand());

    // Quick actions
    document.querySelectorAll('.action-chip').forEach(chip => {
      chip.addEventListener('click', () => this.applyQuickAction(chip.dataset.action));
    });

    // Command enter
    this.elements.commandInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.applyCommand();
    });

    // Panels back buttons
    document.getElementById('shortcutsBackBtn').addEventListener('click', () => this.showState('welcome'));
    document.getElementById('historyBackBtn').addEventListener('click', () => this.showState('welcome'));
    document.getElementById('clipboardBackBtn').addEventListener('click', () => this.showState('welcome'));
    document.getElementById('cancelSettingsBtn').addEventListener('click', () => this.showState('welcome'));

    // Settings
    document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());

    // Video
    document.getElementById('videoBtn').addEventListener('click', () => this.showVideoState());
    document.getElementById('videoBackBtn').addEventListener('click', () => this.showState('welcome'));
    document.getElementById('generateVideoBtn').addEventListener('click', () => this.generateVideo());
    document.getElementById('saveVideoBtn').addEventListener('click', () => this.saveVideo());
    document.getElementById('newVideoBtn').addEventListener('click', () => this.resetVideoUI());

    // Error
    document.getElementById('retryBtn').addEventListener('click', () => this.showState('welcome'));

    // Theme
    this.elements.themeSelect.addEventListener('change', (e) => this.applyTheme(e.target.value));
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.currentState === 'input') {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          this.generateResponse();
        }
      }
    });
  }

  setupIPCListeners() {
    window.electronAPI.onTextDetected((text) => this.handleTextDetected(text));
    window.electronAPI.onTextDetectedAuto((text) => this.handleTextDetectedAuto(text));
    window.electronAPI.onCaptureStart(() => {
      this.showState('loading');
      this.elements.loadingText.textContent = 'Capturing...';
    });
    window.electronAPI.onCaptureError((error) => this.showError(error));
    window.electronAPI.onClipboardChange((text) => this.handleTextDetected(text));
    window.electronAPI.onShowSettings(() => this.showState('settings'));
    window.electronAPI.onQuickResponse((response) => {
      this.currentResponse = response;
      this.elements.responseText.value = response;
      this.showState('response');
    });
    window.electronAPI.onCopyCurrent(() => this.copyResponse());
    window.electronAPI.onToast((message) => this.showToast(message));
  }

  showState(name) {
    this.currentState = name;
    Object.values(this.states).forEach(s => s.classList.add('hidden'));
    if (this.states[name]) this.states[name].classList.remove('hidden');
  }

  async handleTextDetected(text) {
    this.currentText = text;
    this.showState('loading');
    this.elements.loadingText.textContent = 'Analyzing...';

    try {
      this.messageAnalysis = await window.electronAPI.detectMessage(text);
      this.elements.detectedText.textContent = text.length > 2000 ? text.substring(0, 2000) + '...' : text;
      this.elements.messageType.textContent = this.messageAnalysis.type || 'Message';
      this.elements.messageTone.textContent = this.messageAnalysis.tone || 'Professional';
      this.elements.messageLanguage.textContent = (this.messageAnalysis.language || 'EN').toUpperCase();

      this.selectedResponseType = 'auto';
      document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('active'));
      document.querySelector('.type-chip[data-type="auto"]').classList.add('active');
      if (this.elements.instructionInput) this.elements.instructionInput.value = '';

      // Reset preview height
      this.elements.detectedText.style.height = '100px';

      this.showState('input');
    } catch (e) {
      this.showError('Analysis failed');
    }
  }

  async handleTextDetectedAuto(text) {
    this.currentText = text;
    this.showState('loading');
    this.elements.loadingText.textContent = 'Analyzing...';

    try {
      this.messageAnalysis = await window.electronAPI.detectMessage(text);
      this.selectedResponseType = 'auto';
      this.elements.loadingText.textContent = 'Generating...';
      await this._doGenerate();
    } catch (e) {
      this.showError('Failed');
    }
  }

  async generateResponse() {
    if (!this.currentText) {
      this.showError('No text to process');
      return;
    }
    this.showState('loading');
    this.elements.loadingText.textContent = 'Generating...';
    await this._doGenerate();
  }

  async _doGenerate() {
    try {
      const detectedLang = this.messageAnalysis?.language || 'en';
      const context = {
        messageType: this.messageAnalysis?.type || 'message',
        tone: this.messageAnalysis?.tone || 'professional',
        language: this.settings.language === 'auto' ? detectedLang : this.settings.language
      };

      const parts = [];
      if (this.selectedResponseType !== 'auto') {
        const typeMap = {
          accept: 'Write a positive, accepting response',
          decline: 'Write a polite, declining response',
          question: 'Write a response asking for more information',
          thankYou: 'Write a thankful response',
          followUp: 'Write a follow-up response',
          acknowledge: 'Write a brief acknowledgment'
        };
        if (typeMap[this.selectedResponseType]) parts.push(typeMap[this.selectedResponseType]);
      }

      const userInstruction = this.elements.instructionInput?.value?.trim();
      if (userInstruction) parts.push(userInstruction);
      if (parts.length > 0) context.customInstructions = parts.join('. ');

      const result = await window.electronAPI.generateResponse(this.currentText, context);

      if (result.success) {
        this.currentResponse = result.response;
        this.elements.responseText.value = result.response;
        await window.electronAPI.saveResponse({ input: this.currentText, output: result.response });
        this.showState('response');
      } else {
        this.showError(result.error || 'Generation failed');
      }
    } catch (e) {
      this.showError(e.message || 'Error');
    }
  }

  async applyQuickAction(action) {
    const map = {
      shorter: 'Make this shorter, keep key points',
      longer: 'Make this more detailed',
      formal: 'Make this more formal and professional',
      casual: 'Make this more casual and relaxed',
      friendly: 'Make this warmer and friendlier',
      assertive: 'Make this more assertive and direct',
      polite: 'Make this more polite and courteous',
      simplify: 'Simplify the language'
    };
    if (map[action]) await this.modifyResponse(map[action]);
  }

  async applyCommand() {
    const cmd = this.elements.commandInput.value.trim();
    if (!cmd) return;
    await this.modifyResponse(cmd);
    this.elements.commandInput.value = '';
  }

  async modifyResponse(instruction) {
    const text = this.elements.responseText.value;
    if (!text) return;

    this.showState('loading');
    this.elements.loadingText.textContent = 'Modifying...';

    try {
      const result = await window.electronAPI.modifyResponse(text, instruction);
      if (result.success) {
        this.currentResponse = result.response;
        this.elements.responseText.value = result.response;
        await window.electronAPI.saveResponse({ input: this.currentText, output: result.response });
        this.showState('response');
      } else {
        this.showError(result.error || 'Modification failed');
      }
    } catch (e) {
      this.showError(e.message || 'Error');
    }
  }

  async copyResponse() {
    const text = this.elements.responseText.value;
    if (!text) return;
    try {
      await window.electronAPI.copyToClipboard(text);
      this.showToast('Copied');
    } catch (e) {
      this.showError('Copy failed');
    }
  }

  async showHistory() {
    try {
      const history = await window.electronAPI.getResponseHistory();
      const el = this.elements.historyList;

      if (!history || history.length === 0) {
        el.innerHTML = '<p class="empty-state-text">No responses yet</p>';
      } else {
        el.innerHTML = history.map((item, i) => {
          const time = new Date(item.timestamp).toLocaleTimeString();
          const date = new Date(item.timestamp).toLocaleDateString();
          const inputPreview = (item.input || '').substring(0, 40);
          const outputPreview = (item.output || item.text || '').substring(0, 60);
          return `<div class="history-item" data-index="${i}">
            <div class="history-time">${date} ${time}</div>
            <div class="history-input">${this.escapeHtml(inputPreview)}${inputPreview.length >= 40 ? '...' : ''}</div>
            <div class="history-preview">${this.escapeHtml(outputPreview)}${outputPreview.length >= 60 ? '...' : ''}</div>
          </div>`;
        }).join('');

        el.querySelectorAll('.history-item').forEach(item => {
          item.addEventListener('click', async () => {
            const h = await window.electronAPI.getResponseHistory();
            const idx = parseInt(item.dataset.index);
            if (h[idx]) {
              await window.electronAPI.copyToClipboard(h[idx].output || h[idx].text || '');
              this.showToast('Copied');
            }
          });
        });
      }
      this.showState('history');
    } catch (e) {
      this.showError('Failed to load history');
    }
  }

  async showClipboard() {
    try {
      const items = await window.electronAPI.getClipboardHistory();
      const el = this.elements.clipboardList;

      if (!items || items.length === 0) {
        el.innerHTML = '<p class="empty-state-text">No clipboard items yet</p>';
      } else {
        el.innerHTML = items.map((item, i) => {
          const preview = item.text.substring(0, 120);
          return `<div class="clipboard-item" data-index="${i}">
            <span class="clipboard-item-index">${i + 1}</span>
            <span class="clipboard-item-text">${this.escapeHtml(preview)}${item.text.length > 120 ? '...' : ''}</span>
          </div>`;
        }).join('');

        el.querySelectorAll('.clipboard-item').forEach(item => {
          item.addEventListener('click', async () => {
            const all = await window.electronAPI.getClipboardHistory();
            const idx = parseInt(item.dataset.index);
            if (all[idx]) {
              // Use as detected text input
              this.handleTextDetected(all[idx].text);
            }
          });
        });
      }
      this.showState('clipboard');
    } catch (e) {
      this.showError('Failed to load clipboard');
    }
  }

  async saveSettings() {
    const s = {
      apiKey: this.elements.apiKeyInput.value,
      model: this.elements.modelSelect.value,
      theme: this.elements.themeSelect.value,
      language: this.elements.languageSelect.value,
      autoClipboard: this.elements.autoClipboardToggle.checked
    };

    try {
      await window.electronAPI.saveSettings(s);
      this.settings = s;
      this.applyTheme(s.theme);
      this.showState('welcome');
      this.showToast('Saved');
    } catch (e) {
      this.showError('Save failed');
    }
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  showError(msg) {
    this.elements.errorText.textContent = msg;
    this.showState('error');
  }

  showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  // --- Video Generation ---

  async showVideoState() {
    this.showState('video');
    this.checkVideoHealth();
  }

  async checkVideoHealth() {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    dot.className = 'status-dot connecting';
    text.textContent = 'Checking GPU...';

    try {
      const health = await window.electronAPI.checkVideoHealth();
      dot.className = `status-dot ${health.status}`;
      text.textContent = health.message;

      if (health.status === 'connecting' || health.status === 'offline') {
        // Retry after 10s
        setTimeout(() => {
          if (this.currentState === 'video') this.checkVideoHealth();
        }, 10000);
      }
    } catch (e) {
      dot.className = 'status-dot offline';
      text.textContent = 'Connection failed';
    }
  }

  async generateVideo() {
    const prompt = document.getElementById('videoPrompt').value.trim();
    if (!prompt) {
      this.showToast('Enter a prompt');
      return;
    }

    const resolution = document.getElementById('videoResolution').value.split('x');
    const numFrames = parseInt(document.getElementById('videoFrames').value);
    const seed = parseInt(document.getElementById('videoSeed').value) || 42;

    // Show loading
    document.getElementById('generateVideoBtn').classList.add('hidden');
    const loading = document.getElementById('videoLoading');
    loading.classList.remove('hidden');
    document.getElementById('videoResult').classList.add('hidden');
    document.getElementById('videoLoadingText').textContent = 'Generating video...';

    try {
      const result = await window.electronAPI.generateVideo({
        prompt,
        height: parseInt(resolution[0]),
        width: parseInt(resolution[1]),
        num_frames: numFrames,
        seed
      });

      loading.classList.add('hidden');
      document.getElementById('generateVideoBtn').classList.remove('hidden');

      if (result.status === 'success' && result.video_base64) {
        this.currentVideoBase64 = result.video_base64;
        const blob = this.base64ToBlob(result.video_base64, 'video/mp4');
        const url = URL.createObjectURL(blob);
        const video = document.getElementById('videoPlayer');
        video.src = url;
        document.getElementById('videoResult').classList.remove('hidden');
        this.showToast('Video ready!');
      } else {
        this.showToast(result.error || 'Generation failed');
      }
    } catch (e) {
      loading.classList.add('hidden');
      document.getElementById('generateVideoBtn').classList.remove('hidden');
      this.showToast(e.message || 'Error');
    }
  }

  async saveVideo() {
    if (!this.currentVideoBase64) return;
    try {
      const result = await window.electronAPI.saveVideoFile(this.currentVideoBase64);
      if (result.success) {
        this.showToast('Video saved!');
      }
    } catch (e) {
      this.showToast('Save failed');
    }
  }

  resetVideoUI() {
    document.getElementById('videoResult').classList.add('hidden');
    document.getElementById('videoLoading').classList.add('hidden');
    document.getElementById('generateVideoBtn').classList.remove('hidden');
    document.getElementById('videoPrompt').value = '';
    this.currentVideoBase64 = null;
  }

  base64ToBlob(base64, mime) {
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new ScreenResponseApp();
});
