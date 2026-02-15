const { OpenAI } = require('openai');
const axios = require('axios');

// Initialize clients
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

// Provider configurations
const PROVIDERS = {
  rule: {
    name: 'Rule-Based (FREE)',
    model: 'heuristic',
    costPer1K: 0 // Completely free
  },
  groq: {
    name: 'Groq',
    model: 'llama3-8b-8192',
    costPer1K: 0.0005, // $0.0005 per 1K tokens - 3x cheaper!
    baseURL: 'https://api.groq.com/openai/v1'
  },
  together: {
    name: 'Together AI',
    model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    costPer1K: 0.0006, // Very cheap
    baseURL: 'https://api.together.xyz/v1'
  },
  openai: {
    name: 'OpenAI',
    model: 'gpt-3.5-turbo',
    costPer1K: 0.0015, // $0.0015 per 1K tokens (input)
    costPer1KOutput: 0.002
  },
  local: {
    name: 'Local/Ollama',
    model: 'llama3',
    costPer1K: 0, // FREE if running locally
    baseURL: process.env.LOCAL_LLM_URL || 'http://localhost:11434/v1'
  }
};

// Default provider (FREE: uses rule-based if no API key)
const DEFAULT_PROVIDER = process.env.LLM_PROVIDER || 'rule';

// Score a lead using AI or rule-based
const scoreLead = async (leadText, provider = DEFAULT_PROVIDER) => {
  // Always use rule-based if explicitly set or if no API keys available
  if (provider === 'rule') {
    return enhancedRuleBasedScoring(leadText);
  }
  
  const config = PROVIDERS[provider];
  
  if (!config) {
    console.warn(`Unknown provider: ${provider}, using rule-based`);
    return enhancedRuleBasedScoring(leadText);
  }

  const prompt = `Analyze this lead and classify as Hot, Warm, or Cold based on buying intent.

Lead: """${leadText}"""

Respond in JSON format:
{
  "score": "hot|warm|cold",
  "reason": "brief explanation",
  "confidence": 0-100,
  "budgetSignal": "detected budget info or null",
  "urgencySignal": "detected urgency info or null"
}`;

  try {
    let response;

    if (provider === 'groq' && process.env.GROQ_API_KEY) {
      // Groq - Fast and cheap!
      response = await axios.post(`${config.baseURL}/chat/completions`, {
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300
      }, {
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
      });
      
      const content = response.data.choices[0].message.content;
      return parseAIResponse(content);
      
    } else if (provider === 'together' && process.env.TOGETHER_API_KEY) {
      // Together AI
      response = await axios.post(`${config.baseURL}/chat/completions`, {
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300
      }, {
        headers: { 'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}` }
      });
      
      const content = response.data.choices[0].message.content;
      return parseAIResponse(content);
      
    } else if (provider === 'openai' && openai) {
      // OpenAI
      response = await openai.chat.completions.create({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300
      });
      
      const content = response.choices[0].message.content;
      return parseAIResponse(content);
      
    } else if (provider === 'local') {
      // Local Ollama - FREE!
      try {
        response = await axios.post(`${config.baseURL}/chat/completions`, {
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 300,
          stream: false
        });
        
        const content = response.data.choices[0].message.content;
        return parseAIResponse(content);
      } catch (e) {
        console.log('Local LLM not available, falling back to rule-based');
        return enhancedRuleBasedScoring(leadText);
      }
    }
    
    // Fallback to rule-based if no AI available
    return enhancedRuleBasedScoring(leadText);
    
  } catch (error) {
    console.error(`AI scoring error (${provider}):`, error.message);
    return enhancedRuleBasedScoring(leadText);
  }
};

// Parse AI JSON response
const parseAIResponse = (content) => {
  try {
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: parsed.score?.toLowerCase() || 'warm',
        reason: parsed.reason || 'AI analysis',
        confidence: parsed.confidence || 70,
        budgetSignal: parsed.budgetSignal,
        urgencySignal: parsed.urgencySignal
      };
    }
  } catch (e) {
    console.log('Failed to parse AI response, using fallback');
  }
  
  return enhancedRuleBasedScoring(content);
};

