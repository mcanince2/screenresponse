/**
 * Message Type Detection Utilities
 * Identifies platform and message characteristics from text
 */

const MESSAGE_PATTERNS = {
  email: {
    indicators: [
      /^(from|to|subject|cc|bcc):/im,
      /^(gönderen|kime|konu):/im,
      /@[\w.-]+\.\w+/,
      /^(dear|hi|hello|merhaba|sayın)/im,
      /(regards|sincerely|best|saygılarımla|iyi günler)$/im
    ],
    weight: 0
  },
  slack: {
    indicators: [
      /#[\w-]+/, // Channel names
      /@[\w.-]+/, // Mentions
      /:\w+:/, // Emoji codes
      /```[\s\S]*```/, // Code blocks
      /\*[^*]+\*/, // Bold text
      /_[^_]+_/ // Italic text
    ],
    weight: 0
  },
  whatsapp: {
    indicators: [
      /\[\d{1,2}[:.]\d{2}(:\d{2})?\s*(AM|PM)?\]/i, // Time stamps
      /^\d{1,2}\/\d{1,2}\/\d{2,4}/m, // Date format
      /✓✓/, // Read receipts
      /📷|🎵|🎤|📎/, // Media indicators
      /^\+\d{1,3}\s?\d+/ // Phone numbers
    ],
    weight: 0
  },
  linkedin: {
    indicators: [
      /connection request/i,
      /let's connect/i,
      /your network/i,
      /linkedin/i,
      /professional/i,
      /opportunity/i,
      /role|position|job/i
    ],
    weight: 0
  },
  twitter: {
    indicators: [
      /^@\w+/m, // Mentions at start
      /#\w+/, // Hashtags
      /RT @/i, // Retweets
      /.{1,280}$/ // Character limit hint
    ],
    weight: 0
  },
  chat: {
    indicators: [
      /^[^:]{1,20}:\s/m, // Simple name: message format
      /^\d{1,2}:\d{2}\s/m, // Time prefix
      /😀|😂|😊|👍|❤️|🔥|💯/, // Common emojis
      /lol|haha|omg|btw|idk|brb/i // Chat abbreviations
    ],
    weight: 0
  }
};

const TONE_PATTERNS = {
  formal: {
    indicators: [
      /dear\s+(sir|madam|mr|mrs|ms)/i,
      /sayın/i,
      /respectfully/i,
      /saygılarımla/i,
      /i would like to/i,
      /please be advised/i,
      /kindly/i,
      /hereby/i
    ],
    weight: 0
  },
  casual: {
    indicators: [
      /hey|hi there|yo|sup/i,
      /gonna|wanna|gotta/i,
      /!{2,}/,
      /\?\?+/,
      /lol|haha|rofl|lmao/i,
      /👋|😊|😄|🙂/
    ],
    weight: 0
  },
  professional: {
    indicators: [
      /please let me know/i,
      /at your earliest convenience/i,
      /i hope this email finds you/i,
      /as discussed/i,
      /moving forward/i,
      /touch base/i
    ],
    weight: 0
  },
  friendly: {
    indicators: [
      /hope you're doing well/i,
      /nasılsın/i,
      /how are you/i,
      /great to hear/i,
      /thanks so much/i,
      /çok teşekkürler/i
    ],
    weight: 0
  }
};

const URGENCY_PATTERNS = {
  high: {
    indicators: [
      /urgent|asap|immediately|critical/i,
      /acil|hemen|derhal/i,
      /!!!+/,
      /deadline today/i,
      /need this now/i,
      /time sensitive/i
    ],
    weight: 0
  },
  medium: {
    indicators: [
      /soon|shortly|this week/i,
      /yakında|bu hafta/i,
      /when you get a chance/i,
      /please respond/i
    ],
    weight: 0
  },
  low: {
    indicators: [
      /no rush|whenever|fyi|just wanted to/i,
      /acele yok|bilginize/i,
      /when you have time/i,
      /for your reference/i
    ],
    weight: 0
  }
};

/**
 * Detect message type from text
 */
function detectMessageType(text) {
  const scores = {};

  for (const [type, config] of Object.entries(MESSAGE_PATTERNS)) {
    scores[type] = 0;
    for (const pattern of config.indicators) {
      if (pattern.test(text)) {
        scores[type]++;
      }
    }
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'other';

  return Object.entries(scores).find(([_, score]) => score === maxScore)[0];
}

/**
 * Detect tone from text
 */
function detectTone(text) {
  const scores = {};

  for (const [tone, config] of Object.entries(TONE_PATTERNS)) {
    scores[tone] = 0;
    for (const pattern of config.indicators) {
      if (pattern.test(text)) {
        scores[tone]++;
      }
    }
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'professional';

  return Object.entries(scores).find(([_, score]) => score === maxScore)[0];
}

/**
 * Detect urgency from text
 */
function detectUrgency(text) {
  const scores = {};

  for (const [level, config] of Object.entries(URGENCY_PATTERNS)) {
    scores[level] = 0;
    for (const pattern of config.indicators) {
      if (pattern.test(text)) {
        scores[level]++;
      }
    }
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'medium';

  return Object.entries(scores).find(([_, score]) => score === maxScore)[0];
}

/**
 * Detect language (basic detection)
 */
function detectLanguage(text) {
  const turkishChars = /[çğıöşüÇĞİÖŞÜ]/;
  const turkishWords = /\b(ve|bir|bu|için|ile|değil|ama|veya|çok|daha|nasıl|neden)\b/i;

  if (turkishChars.test(text) || turkishWords.test(text)) {
    return 'tr';
  }

  // Default to English
  return 'en';
}

/**
 * Comprehensive message analysis
 */
function analyzeMessage(text) {
  return {
    type: detectMessageType(text),
    tone: detectTone(text),
    urgency: detectUrgency(text),
    language: detectLanguage(text),
    length: text.length,
    wordCount: text.split(/\s+/).filter(w => w.length > 0).length
  };
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    detectMessageType,
    detectTone,
    detectUrgency,
    detectLanguage,
    analyzeMessage,
    MESSAGE_PATTERNS,
    TONE_PATTERNS,
    URGENCY_PATTERNS
  };
}

if (typeof window !== 'undefined') {
  window.MessageDetector = {
    detectMessageType,
    detectTone,
    detectUrgency,
    detectLanguage,
    analyzeMessage
  };
}
