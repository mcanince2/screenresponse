/**
 * Video Generation Service — RunPod Pod API (LTX-2.3)
 */

const fetch = require('node-fetch');

class VideoService {
  constructor(store) {
    this.store = store;
    this.podId = store.get('runpodPodId', 'p6d73t3c95gihl');
  }

  get baseUrl() {
    return `https://${this.podId}-8000.proxy.runpod.net`;
  }

  get headers() {
    return { 'Content-Type': 'application/json' };
  }

  async checkHealth() {
    try {
      const resp = await fetch(`${this.baseUrl}/health`, { headers: this.headers, timeout: 10000 });
      if (resp.ok) {
        const data = await resp.json();
        if (data.status === 'ok') {
          return { status: 'online', message: `${data.model} on ${data.gpu}` };
        }
        return { status: 'online', message: 'GPU ready' };
      }
      return { status: 'offline', message: `API error: ${resp.status}` };
    } catch (e) {
      return { status: 'offline', message: e.message };
    }
  }

  async generateVideo({ prompt, height, width, num_frames, seed }) {
    try {
      const resp = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ prompt, height, width, num_frames, seed })
      });

      if (!resp.ok) {
        const text = await resp.text();
        return { status: 'error', error: `Request failed: ${resp.status} ${text}` };
      }

      const data = await resp.json();
      return data;
    } catch (e) {
      return { status: 'error', error: e.message };
    }
  }
}

module.exports = VideoService;
