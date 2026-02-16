const axios = require('axios');

// Provider configurations
const PROVIDERS = {
  rule: {
    name: 'Rule-Based (FREE)',
    model: 'heuristic',
    costPer1K: 0
  },
  groq: {
    name: 'Groq',
    model: 'llama3-8b-8192',
    costPer1K: 0.0005,
    baseURL: 'https://api.groq.com/openai/v1'
  },
  together: {
    name: 'Together AI',
    model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    costPer1K: 0.0006,
    baseURL: 'https://api.together.xyz/v1'
  },
  openai: {
    name: 'OpenAI',
    model: 'gpt-3.5-turbo',
    costPer1K: 0.0015,
    baseURL: 'https://api.openai.com/v1'
  },
  anthropic: {
    name: 'Anthropic',
    model: 'claude-3-haiku-20240307',
    costPer1K: 0.001,
    baseURL: 'https://api.anthropic.com/v1'
  },
  custom: {
    name: 'Custom/OpenAI-Compatible',
    model: null, // User specifies
    costPer1K: 0
  }
};

// Default provider
const DEFAULT_PROVIDER = process.env.LLM_PROVIDER || 'rule';

// Score a lead using AI or rule-based
// Options: { apiKey, model, baseUrl } for user-provided credentials
const scoreLead = async (leadText, provider = DEFAULT_PROVIDER, options = {}) => {
  // Always use rule-based if explicitly set
  if (provider === 'rule') {
    return enhancedRuleBasedScoring(leadText);
  }

  const config = PROVIDERS[provider];
  if (!config) {
    console.warn(`Unknown provider: ${provider}, using rule-based`);
    return enhancedRuleBasedScoring(leadText);
  }

  // If no API key provided and not using env vars, fall back to rule-based
  const apiKey = options.apiKey;
  if (!apiKey && provider !== 'rule') {
    console.log(`No API key for ${provider}, using rule-based`);
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
    const baseURL = options.baseUrl || config.baseURL;
    const model = options.model || config.model;

    if (provider === 'anthropic') {
      // Anthropic Claude
      response = await axios.post(`${baseURL}/messages`, {
        model: model,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: { 
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        }
      });
      
      const content = response.data.content[0].text;
      return parseAIResponse(content);
      
    } else {
      // OpenAI-compatible API (Groq, Together, OpenAI, Custom)
      response = await axios.post(`${baseURL}/chat/completions`, {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300
      }, {
        headers: { 
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const content = response.data.choices[0].message.content;
      return parseAIResponse(content);
    }
    
  } catch (error) {
    console.error(`AI scoring error (${provider}):`, error.message);
    // Fall back to rule-based on any error
    return enhancedRuleBasedScoring(leadText);
  }
};

// Parse AI JSON response
const parseAIResponse = (content) => {
  try {
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

// Enhanced Rule-based scoring (FREE)
const enhancedRuleBasedScoring = (text) => {
  const lower = text.toLowerCase();
  
  const SIGNALS = {
    hot: {
      urgent: ['urgent', 'asap', 'immediately', 'this week', 'today', 'hiring now', 'start asap'],
      budget: ['$50k', '$100k', '$500k', '$1m', 'budget approved', 'series a', 'series b'],
      decision: ['decision made', 'approved', 'ready to buy', 'ready to start'],
      action: ['book a call', 'schedule demo', 'send proposal', 'lets talk']
    },
    warm: {
      interest: ['interested', 'looking for', 'seeking', 'considering', 'evaluating'],
      research: ['comparing', 'research', 'explore', 'get quote', 'pricing'],
      timing: ['next month', 'next quarter', 'soon', 'planning to']
    }
  };
  
  let hotScore = 0, warmScore = 0;
  let matchedSignals = [];
  
  Object.values(SIGNALS.hot).forEach(category => {
    category.forEach(keyword => {
      if (lower.includes(keyword.toLowerCase())) {
        hotScore += 3;
        matchedSignals.push(keyword);
      }
    });
  });
  
  Object.values(SIGNALS.warm).forEach(category => {
    category.forEach(keyword => {
      if (lower.includes(keyword.toLowerCase())) {
        warmScore += 1;
        matchedSignals.push(keyword);
      }
    });
  });
  
  const budgetMatch = text.match(/\$[\d,]+(?:k|K)?|\$[\d,]+(?:m|M)?/i);
  const budgetSignal = budgetMatch ? budgetMatch[0] : null;
  if (budgetSignal) hotScore += 2;
  
  const totalScore = hotScore + warmScore;
  
  let score, reason, confidence;
  
  if (totalScore >= 6) {
    score = 'hot';
    confidence = Math.min(85 + (totalScore - 6) * 2, 98);
    reason = `Strong buying signals: ${matchedSignals.slice(0, 3).join(', ')}`;
  } else if (totalScore >= 2) {
    score = 'warm';
    confidence = Math.min(70 + totalScore * 3, 85);
    reason = `Moderate interest: ${matchedSignals.slice(0, 2).join(', ')}`;
  } else {
    score = 'cold';
    confidence = 50;
    reason = 'No strong buying signals detected';
  }
  
  return {
    score,
    reason,
    confidence: Math.round(confidence),
    budgetSignal,
    urgencySignal: hotScore > 0 ? 'Urgency keywords detected' : null,
    method: 'rule-based',
    signals: matchedSignals.slice(0, 5)
  };
};

// Get cost estimate
const getCostEstimate = (provider = DEFAULT_PROVIDER, leadsCount = 1000) => {
  const config = PROVIDERS[provider];
  if (!config || config.costPer1K === 0) {
    return {
      provider: config?.name || 'Rule-based',
      leadsCount,
      cost: 0,
      costPerLead: 0,
      note: 'Free - no API costs'
    };
  }
  
  const tokensPerLead = 500;
  const totalTokens = (tokensPerLead * leadsCount) / 1000;
  
  return {
    provider: config.name,
    leadsCount,
    estimatedTokens: tokensPerLead * leadsCount,
    cost: totalTokens * config.costPer1K,
    costPerLead: (totalTokens * config.costPer1K) / leadsCount
  };
};

module.exports = {
  scoreLead,
  getCostEstimate,
  PROVIDERS,
  enhancedRuleBasedScoring
};
