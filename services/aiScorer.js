const { OpenAI } = require('openai');
const axios = require('axios');

// Initialize clients
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

// Provider configurations
const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    model: 'gpt-3.5-turbo',
    costPer1K: 0.0015, // $0.0015 per 1K tokens (input)
    costPer1KOutput: 0.002
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
  local: {
    name: 'Local/Ollama',
    model: 'llama3',
    costPer1K: 0, // FREE if running locally
    baseURL: process.env.LOCAL_LLM_URL || 'http://localhost:11434/v1'
  }
};

// Default provider (can be changed via env)
const DEFAULT_PROVIDER = process.env.LLM_PROVIDER || 'groq';

// Score a lead using AI
const scoreLead = async (leadText, provider = DEFAULT_PROVIDER) => {
  const config = PROVIDERS[provider];
  
  if (!config) {
    throw new Error(`Unknown provider: ${provider}`);
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

    if (provider === 'openai' && openai) {
      // OpenAI
      response = await openai.chat.completions.create({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300
      });
      
      const content = response.choices[0].message.content;
      return parseAIResponse(content);
      
    } else if (provider === 'groq' && process.env.GROQ_API_KEY) {
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
        return ruleBasedScoring(leadText);
      }
    }
    
    // Fallback to rule-based if no AI available
    return ruleBasedScoring(leadText);
    
  } catch (error) {
    console.error(`AI scoring error (${provider}):`, error.message);
    return ruleBasedScoring(leadText);
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
  
  return ruleBasedScoring(content);
};

// Rule-based fallback (FREE - no AI needed)
const ruleBasedScoring = (text) => {
  const lower = text.toLowerCase();
  
  // Hot signals
  const hotSignals = [
    'urgent', 'asap', 'immediately', 'this week',
    '$50k', '$100k', '$500k', '$1m', 'budget',
    'hiring now', 'start monday', 'ready to buy',
    'decision made', 'approved budget'
  ];
  
  // Warm signals  
  const warmSignals = [
    'interested', 'looking for', 'considering',
    'evaluation', 'comparing', 'quote',
    'proposal', 'demo', 'pilot'
  ];
  
  let hotCount = hotSignals.filter(s => lower.includes(s)).length;
  let warmCount = warmSignals.filter(s => lower.includes(s)).length;
  
  // Check for budget mentions
  const budgetMatch = text.match(/\$[\d,]+(?:k|K)?|\$\d+(?:,\d{3})*/);
  const budgetSignal = budgetMatch ? budgetMatch[0] : null;
  
  // Determine score
  let score = 'cold';
  let reason = 'No strong buying signals detected';
  
  if (hotCount >= 2) {
    score = 'hot';
    reason = `Strong buying signals: ${hotCount} urgency indicators`;
  } else if (hotCount >= 1 || warmCount >= 2) {
    score = 'warm';
    reason = `Moderate interest: ${warmCount} positive signals`;
  }
  
  return {
    score,
    reason,
    confidence: hotCount >= 2 ? 85 : warmCount >= 2 ? 70 : 50,
    budgetSignal,
    urgencySignal: hotCount > 0 ? 'Urgency keywords detected' : null,
    method: 'rule-based'
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

module.exports = {
  scoreLead,
  getCostEstimate,
  testProviders,
  PROVIDERS,
  ruleBasedScoring // Export for direct use
};
