/**
 * OpenAI GPT-4 API Client
 * Shared between Mac App and Chrome Extension
 */

class OpenAIClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.openai.com/v1';
    this.model = 'gpt-4';
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  async generateResponse(message, context = {}) {
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
              content: 'You are a helpful assistant that modifies text based on instructions. Keep the core message but apply the requested changes.'
            },
            {
              role: 'user',
              content: `Original text:\n${originalResponse}\n\nInstruction: ${instruction}\n\nProvide the modified text only, without explanations.`
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
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OpenAIClient;
}

if (typeof window !== 'undefined') {
  window.OpenAIClient = OpenAIClient;
}
