# AI SDR - Deployment Guide

## Quick Deploy (One Hour Setup)

### 1. Backend Deployment (Render)

1. **Create Render Account**: https://render.com
2. **New Web Service** → Connect GitHub → Select `ai-sdr-backend`
3. **Configure**:
   - Name: `ai-sdr-backend`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `node server.js`
   
4. **Add Environment Variables**:
   ```
   NODE_ENV=production
   PORT=10000
   DATABASE_URL=your_supabase_postgres_url
   JWT_SECRET=random_string_32_chars
   ENCRYPTION_KEY=random_string_32_chars
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   FRONTEND_URL=https://your-frontend.vercel.app
   API_BASE_URL=https://ai-sdr-backend.onrender.com
   ```

5. **Deploy** - Wait 5 minutes

### 2. Database Setup (Supabase)

1. **Create Supabase Project**: https://supabase.com
2. **Get Connection String**:
   - Settings → Database → Connection String (URI)
   - Copy `postgresql://...` URL
3. **Run Migrations**:
   ```bash
   cd ai-sdr-backend
   npx sequelize-cli db:migrate
   ```
4. **Seed Plans**:
   ```bash
   node seedPlans.js
   ```

### 3. Stripe Setup

1. **Create Stripe Account**: https://stripe.com
2. **Get API Keys**:
   - Developers → API Keys → Secret Key
3. **Create Products & Prices**:
   - Products → Add Product → "Pro Plan" → $49/month
   - Products → Add Product → "Enterprise Plan" → $199/month
   - Copy Price IDs (e.g., `price_123456...`)
4. **Webhook Setup**:
   - Developers → Webhooks → Add Endpoint
   - URL: `https://ai-sdr-backend.onrender.com/webhooks/stripe`
   - Events: `checkout.session.completed`, `invoice.payment_succeeded`, etc.
   - Copy Webhook Secret

### 4. Frontend Deployment (Vercel)

1. **Create Vercel Account**: https://vercel.com
2. **New Project** → Import GitHub → Select `ai-sdr-app`
3. **Configure**:
   - Framework: `Create React App`
   - Build Command: `npm run build`
   - Output Directory: `build`
   
4. **Add Environment Variable**:
   ```
   REACT_APP_API_URL=https://ai-sdr-backend.onrender.com
   ```

5. **Deploy** - Wait 2 minutes

### 5. Update CORS

Add your Vercel URL to backend CORS:
```javascript
// server.js
cors({
  origin: [
    'http://localhost:3000',
    'https://your-frontend.vercel.app'
  ],
  credentials: true
})
```

---

## Testing Checklist

- [ ] Signup works
- [ ] Onboarding flow completes
- [ ] Dashboard loads leads
- [ ] Billing page shows plans
- [ ] Can upgrade subscription
- [ ] Scraper settings save
- [ ] API keys generate

---

## Troubleshooting

**CORS Errors**: Add your frontend URL to backend CORS whitelist
**Database Errors**: Check DATABASE_URL format and permissions
**Stripe Errors**: Verify webhook URL and secret
**Build Failures**: Check Node version (use 18+)
