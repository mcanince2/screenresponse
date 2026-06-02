const { analyzeMessage } = require('./message-types');

class DetectorService {
  constructor() {
    // Additional platform-specific patterns
    this.platformPatterns = {
      gmail: [
        /inbox/i,
        /compose/i,
        /reply/i,
        /forward/i,
        /starred/i
      ],
      outlook: [
        /outlook/i,
        /new mail/i,
        /focused inbox/i
      ],
      slack: [
        /thread/i,
        /channel/i,
        /direct message/i,
        /#\w+-\w+/
      ],
      teams: [
        /microsoft teams/i,
        /meeting/i,
        /chat/i
      ],
      discord: [
        /server/i,
        /#\w+/,
        /@everyone/i
      ]
    };
  }

  analyze(text) {
    // Use shared message analyzer
    const baseAnalysis = analyzeMessage(text);

    // Enhance with additional detection
    const platform = this.detectPlatform(text);
    const hasGreeting = this.hasGreeting(text);
    const hasSignature = this.hasSignature(text);
    const questionCount = this.countQuestions(text);

    return {
      ...baseAnalysis,
      platform,
      hasGreeting,
      hasSignature,
      questionCount,
      suggestedTone: this.suggestTone(baseAnalysis, platform)
    };
  }

  detectPlatform(text) {
    for (const [platform, patterns] of Object.entries(this.platformPatterns)) {
      const matchCount = patterns.filter(p => p.test(text)).length;
      if (matchCount >= 2) {
        return platform;
      }
    }
    return null;
  }

  hasGreeting(text) {
    const greetingPatterns = [
      /^(hi|hello|hey|dear|good morning|good afternoon|good evening)/im,
      /^(merhaba|selam|günaydın|iyi günler|iyi akşamlar)/im,
      /^(hola|bonjour|guten tag|ciao)/im
    ];

    return greetingPatterns.some(p => p.test(text));
  }

  hasSignature(text) {
    const signaturePatterns = [
      /(best regards|kind regards|sincerely|thanks|cheers)[\s,]*$/im,
      /(saygılarımla|iyi günler|teşekkürler|sevgiler)[\s,]*$/im,
      /^--\s*$/m, // Common signature separator
      /sent from my (iphone|ipad|android)/i
    ];

    return signaturePatterns.some(p => p.test(text));
  }

  countQuestions(text) {
    const questionMarks = (text.match(/\?/g) || []).length;
    const questionWords = (text.match(/\b(what|when|where|why|how|who|which|can|could|would|should|is|are|do|does|did|will|have|has)\b[^.!?]*\?/gi) || []).length;

    return Math.max(questionMarks, questionWords);
  }

  suggestTone(analysis, platform) {
    // Suggest appropriate tone based on context
    if (platform === 'slack' || platform === 'discord') {
      return analysis.tone === 'formal' ? 'professional' : 'casual';
    }

    if (analysis.type === 'email') {
      return analysis.tone === 'casual' ? 'professional' : analysis.tone;
    }

    if (analysis.type === 'linkedin') {
      return 'professional';
    }

    return analysis.tone;
  }

  extractSenderName(text) {
    // Try to extract sender name from common patterns
    const patterns = [
      /^from:\s*(.+?)[\s<]/im,
      /^(.+?)\s+wrote:/im,
      /^(.+?)\s+said:/im,
      /^(.+?):\s/m
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length > 1 && name.length < 50) {
          return name;
        }
      }
    }

    return null;
  }

  extractKeyPoints(text) {
    const points = [];

    // Find bullet points
    const bulletMatches = text.match(/^[\s]*[-•*]\s*(.+)$/gm);
    if (bulletMatches) {
      points.push(...bulletMatches.map(m => m.replace(/^[\s]*[-•*]\s*/, '').trim()));
    }

    // Find numbered points
    const numberedMatches = text.match(/^[\s]*\d+[.)]\s*(.+)$/gm);
    if (numberedMatches) {
      points.push(...numberedMatches.map(m => m.replace(/^[\s]*\d+[.)]\s*/, '').trim()));
    }

    // Find questions
    const questions = text.match(/[^.!?]*\?/g);
    if (questions) {
      points.push(...questions.map(q => q.trim()));
    }

    return points.slice(0, 5); // Return max 5 key points
  }
}

module.exports = DetectorService;
