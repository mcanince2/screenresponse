# Security Policy

## Reporting a Vulnerability

Please report security issues **privately** by emailing **mcan.ince3@gmail.com**
rather than opening a public issue. You'll get a response as soon as possible.

## Secrets & API keys

ScreenResponse ships with **no embedded API key**. You bring your own OpenAI key,
stored locally on your device:

- **Mac app** — via `electron-store` (local), or the optional `OPENAI_API_KEY`
  environment variable (`.env`, git-ignored).
- **Chrome extension** — via `chrome.storage.sync`.

When contributing:

- Never commit a real `.env`, `OPENAI_API_KEY`, or `RUNPOD_API_KEY`.
- Never paste keys into issues, pull requests, or logs.
- API calls go directly to OpenAI; there is no telemetry or data collection.

## Supported Versions

The latest release on the `main` branch is supported.
