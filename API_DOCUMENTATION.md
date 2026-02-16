# AI SDR API Documentation

## 🆓 FREE Tier - No AI Costs!

AI SDR now allows you to **bring your own AI API key** or use our **free rule-based scoring**.

---

## 🔑 Authentication

### Dashboard API (JWT)
For web dashboard, use JWT tokens obtained from login.

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

### Public API (API Key)
For n8n, Make.com, or external integrations, use API key.

```http
Authorization: Bearer YOUR_API_KEY
# or
X-API-Key: YOUR_API_KEY
```

Get your API key from Dashboard → Settings → API.

---

## 🎯 Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://api.aisdr.com` |
| Version 1 | `https://api.aisdr.com/v1` |

---

## 📊 Public API Endpoints

### Get Leads
```http
GET /v1/leads
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: new, contacted, qualified |
| `score` | string | Filter by score: hot, warm, cold |
| `source` | string | Filter by source: hacker_news, reddit, upwork |
| `limit` | number | Max results (default: 100, max: 1000) |
| `offset` | number | Pagination offset |
| `since` | ISO date | Leads after this date |
| `format` | string | `json` or `csv` |

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://api.aisdr.com/v1/leads?score=hot&limit=50"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "leads": [
      {
        "id": "uuid",
        "companyName": "Tech Startup",
        "contactName": "John Doe",
        "contactEmail": "john@example.com",
        "score": "hot",
        "status": "new",
        "source": "hacker_news",
        "createdAt": "2024-02-15T10:00:00Z"
      }
    ],
    "meta": {
      "total": 150,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### Get Lead Stats
```http
GET /v1/leads/stats
```

### Get Single Lead
```http
GET /v1/leads/:id
```

### Update Lead
```http
PUT /v1/leads/:id
```

**Body:**
```json
{
  "status": "contacted",
  "notes": "Called, interested in demo"
}
```

### Get API Usage
```http
GET /v1/usage
```

---

## 🤖 AI Provider Settings

### Get Current Settings
```http
GET /api/settings/ai
Authorization: Bearer JWT_TOKEN
```

### Update AI Provider
```http
PUT /api/settings/ai
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "aiProvider": "groq",
  "aiApiKey": "gsk_your_key_here",
  "aiModel": "llama3-8b-8192"
}
```

**Supported Providers:**

| Provider | Cost | Model Example |
|----------|------|---------------|
| `rule` | **FREE** | Built-in algorithm |
| `groq` | ~$0.25/1K leads | llama3-8b-8192 |
| `together` | ~$0.30/1K leads | Mixtral-8x7B |
| `openai` | ~$0.75/1K leads | gpt-3.5-turbo |
| `anthropic` | ~$0.50/1K leads | claude-3-haiku |
| `custom` | Varies | Your own endpoint |

### Test AI Connection
```http
POST /api/settings/ai/test
Authorization: Bearer JWT_TOKEN
```

---

## 🔗 n8n Integration

### Webhook (Real-time leads)
Set up webhook to receive new leads instantly.

**n8n Webhook Node:**
```
Method: POST
URL: https://api.aisdr.com/v1/webhooks/leads
Headers:
  Authorization: Bearer YOUR_API_KEY
```

**Response Body:**
```json
{
  "event": "new_lead",
  "lead": { ... },
  "timestamp": "2024-02-15T10:00:00Z"
}
```

### HTTP Request (Fetch leads)
```
Method: GET
URL: https://api.aisdr.com/v1/leads?score=hot&limit=10
Headers:
  Authorization: Bearer YOUR_API_KEY
```

### n8n Workflow Template

```json
{
  "name": "AI SDR - Hot Leads to Slack",
  "nodes": [
    {
      "type": "schedule",
      "parameters": {
        "rule": "every 1 hour"
      }
    },
    {
      "type": "httpRequest",
      "parameters": {
        "method": "GET",
        "url": "https://api.aisdr.com/v1/leads",
        "options": {
          "headers": {
            "Authorization": "=Bearer {{$env.AISDR_API_KEY}}"
          },
          "qs": {
            "score": "hot",
            "since": "={{ $now.minus({ hours: 1 }) }}"
          }
        }
      }
    },
    {
      "type": "slack",
      "parameters": {
        "channel": "#leads",
        "text": "=🎯 New Hot Lead: {{ $json.data.leads[0].companyName }}"
      }
    }
  ]
}
```

---

## 🔗 Make.com (Integromat) Integration

### HTTP Module
```
URL: https://api.aisdr.com/v1/leads
Method: GET
Headers:
  Authorization: Bearer YOUR_API_KEY
Query String:
  score: hot
  limit: 50
```

### Webhook Module
```
URL: https://api.aisdr.com/v1/webhooks/leads
Headers:
  Authorization: Bearer YOUR_API_KEY
```

---

## 💰 Cost Comparison

### Scenario: 1000 leads/month

| Provider | Your Cost | Notes |
|----------|-----------|-------|
| **Rule-based** | **$0** | Built-in, no API key |
| Groq | $0.25 | Bring your own key |
| Together | $0.30 | Bring your own key |
| OpenAI | $0.75 | Bring your own key |

**Recommendation:** Start with rule-based (FREE), upgrade when you have paying customers.

---

## 🔄 Webhook Events

Subscribe to real-time events by setting webhook URL in settings.

**Events:**
- `new_lead` - New lead discovered
- `lead_scored` - Lead scored (hot/warm/cold)
- `status_changed` - Lead status updated

**Payload:**
```json
{
  "event": "new_lead",
  "userId": "uuid",
  "lead": {
    "id": "uuid",
    "companyName": "...",
    "score": "hot",
    "source": "hacker_news"
  },
  "timestamp": "2024-02-15T10:00:00Z"
}
```

---

## 📈 Rate Limits

| Plan | Requests/Hour |
|------|---------------|
| Free | 1000 |
| Pro | 10000 |

Rate limit headers included in all responses:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1644931200
```

---

## ❌ Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad request |
| 401 | Unauthorized - Invalid API key |
| 403 | Forbidden - API disabled |
| 404 | Not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## 📚 Resources

- **Dashboard:** https://app.aisdr.com
- **Documentation:** https://docs.aisdr.com
- **Support:** support@aisdr.com

---

## 🚀 Quick Start

1. Sign up at https://aisdr.com
2. Get API key from Settings → API
3. Choose AI provider (or use FREE rule-based)
4. Connect to n8n/Make.com
5. Start receiving leads!

---

**Questions?** Contact us or check the dashboard help center.
