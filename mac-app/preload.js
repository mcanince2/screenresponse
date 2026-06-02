const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  generateResponse: (text, context) => ipcRenderer.invoke('generate-response', { text, context }),
  modifyResponse: (response, instruction) => ipcRenderer.invoke('modify-response', { response, instruction }),
  detectMessage: (text) => ipcRenderer.invoke('detect-message', text),

  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  captureArea: () => ipcRenderer.invoke('capture-area'),

  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),

  saveResponse: (response) => ipcRenderer.invoke('save-response', response),
  getResponseHistory: () => ipcRenderer.invoke('get-response-history'),
  getClipboardHistory: () => ipcRenderer.invoke('get-clipboard-history'),

  // Video generation
  generateVideo: (params) => ipcRenderer.invoke('generate-video', params),
  checkVideoHealth: () => ipcRenderer.invoke('check-video-health'),
  getVideoSettings: () => ipcRenderer.invoke('get-video-settings'),
  saveVideoFile: (base64Data) => ipcRenderer.invoke('save-video-file', base64Data),

  hideWidget: () => ipcRenderer.invoke('hide-widget'),
  startDrag: () => ipcRenderer.invoke('start-drag'),

  onTextDetected: (cb) => ipcRenderer.on('text-detected', (e, text) => cb(text)),
  onTextDetectedAuto: (cb) => ipcRenderer.on('text-detected-auto', (e, text) => cb(text)),
  onCaptureStart: (cb) => ipcRenderer.on('capture-start', () => cb()),
  onCaptureError: (cb) => ipcRenderer.on('capture-error', (e, error) => cb(error)),
  onClipboardChange: (cb) => ipcRenderer.on('clipboard-change', (e, text) => cb(text)),
  onShowSettings: (cb) => ipcRenderer.on('show-settings', () => cb()),
  onQuickResponse: (cb) => ipcRenderer.on('quick-response', (e, response) => cb(response)),
  onCopyCurrent: (cb) => ipcRenderer.on('copy-current', () => cb()),
  onToast: (cb) => ipcRenderer.on('toast', (e, message) => cb(message)),

  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