// Enhanced Rule-based scoring (FREE - no AI needed)
// Sophisticated keyword matching with weighted scoring
const enhancedRuleBasedScoring = (text) => {
  const lower = text.toLowerCase();
  
  // Weighted keyword categories
  const SIGNALS = {
    hot: {
      urgent: [
        'urgent', 'asap', 'immediately', 'this week', 'today',
        'hiring now', 'start asap', 'need asap', 'quickly',
        'emergency', 'critical', 'deadline', 'rush'
      ],
      budget: [
        '$50k', '$100k', '$500k', '$1m', '$1M', 'million',
        'budget approved', 'allocated budget', 'funding secured',
        'series a', 'series b', 'raised', 'just funded'
      ],
      decision: [
        'decision made', 'approved', 'ready to buy', 'ready to start',
        'signed off', 'green light', 'go ahead', 'confirmed'
      ],
      action: [
        'book a call', 'schedule demo', 'send proposal',
        'lets talk', 'contact us', 'reach out'
      ]
    },
    warm: {
      interest: [
        'interested', 'looking for', 'seeking', 'searching for',
        'considering', 'evaluating', 'reviewing options'
      ],
      research: [
        'comparing', 'research', 'explore', 'learn more',
        'get quote', 'pricing', 'cost', 'how much'
      ],
      timing: [
        'next month', 'next quarter', 'soon', 'upcoming',
        'planning to', 'thinking about', 'might need'
      ]
    },
    cold: {
      vague: [
        'maybe', 'possibly', 'not sure', 'just looking',
        'curious', 'information', 'general inquiry'
      ],
      future: [
        'someday', 'eventually', 'in the future',
        'not now', 'later', 'next year'
      ]
    }
  };
  
  // Calculate weighted scores
  let hotScore = 0;
  let warmScore = 0;
  let coldScore = 0;
  let matchedSignals = [];
  
  // Check hot signals (weighted 3x)
  Object.values(SIGNALS.hot).forEach(category => {
    category.forEach(keyword => {
      if (lower.includes(keyword.toLowerCase())) {
        hotScore += 3;
        matchedSignals.push(keyword);
      }
    });
  });
  
  // Check warm signals (weighted 1x)
  Object.values(SIGNALS.warm).forEach(category => {
    category.forEach(keyword => {
      if (lower.includes(keyword.toLowerCase())) {
        warmScore += 1;
        matchedSignals.push(keyword);
      }
    });
  });
  
  // Check cold signals (weighted -1x)
  Object.values(SIGNALS.cold).forEach(category => {
    category.forEach(keyword => {
      if (lower.includes(keyword.toLowerCase())) {
        coldScore += 1;
      }
    });
  });
  
  // Extract budget mentions
  const budgetPatterns = [
    /\$[\d,]+(?:k|K|\s*thousand)?/,
    /\$[\d,]+(?:m|M|\s*million)?/,
    /\$\d+(?:,\d{3})*(?:\.\d{2})?/,
    /\bdollar\s+budget\b/i,
    /\bbudget\s+of\s+\$?\d+/i
  ];
  
  let budgetSignal = null;
  for (const pattern of budgetPatterns) {
    const match = text.match(pattern);
    if (match) {
      budgetSignal = match[0];
      hotScore += 2; // Budget mention is a strong signal
      break;
    }
  }
  
  // Extract urgency indicators
  const urgencyPatterns = [
    /\b(asap|urgent|immediately|this week|today)\b/i,
    /\b(\d+\s*days?)\b/i,
    /\bdeadline\b/i,
    /\bhiring\s+now\b/i
  ];
  
  let urgencySignal = null;
  for (const pattern of urgencyPatterns) {
    const match = text.match(pattern);
    if (match) {
      urgencySignal = match[0];
      break;
    }
  }
  
  // Calculate final score
  const totalScore = hotScore + warmScore - coldScore;
  
  // Determine category with detailed reasoning
  let score, reason, confidence;
  
  if (totalScore >= 6) {
    score = 'hot';
    confidence = Math.min(85 + (totalScore - 6) * 2, 98);
    reason = matchedSignals.length > 0 
      ? `Strong buying signals detected: ${matchedSignals.slice(0, 3).join(', ')}`
      : 'Multiple high-intent indicators present';
  } else if (totalScore >= 2) {
    score = 'warm';
    confidence = Math.min(70 + totalScore * 3, 85);
    reason = matchedSignals.length > 0
      ? `Moderate interest: ${matchedSignals.slice(0, 2).join(', ')}`
      : 'Some buying signals detected';
  } else {
    score = 'cold';
    confidence = Math.max(40, 60 - coldScore * 5);
    reason = coldScore > 0 
      ? 'Low intent signals, vague or future timeline'
      : 'No strong buying signals detected';
  }
  
  return {
    score,
    reason,
    confidence: Math.round(confidence),
    budgetSignal,
    urgencySignal,
    method: 'rule-based',
    signals: matchedSignals.slice(0, 5),
    scoreDetails: { hotScore, warmScore, coldScore, totalScore }
  };
};

// Get cost estimate
const getCostEstimate = (provider = DEFAULT_PROVIDER, leadsCount = 1000) => {
  const config = PROVIDERS[provider];
  const tokensPerLead = 500; // Approximate
  const totalTokens = (tokensPerLead * leadsCount) / 1000;
  
  return {
    provider: config.name,
    leadsCount,
    estimatedTokens: tokensPerLead * leadsCount,
    cost: totalTokens * config.costPer1K,
    costPerLead: (totalTokens * config.costPer1K) / leadsCount
  };
};

// Test all providers
const testProviders = async (sampleLead) => {
  const results = {};
  
  for (const [key, config] of Object.entries(PROVIDERS)) {
    try {
      const start = Date.now();
      const result = await scoreLead(sampleLead, key);
      results[key] = {
        ...result,
        latency: Date.now() - start,
        status: 'success'
      };
    } catch (e) {
      results[key] = {
        status: 'failed',
        error: e.message
      };
    }
  }
  
  return results;
};

// Legacy alias for backward compatibility
const ruleBasedScoring = enhancedRuleBasedScoring;

module.exports = {
  scoreLead,
  getCostEstimate,
  testProviders,
  PROVIDERS,
  enhancedRuleBasedScoring,
  ruleBasedScoring // Legacy alias
};
