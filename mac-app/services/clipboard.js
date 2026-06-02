const { clipboard } = require('electron');

class ClipboardService {
  constructor() {
    this.lastContent = '';
    this.intervalId = null;
    this.checkInterval = 1000;
    this.history = []; // last 10 clipboard items
  }

  startMonitoring(callback) {
    if (this.intervalId) {
      this.stopMonitoring();
    }

    this.lastContent = clipboard.readText();

    this.intervalId = setInterval(() => {
      const currentContent = clipboard.readText();

      if (currentContent && currentContent !== this.lastContent) {
        this.lastContent = currentContent;

        // Always track in clipboard history
        this.addToHistory(currentContent);

        if (this.isLikelyMessage(currentContent)) {
          callback(currentContent);
        }
      }
    }, this.checkInterval);
  }

  addToHistory(text) {
    // Don't add duplicates at the top
    if (this.history.length > 0 && this.history[0].text === text) return;

    this.history.unshift({
      text,
      timestamp: Date.now()
    });

    if (this.history.length > 10) {
      this.history = this.history.slice(0, 10);
    }
  }

  getHistory() {
    return this.history;
  }

  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isLikelyMessage(text) {
    if (!text || text.length < 10) return false;
    if (text.length > 10000) return false;

    const codeIndicators = [
      /^(import|export|const|let|var|function|class|def|public|private)\s/m,
      /[{};]\s*$/m,
      /^\s*(if|for|while|switch)\s*\(/m,
      /<\/?[a-z]+[^>]*>/i,
      /^\s*[#\/\/\*]/m
    ];

    for (const pattern of codeIndicators) {
      if (pattern.test(text)) {
        const messageIndicators = [
          /^(hi|hello|hey|dear|merhaba|selam)/im,
          /(thanks|thank you|regards|best|teşekkür)/im,
          /\?$/,
          /@\w+/
        ];

        const hasMessageIndicator = messageIndicators.some(p => p.test(text));
        if (!hasMessageIndicator) return false;
      }
    }

    return true;
  }

  getCurrentContent() {
    return clipboard.readText();
  }

  write(text) {
    clipboard.writeText(text);
    this.lastContent = text;
  }
}

module.exports = ClipboardService;
