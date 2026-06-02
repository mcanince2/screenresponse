const { createWorker } = require('tesseract.js');
const screenshot = require('screenshot-desktop');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class ScreenshotService {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      this.worker = await createWorker('eng+tur', 1, {
        logger: m => console.log(`Tesseract: ${m.status} - ${Math.round(m.progress * 100)}%`)
      });
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Tesseract:', error);
      throw error;
    }
  }

  async captureScreen() {
    try {
      const imgBuffer = await screenshot({ format: 'png' });
      return imgBuffer;
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      throw new Error('Failed to capture screenshot');
    }
  }

  async captureArea() {
    const tempPath = path.join(os.tmpdir(), `screenresponse-area-${Date.now()}.png`);

    return new Promise((resolve, reject) => {
      // macOS screencapture -i = interactive selection, -s = selection mode
      execFile('screencapture', ['-i', '-s', tempPath], (error) => {
        if (error) {
          // User cancelled or error
          this._cleanup(tempPath);
          reject(new Error('Screenshot cancelled or failed'));
          return;
        }

        // Check if file was created (user might cancel)
        if (!fs.existsSync(tempPath)) {
          reject(new Error('Screenshot cancelled'));
          return;
        }

        try {
          const imgBuffer = fs.readFileSync(tempPath);
          resolve({ buffer: imgBuffer, tempPath });
        } catch (e) {
          this._cleanup(tempPath);
          reject(new Error('Failed to read screenshot'));
        }
      });
    });
  }

  async captureAndOCR() {
    await this.initialize();

    try {
      const imgBuffer = await this.captureScreen();
      const { data: { text } } = await this.worker.recognize(imgBuffer);
      return this.cleanOCRText(text);
    } catch (error) {
      console.error('OCR failed:', error);
      throw new Error('Failed to extract text from screenshot');
    }
  }

  async captureAreaAndOCR() {
    await this.initialize();

    let tempPath = null;
    try {
      const result = await this.captureArea();
      tempPath = result.tempPath;

      const { data: { text } } = await this.worker.recognize(result.buffer);

      // Always clean up the screenshot file
      this._cleanup(tempPath);

      return this.cleanOCRText(text);
    } catch (error) {
      if (tempPath) this._cleanup(tempPath);
      console.error('Area OCR failed:', error);
      throw error;
    }
  }

  async recognizeImage(imagePath) {
    await this.initialize();

    try {
      const { data: { text } } = await this.worker.recognize(imagePath);
      return this.cleanOCRText(text);
    } catch (error) {
      console.error('Image recognition failed:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  cleanOCRText(text) {
    if (!text) return '';

    return text
      .replace(/[ \t]+/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/^\s*[\r\n]/gm, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  _cleanup(filePath) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}

module.exports = ScreenshotService;
