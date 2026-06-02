const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, clipboard, screen, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();
let mainWindow = null;
let tray = null;
let isWidgetVisible = false;

// Services
const ScreenshotService = require('./services/screenshot');
const ClipboardService = require('./services/clipboard');
const OpenAIService = require('./services/openai');
const DetectorService = require('./services/detector');
const VideoService = require('./services/video');

const screenshotService = new ScreenshotService();
const clipboardService = new ClipboardService();
// Optional fallback key from the environment. Leave empty to require users to enter
// their own OpenAI API key in Settings (recommended). See .env.example.
const EMBEDDED_API_KEY = process.env.OPENAI_API_KEY || '';
const openaiService = new OpenAIService(store.get('apiKey', '') || EMBEDDED_API_KEY, store.get('model', 'gpt-4'));
const detectorService = new DetectorService();
const videoService = new VideoService(store);

// Persistent history from electron-store (input + output, up to 50)
let responseHistory = store.get('responseHistory', []);

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 400,
    height: 580,
    x: width - 420,
    y: Math.floor(height / 2) - 290,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.hide();
  isWidgetVisible = false;

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  let trayIcon;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty();
    }
  } catch (e) {
    trayIcon = nativeImage.createEmpty();
  }

  let finalIcon;
  if (trayIcon.isEmpty()) {
    finalIcon = createDefaultIcon();
  } else {
    finalIcon = trayIcon.resize({ width: 18, height: 18 });
    finalIcon.setTemplateImage(true);
  }
  tray = new Tray(finalIcon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show/Hide Widget          \u2318\u21E7S', click: () => toggleWidget() },
    { type: 'separator' },
    { label: 'Full Screen Capture       \u2318\u21E7R', click: () => captureAndProcess() },
    { label: 'Area Select Capture       \u2318\u21E7A', click: () => captureAreaAndProcess() },
    { label: 'Process Clipboard         \u2318\u21E7V', click: () => processClipboard() },
    { label: 'Quick Generate            \u2318\u21E7G', click: () => quickGenerate() },
    { label: 'Copy Last Response        \u2318\u21E7P', click: () => pasteLastResponse() },
    { type: 'separator' },
    { label: 'Settings', click: () => { if (mainWindow) { mainWindow.webContents.send('show-settings'); showWidget(); } } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('ScreenResponse');
  tray.on('click', () => toggleWidget());
}

function createDefaultIcon() {
  // 22x22 template icon: monitor with chat bubble — minimal, monochrome
  const size = 22;
  const canvas = Buffer.alloc(size * size * 4); // RGBA

  function setPixel(x, y, alpha) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    canvas[idx] = 0;       // R (black for template)
    canvas[idx + 1] = 0;   // G
    canvas[idx + 2] = 0;   // B
    canvas[idx + 3] = alpha;
  }

  function drawRect(x1, y1, x2, y2, alpha) {
    for (let x = x1; x <= x2; x++) {
      setPixel(x, y1, alpha);
      setPixel(x, y2, alpha);
    }
    for (let y = y1; y <= y2; y++) {
      setPixel(x1, y, alpha);
      setPixel(x2, y, alpha);
    }
  }

  function fillRect(x1, y1, x2, y2, alpha) {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        setPixel(x, y, alpha);
      }
    }
  }

  function drawLine(x1, y1, x2, y2, alpha) {
    for (let x = x1; x <= x2; x++) {
      setPixel(x, y1, alpha);
    }
  }

  // Monitor body (rounded rect outline) — 2..19 x 2..13
  drawRect(3, 2, 18, 13, 255);
  // Soften corners
  setPixel(3, 2, 0); setPixel(18, 2, 0);
  setPixel(3, 13, 0); setPixel(18, 13, 0);
  setPixel(4, 2, 200); setPixel(17, 2, 200);
  setPixel(4, 13, 200); setPixel(17, 13, 200);
  setPixel(3, 3, 200); setPixel(18, 3, 200);
  setPixel(3, 12, 200); setPixel(18, 12, 200);

  // Monitor stand
  drawLine(9, 14, 12, 14, 255);
  drawLine(8, 15, 13, 15, 255);

  // Chat bubble inside monitor (small, 6..15 x 5..10)
  fillRect(7, 5, 14, 9, 255);
  // Bubble corners soften
  setPixel(7, 5, 0); setPixel(14, 5, 0);
  setPixel(7, 9, 0); setPixel(14, 9, 0);
  // Bubble tail
  setPixel(9, 10, 255);
  setPixel(8, 11, 255);

  // Text lines inside bubble (hollow effect)
  fillRect(8, 5, 13, 9, 0); // clear inside
  drawLine(8, 6, 12, 6, 255); // line 1
  drawLine(8, 8, 11, 8, 255); // line 2

  const icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  icon.setTemplateImage(true); // macOS auto dark/light
  return icon;
}

