const fetch = require('node-fetch');

class OpenAIService {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.openai.com/v1';
    this.model = model || 'gpt-4';
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  setModel(model) {
    this.model = model;
  }

  async generateResponse(message, context = {}) {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'API key not configured. Please add your OpenAI API key in settings.'
      };
    }

    const { messageType, tone, language = 'auto', customInstructions = '' } = context;
    const systemPrompt = this._buildSystemPrompt(messageType, tone, language, customInstructions);

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate a response to this message:\n\n${message}` }
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

  async modifyResponse(originalResponse, instruction) {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'API key not configured'
      };
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
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

  async detectMessageType(text) {
    if (!this.apiKey) {
      return { success: false, error: 'API key not configured' };
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `Analyze the message and return a JSON object with:
- type: "email" | "slack" | "whatsapp" | "linkedin" | "twitter" | "chat" | "other"
- tone: "formal" | "casual" | "professional" | "friendly"
- language: detected language code (e.g., "en", "tr", "es")
- urgency: "low" | "medium" | "high"
- summary: brief one-line summary

Return ONLY valid JSON, no other text.`
            },
            { role: 'user', content: text }
          ],
          temperature: 0.3,
          max_tokens: 200
        })
      });

      if (!response.ok) {
        throw new Error('Detection failed');
      }

      const data = await response.json();
      const result = JSON.parse(data.choices[0].message.content);
      return { success: true, ...result };
    } catch (error) {
      return {
        success: false,
        type: 'other',
        tone: 'professional',
        language: 'en',
        urgency: 'medium',
        error: error.message
      };
    }
  }

  _buildSystemPrompt(messageType, tone, language, customInstructions) {
    const langMap = {
      tr: 'Turkish', en: 'English', es: 'Spanish', de: 'German',
      fr: 'French', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese',
      ko: 'Korean', ru: 'Russian', pt: 'Portuguese', it: 'Italian'
    };

    const langName = langMap[language] || language;

    let prompt = `You are an expert at writing ${tone || 'professional'} responses to ${messageType || 'messages'}.

CRITICAL LANGUAGE RULE:`;

    if (language && language !== 'auto') {
      prompt += `
You MUST write your ENTIRE response in ${langName}. Do NOT use any other language. Every single word must be in ${langName}.`;
    } else {
      prompt += `
You MUST detect the language of the original message and respond ENTIRELY in that SAME language. If the message is in Turkish, respond in Turkish. If in English, respond in English. Match the exact language of the input. Do NOT default to English.`;
    }

    prompt += `

Guidelines:
- Match the tone and style appropriate for ${messageType || 'the platform'}
- Be concise but complete
- Be helpful and friendly
- Address all points in the original message`;

    if (customInstructions) {
      prompt += `\n\nAdditional instructions: ${customInstructions}`;
    }

    return prompt;
  }
}

module.exports = OpenAIService;
