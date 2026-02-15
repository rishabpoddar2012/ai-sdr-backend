# 🤖 AI Scoring Options - Choose Your Provider

## 🆓 FREE Option (No API costs!)

### 1. Rule-Based Scoring (Built-in)
**Cost: $0**

Uses keyword matching and heuristics to score leads.

**How to enable:**
```env
LLM_PROVIDER=local
```

**Pros:**
- Completely free
- No API keys needed
- Instant (no latency)
- Works offline

**Cons:**
- Less nuanced than AI
- May miss subtle intent signals

**Best for:** Starting out, testing, low budget

---

## 💰 CHEAP API Options

### 2. Groq (Recommended)
**Cost: $0.0005 per 1K tokens (~$0.00025 per lead)**
**Savings: 3x cheaper than OpenAI**

**Sign up:** https://console.groq.com
**Model:** Llama 3 8B (very fast!)

**How to enable:**
```env
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
```

**Pros:**
- Very cheap
- Extremely fast (120+ tokens/sec)
- Good quality for lead scoring
- Free tier: $200 credits

**Cons:**
- Rate limits on free tier
- Newer provider

**Cost for 1000 leads:** ~$0.25

---

### 3. Together AI
**Cost: $0.0006 per 1K tokens**
**Savings: 2.5x cheaper than OpenAI**

**Sign up:** https://api.together.xyz
**Model:** Mixtral 8x7B

**How to enable:**
```env
LLM_PROVIDER=together
TOGETHER_API_KEY=...
```

**Pros:**
- Cheap
- Multiple model options
- Good for scaling

**Cons:**
- Slightly slower than Groq

**Cost for 1000 leads:** ~$0.30

---

## 💳 PREMIUM Option

### 4. OpenAI (Original)
**Cost: $0.0015 per 1K tokens**

**Sign up:** https://platform.openai.com
**Model:** GPT-3.5 Turbo

**How to enable:**
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

**Pros:**
- Best quality
- Most reliable
- Well-documented

**Cons:**
- Most expensive
- Can be slow at times

**Cost for 1000 leads:** ~$0.75

---

## 🖥️ SELF-HOSTED (Advanced)

### 5. Local LLM with Ollama
**Cost: $0 (runs on your server)**

**Setup:**
```bash
# Install Ollama
curl https://ollama.ai/install.sh | sh

# Pull model
ollama pull llama3

# Run server
ollama serve
```

**How to enable:**
```env
LLM_PROVIDER=local
LOCAL_LLM_URL=http://localhost:11434/v1
```

**Pros:**
- Completely free
- No rate limits
- Private (data stays local)
- Works offline

**Cons:**
- Requires GPU for speed
- More complex setup
- Higher server costs

**Best for:** High volume, privacy concerns

---

## 📊 Cost Comparison (1000 leads/month)

| Provider | Cost | Quality | Speed | Setup |
|----------|------|---------|-------|-------|
| **Rule-based** | $0 | ⭐⭐⭐ | ⚡⚡⚡ | Easy |
| **Groq** | $0.25 | ⭐⭐⭐⭐ | ⚡⚡⚡⚡⚡ | Easy |
| **Together** | $0.30 | ⭐⭐⭐⭐ | ⚡⚡⚡ | Easy |
| **OpenAI** | $0.75 | ⭐⭐⭐⭐⭐ | ⚡⚡ | Easy |
| **Local** | $0* | ⭐⭐⭐⭐ | ⚡ | Hard |

*Server costs apply

---

## 🎯 RECOMMENDATION

### For Starting Out (No budget):
```env
LLM_PROVIDER=local
```
Use rule-based scoring. It's free and works well enough.

### For Production (Best value):
```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_key_here
```
3x cheaper than OpenAI, very fast, good quality.

### For Best Quality:
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```
If you need the absolute best accuracy and don't mind the cost.

---

## 🔧 How to Switch

1. Update `.env` file with new provider
2. Add the corresponding API key
3. Restart server
4. New leads will use the new provider

**Note:** Existing leads keep their original scores. Only new leads use the new provider.

---

## 🧪 Testing Different Providers

Use the test endpoint:
```bash
curl -X POST https://your-api.com/api/test/scoring \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"text": "Looking for marketing agency. Budget $50K. Start ASAP."}'
```

This tests all providers and returns comparison results.

---

## 💡 Pro Tips

1. **Start with rule-based** → Free, get first customers
2. **Switch to Groq** when you have 10+ paying customers
3. **Consider OpenAI** only if accuracy becomes an issue
4. **Monitor costs weekly** in your provider dashboard

---

## 🔗 Quick Links

- **Groq Console:** https://console.groq.com
- **Together AI:** https://api.together.xyz
- **OpenAI Platform:** https://platform.openai.com
- **Ollama:** https://ollama.ai

---

**Default in your backend:** Rule-based (free) if no API key provided.

**Recommendation:** Get Groq free tier ($200 credits) → lasts 800K+ leads!
