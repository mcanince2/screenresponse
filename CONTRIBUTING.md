# Contributing to ScreenResponse

Thanks for helping improve ScreenResponse! 🎉

## Development setup

### Mac app (Electron)
```bash
git clone https://github.com/mcanince2/screenresponse.git
cd screenresponse/mac-app
npm install
npm start
```

### Chrome extension
Open `chrome://extensions/`, enable **Developer mode**, click **Load unpacked**,
and select the `chrome-extension/` folder. Paste your OpenAI key in the popup.

## Guidelines

- One focused change per pull request.
- **Never commit secrets.** Provide your OpenAI key via Settings or a local
  `.env` (`OPENAI_API_KEY`) — both are git-ignored.
- Keep the widget lightweight; it runs always-on-top.
- Match the existing code style (modern JS, no build step for the renderer).

## Reporting bugs / requesting features

Use the issue templates so we can reproduce and prioritize quickly.

## Code of Conduct

This project follows our [Code of Conduct](.github/CODE_OF_CONDUCT.md).
