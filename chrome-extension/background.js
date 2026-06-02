/**
 * ScreenResponse Chrome Extension - Background Service Worker
 */

// Default settings
const DEFAULT_SETTINGS = {
  apiKey: '',
  theme: 'dark',
  language: 'auto',
  autoShow: true
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  // Set default settings
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  await chrome.storage.sync.set({ ...DEFAULT_SETTINGS, ...settings });

  // Create context menu
  chrome.contextMenus.create({
    id: 'screenresponse-generate',
    title: 'Generate AI Response',
    contexts: ['selection']
  });

  console.log('ScreenResponse extension installed');
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'screenresponse-generate' && info.selectionText) {
    // Send selected text to content script
    chrome.tabs.sendMessage(tab.id, {
      action: 'generateResponse',
      text: info.selectionText
    });
  }
});

// Keyboard shortcut handler
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'generate-response') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'getSelectedText'
      });
    }
  }
});

// Message handler for content script communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateAIResponse') {
    handleGenerateResponse(request.text, request.context)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === 'modifyAIResponse') {
    handleModifyResponse(request.response, request.instruction)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'detectMessage') {
    handleDetectMessage(request.text)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getSettings') {
    chrome.storage.sync.get(DEFAULT_SETTINGS)
      .then(sendResponse)
      .catch(error => sendResponse(DEFAULT_SETTINGS));
    return true;
  }

  if (request.action === 'saveSettings') {
    chrome.storage.sync.set(request.settings)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// OpenAI API handlers
async function handleGenerateResponse(text, context = {}) {
  const settings = await chrome.storage.sync.get(['apiKey']);

  if (!settings.apiKey) {
    return {
      success: false,
      error: 'API key not configured. Please add your OpenAI API key in the extension settings.'
    };
  }

  const { messageType, tone, language = 'auto', customInstructions = '' } = context;
  const systemPrompt = buildSystemPrompt(messageType, tone, language, customInstructions);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate a response to this message:\n\n${text}` }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    return {
      success: true,
      response: data.choices[0].message.content,
      usage: data.usage
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleModifyResponse(originalResponse, instruction) {
  const settings = await chrome.storage.sync.get(['apiKey']);

  if (!settings.apiKey) {
    return { success: false, error: 'API key not configured' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that modifies text based on instructions. Keep the core message but apply the requested changes. Return ONLY the modified text, no explanations.'
          },
          {
            role: 'user',
            content: `Original text:\n${originalResponse}\n\nInstruction: ${instruction}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    return {
      success: true,
      response: data.choices[0].message.content
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleDetectMessage(text) {
  const settings = await chrome.storage.sync.get(['apiKey']);

  if (!settings.apiKey) {
    // Fallback to local detection
    return localDetectMessage(text);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `Analyze the message and return a JSON object with:
- type: "email" | "slack" | "whatsapp" | "linkedin" | "twitter" | "chat" | "other"
- tone: "formal" | "casual" | "professional" | "friendly"
- language: detected language code (e.g., "en", "tr", "es")
- urgency: "low" | "medium" | "high"

Return ONLY valid JSON, no other text.`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      return localDetectMessage(text);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return { success: true, ...result };
  } catch (error) {
    return localDetectMessage(text);
  }
}

// Local message detection fallback
function localDetectMessage(text) {
  const result = {
    success: true,
    type: 'other',
    tone: 'professional',
    language: 'en',
    urgency: 'medium'
  };

  // Detect type
  if (/@[\w.-]+\.\w+/.test(text) || /^(subject|from|to):/im.test(text)) {
    result.type = 'email';
  } else if (/#[\w-]+/.test(text) && /:\w+:/.test(text)) {
    result.type = 'slack';
  } else if (/linkedin/i.test(text) || /connection request/i.test(text)) {
    result.type = 'linkedin';
  }

  // Detect tone
  if (/dear\s+(sir|madam|mr|mrs)/i.test(text) || /respectfully/i.test(text)) {
    result.tone = 'formal';
  } else if (/hey|hi there|yo|lol|haha/i.test(text)) {
    result.tone = 'casual';
  }

  // Detect language
  if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) {
    result.language = 'tr';
  }

  // Detect urgency
  if (/urgent|asap|immediately|critical/i.test(text)) {
    result.urgency = 'high';
  } else if (/no rush|whenever|fyi/i.test(text)) {
    result.urgency = 'low';
  }

  return result;
}

function buildSystemPrompt(messageType, tone, language, customInstructions) {
  let prompt = `You are an expert at writing ${tone || 'professional'} responses to ${messageType || 'messages'}.

Guidelines:
- Match the tone and style appropriate for ${messageType || 'the platform'}
- Be concise but complete
- Be helpful and friendly
- Address all points in the original message`;

  if (language && language !== 'auto') {
    prompt += `\n- Write the response in ${language}`;
  } else {
    prompt += `\n- Respond in the same language as the original message`;
  }

  if (customInstructions) {
    prompt += `\n\nAdditional instructions: ${customInstructions}`;
  }

  return prompt;
}
