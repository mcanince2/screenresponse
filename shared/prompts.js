/**
 * AI Prompt Templates for ScreenResponse
 */

const PROMPTS = {
  // Modification commands
  modifications: {
    shorter: {
      tr: 'Daha kısa yaz, özünü koru',
      en: 'Make it shorter while keeping the essence'
    },
    longer: {
      tr: 'Daha detaylı ve uzun yaz',
      en: 'Make it more detailed and longer'
    },
    formal: {
      tr: 'Daha resmi ve profesyonel bir dille yaz',
      en: 'Make it more formal and professional'
    },
    casual: {
      tr: 'Daha samimi ve rahat bir dille yaz',
      en: 'Make it more casual and friendly'
    },
    friendly: {
      tr: 'Daha sıcak ve arkadaşça yaz',
      en: 'Make it warmer and friendlier'
    },
    assertive: {
      tr: 'Daha kararlı ve net bir şekilde yaz',
      en: 'Make it more assertive and direct'
    },
    polite: {
      tr: 'Daha kibar ve nazik bir şekilde yaz',
      en: 'Make it more polite and courteous'
    },
    simplify: {
      tr: 'Daha basit ve anlaşılır yaz',
      en: 'Simplify the language'
    }
  },

  // Response types
  responseTypes: {
    accept: {
      tr: 'Kabul eden olumlu bir yanıt yaz',
      en: 'Write a positive accepting response'
    },
    decline: {
      tr: 'Kibar bir şekilde reddeden yanıt yaz',
      en: 'Write a polite declining response'
    },
    question: {
      tr: 'Daha fazla bilgi isteyen bir yanıt yaz',
      en: 'Write a response asking for more information'
    },
    thankYou: {
      tr: 'Teşekkür eden bir yanıt yaz',
      en: 'Write a thank you response'
    },
    followUp: {
      tr: 'Takip eden bir yanıt yaz',
      en: 'Write a follow-up response'
    },
    acknowledge: {
      tr: 'Onaylayan kısa bir yanıt yaz',
      en: 'Write a brief acknowledgment'
    }
  },

  // Platform-specific templates
  platforms: {
    email: {
      greeting: {
        formal: { tr: 'Sayın', en: 'Dear' },
        casual: { tr: 'Merhaba', en: 'Hi' }
      },
      closing: {
        formal: { tr: 'Saygılarımla', en: 'Best regards' },
        casual: { tr: 'İyi günler', en: 'Best' }
      }
    },
    slack: {
      style: 'concise, use emoji sparingly, be direct'
    },
    linkedin: {
      style: 'professional but personable, mention mutual connections or interests if relevant'
    },
    whatsapp: {
      style: 'casual, can use emojis, keep it brief'
    },
    twitter: {
      style: 'very concise, engaging, consider character limit'
    }
  },

  // Quick actions
  quickActions: [
    { id: 'shorter', icon: '📝', label: { tr: 'Kısalt', en: 'Shorter' } },
    { id: 'formal', icon: '👔', label: { tr: 'Resmi', en: 'Formal' } },
    { id: 'casual', icon: '😊', label: { tr: 'Samimi', en: 'Casual' } },
    { id: 'friendly', icon: '🤝', label: { tr: 'Arkadaşça', en: 'Friendly' } }
  ]
};

// Helper function to get modification prompt
function getModificationPrompt(type, language = 'en') {
  const mod = PROMPTS.modifications[type];
  if (mod) {
    return mod[language] || mod.en;
  }
  return type; // Return as-is if custom instruction
}

// Helper function to get response type prompt
function getResponseTypePrompt(type, language = 'en') {
  const resp = PROMPTS.responseTypes[type];
  if (resp) {
    return resp[language] || resp.en;
  }
  return null;
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PROMPTS, getModificationPrompt, getResponseTypePrompt };
}

if (typeof window !== 'undefined') {
  window.PROMPTS = PROMPTS;
  window.getModificationPrompt = getModificationPrompt;
  window.getResponseTypePrompt = getResponseTypePrompt;
}