function toggleWidget() {
  if (isWidgetVisible) hideWidget();
  else showWidget();
}

function showWidget() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true);
    mainWindow.focus();
    mainWindow.moveTop();
    isWidgetVisible = true;
  }
}

function hideWidget() {
  if (mainWindow) {
    mainWindow.hide();
    isWidgetVisible = false;
  }
}

function processClipboard() {
  const text = clipboard.readText();
  if (text && text.trim()) {
    showWidget();
    mainWindow.webContents.send('text-detected', text);
  }
}

async function captureAndProcess() {
  // Hide widget so it doesn't appear in the screenshot
  const wasVisible = isWidgetVisible;
  if (wasVisible) hideWidget();
  await new Promise(resolve => setTimeout(resolve, 200));

  try {
    const text = await screenshotService.captureAndOCR();
    showWidget();
    if (text && text.trim()) {
      mainWindow.webContents.send('text-detected', text);
    } else {
      mainWindow.webContents.send('capture-error', 'No text detected in screenshot');
    }
  } catch (error) {
    showWidget();
    mainWindow.webContents.send('capture-error', error.message);
  }
}

async function captureAreaAndProcess() {
  // Hide widget so it doesn't appear in the screenshot
  if (isWidgetVisible) hideWidget();

  // Small delay to ensure widget is hidden
  await new Promise(resolve => setTimeout(resolve, 200));

  try {
    const text = await screenshotService.captureAreaAndOCR();
    showWidget();
    if (text && text.trim()) {
      // Send text and tell renderer to auto-generate
      mainWindow.webContents.send('text-detected-auto', text);
    } else {
      mainWindow.webContents.send('capture-error', 'No text detected in selected area');
    }
  } catch (error) {
    showWidget();
    if (error.message.includes('cancelled')) {
      return;
    }
    mainWindow.webContents.send('capture-error', error.message);
  }
}

async function quickGenerate() {
  const text = clipboard.readText();
  if (!text || !text.trim()) return;

  showWidget();
  mainWindow.webContents.send('capture-start');

  try {
    const analysis = detectorService.analyze(text);
    const context = {
      messageType: analysis.type || 'message',
      tone: analysis.tone || 'professional',
      language: store.get('language', 'auto') === 'auto' ? analysis.language : store.get('language')
    };

    const result = await openaiService.generateResponse(text, context);
    if (result.success) {
      addToHistory(text, result.response);
      mainWindow.webContents.send('quick-response', result.response);
    } else {
      mainWindow.webContents.send('capture-error', result.error);
    }
  } catch (error) {
    mainWindow.webContents.send('capture-error', error.message);
  }
}

function pasteLastResponse() {
  if (responseHistory.length > 0) {
    clipboard.writeText(responseHistory[0].text);
    if (mainWindow) {
      mainWindow.webContents.send('toast', 'Last response copied to clipboard');
    }
  }
}

function addToHistory(input, output) {
  responseHistory.unshift({ input, output, timestamp: Date.now() });
  if (responseHistory.length > 50) responseHistory = responseHistory.slice(0, 50);
  store.set('responseHistory', responseHistory);
}

function registerShortcuts() {
  const reg = (acc, fn) => {
    const ok = globalShortcut.register(acc, fn);
    if (!ok) console.warn(`Shortcut ${acc} failed to register`);
  };

  reg('CommandOrControl+Shift+R', () => captureAndProcess());
  reg('CommandOrControl+Shift+A', () => captureAreaAndProcess());
  reg('CommandOrControl+Shift+S', () => toggleWidget());
  reg('CommandOrControl+Shift+G', () => quickGenerate());
  reg('CommandOrControl+Shift+P', () => pasteLastResponse());

  // Cmd+Shift+V — paste clipboard into app (may conflict with macOS "Paste and Match Style")
  // Try registering, if fails use Alt+Shift+V as fallback
  const vOk = globalShortcut.register('CommandOrControl+Shift+V', () => processClipboard());
  if (!vOk) {
    console.warn('Cmd+Shift+V conflict, using Cmd+Alt+V instead');
    reg('CommandOrControl+Alt+V', () => processClipboard());
  }

  // Cmd+Shift+C — copy current response
  const cOk = globalShortcut.register('CommandOrControl+Shift+C', () => {
    if (mainWindow && isWidgetVisible) mainWindow.webContents.send('copy-current');
  });
  if (!cOk) {
    console.warn('Cmd+Shift+C conflict, using Cmd+Alt+C instead');
    reg('CommandOrControl+Alt+C', () => {
      if (mainWindow && isWidgetVisible) mainWindow.webContents.send('copy-current');
    });
  }

  reg('Escape', () => {
    if (isWidgetVisible) hideWidget();
  });
}

function setupIPC() {
  ipcMain.handle('generate-response', async (event, { text, context }) => {
    return await openaiService.generateResponse(text, context);
  });

  ipcMain.handle('modify-response', async (event, { response, instruction }) => {
    return await openaiService.modifyResponse(response, instruction);
  });

  ipcMain.handle('detect-message', async (event, text) => {
    return detectorService.analyze(text);
  });

  ipcMain.handle('get-settings', () => {
    return {
      apiKey: store.get('apiKey', ''),
      theme: store.get('theme', 'dark'),
      language: store.get('language', 'auto'),
      model: store.get('model', 'gpt-4'),
      autoClipboard: store.get('autoDetectClipboard', false),
      hasEmbeddedKey: true
    };
  });

  ipcMain.handle('save-settings', (event, settings) => {
    if (settings.apiKey !== undefined) {
      store.set('apiKey', settings.apiKey);
      openaiService.setApiKey(settings.apiKey || EMBEDDED_API_KEY);
    }
    if (settings.theme !== undefined) store.set('theme', settings.theme);
    if (settings.language !== undefined) store.set('language', settings.language);
    if (settings.model !== undefined) {
      store.set('model', settings.model);
      openaiService.setModel(settings.model);
    }
    if (settings.autoClipboard !== undefined) store.set('autoDetectClipboard', settings.autoClipboard);
    return true;
  });

  ipcMain.handle('copy-to-clipboard', (event, text) => {
    clipboard.writeText(text);
    return true;
  });

  ipcMain.handle('capture-screen', async () => {
    await captureAndProcess();
    return true;
  });

  ipcMain.handle('capture-area', async () => {
    await captureAreaAndProcess();
    return true;
  });

  ipcMain.handle('save-response', (event, { input, output }) => {
    addToHistory(input, output);
    return true;
  });

  ipcMain.handle('get-response-history', () => responseHistory);

  ipcMain.handle('get-clipboard-history', () => clipboardService.getHistory());

  // Video generation
  ipcMain.handle('generate-video', async (event, params) => {
    return await videoService.generateVideo(params);
  });

  ipcMain.handle('check-video-health', async () => {
    return await videoService.checkHealth();
  });

  ipcMain.handle('get-video-settings', () => {
    return {
      podId: store.get('runpodPodId', 'p6d73t3c95gihl')
    };
  });

  ipcMain.handle('save-video-file', async (event, base64Data) => {
    const { dialog } = require('electron');
    const fs = require('fs');
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `ltx-video-${Date.now()}.mp4`,
      filters: [{ name: 'Video', extensions: ['mp4'] }]
    });
    if (!result.canceled && result.filePath) {
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(result.filePath, buffer);
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });

  ipcMain.handle('hide-widget', () => {
    hideWidget();
    return true;
  });

  ipcMain.handle('start-drag', () => true);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerShortcuts();
  setupIPC();

  clipboardService.startMonitoring((text) => {
    if (mainWindow && store.get('autoDetectClipboard', false)) {
      mainWindow.webContents.send('clipboard-change', text);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  clipboardService.stopMonitoring();
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) showWidget();
  });
}
