// Signal Collection Worker
// Runs periodically to collect intent signals from various sources
// Can be scheduled via Supabase Cron or external scheduler

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configuration
const CONFIG = {
  crunchbase_api_key: Deno.env.get('CRUNCHBASE_API_KEY'),
  twitter_bearer_token: Deno.env.get('X_BEARER_TOKEN'),
  openai_api_key: Deno.env.get('OPENAI_API_KEY'),
}

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

// ===== SIGNAL DETECTORS =====

class FundingSignalDetector {
  async detect(company) {
    try {
      // Check Crunchbase for funding news
      if (CONFIG.crunchbase_api_key) {
        const response = await fetch(
          `https://api.crunchbase.com/api/v4/entities/organizations/${company.domain}?field_ids=funding_total,funding_round`,
          { headers: { 'X-cb-user-key': CONFIG.crunchbase_api_key } }
        )
        
        if (response.ok) {
          const data = await response.json()
          const recentFunding = data.properties?.funding_round?.items?.[0]
          
          if (recentFunding && this.isRecent(recentFunding.announced_on)) {
            return {
              type: 'funding',
              category: 'hot',
              confidence: 95,
              title: `Raised ${recentFunding.money_raised?.value_usd || 'funding'}`,
              description: `${company.name} announced ${recentFunding.series || 'funding'} round`,
              source: 'crunchbase',
              source_url: `https://www.crunchbase.com/organization/${company.domain}`,
              detected_at: new Date().toISOString()
            }
          }
        }
      }
      
      return null
    } catch (error) {
      console.error('Funding detection error:', error)
      return null
    }
  }
  
  isRecent(dateString) {
    const date = new Date(dateString)
    const daysDiff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
    return daysDiff <= 7 // Within last week
  }
}

class HiringSignalDetector {
  async detect(company) {
    try {
      // Check LinkedIn job postings (simplified - would need proxy/scraper)
      const salesRoles = ['sales development', 'sdr', 'account executive', 'ae', 'bdr']
      
      // This is a placeholder - actual implementation would scrape job boards
      // or use LinkedIn API with proper authentication
      
      return null
    } catch (error) {
      console.error('Hiring detection error:', error)
      return null
    }
  }
}

class TwitterSignalDetector {
  async detect(company) {
    try {
      if (!CONFIG.twitter_bearer_token) return null
      
      // Search for company mentions + keywords
      const query = `"${company.name}" (hiring OR fundraising OR "series" OR "raised" OR "launched") -is:retweet`
      
      const response = await fetch(
        `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=10`,
        { headers: { 'Authorization': `Bearer ${CONFIG.twitter_bearer_token}` } }
      )
      
      if (!response.ok) return null
      
      const data = await response.json()
      
      if (data.data && data.data.length > 0) {
        const tweet = data.data[0]
        
        // Analyze tweet for signals
        const signal = this.analyzeTweet(tweet.text)
        
        if (signal) {
          return {
            type: signal.type,
            category: signal.category,
            confidence: signal.confidence,
            title: signal.title,
            description: tweet.text.substring(0, 200),
            source: 'twitter',
            source_url: `https://twitter.com/i/web/status/${tweet.id}`,
            detected_at: new Date().toISOString()
          }
        }
      }
      
      return null
    } catch (error) {
      console.error('Twitter detection error:', error)
      return null
    }
  }
  
  analyzeTweet(text) {
    const lower = text.toLowerCase()
    
    // Funding patterns
    if (/raised.*\$|series.*[a-d]|funding|valuation/i.test(text)) {
      return {
        type: 'funding',
        category: 'hot',
        confidence: 90,
        title: 'Funding announcement detected'
      }
    }
    
    // Hiring patterns
    if (/hiring|join our team|we're looking|careers? at/i.test(text)) {
      const isSales = /sales|sdr|ae|account executive/i.test(text)
      return {
        type: 'hiring',
        category: isSales ? 'hot' : 'warm',
        confidence: isSales ? 90 : 75,
        title: isSales ? 'Hiring sales team' : 'Actively hiring'
      }
    }
    
    // Expansion patterns
    if (/expanding|new office|launched in|entering/i.test(text)) {
      return {
        type: 'expansion',
        category: 'warm',
        confidence: 80,
        title: 'Business expansion'
      }
    }
    
    return null
  }
}

class CompetitorReviewDetector {
  async detect(company, competitors) {
    try {
      // Check G2/Capterra for negative reviews mentioning competitors
      // This would require scraping or API access
      
      for (const competitor of competitors) {
        // Look for reviews indicating switching
        const switchingKeywords = [
          'switching from',
          'moved away from',
          'left',
          'alternative to',
          'better than'
        ]
        
        // Placeholder - actual implementation would scrape review sites
      }
      
      return null
    } catch (error) {
      console.error('Review detection error:', error)
      return null
    }
  }
}

// ===== MAIN COLLECTION LOGIC =====

async function collectSignals() {
  console.log('🚀 Starting signal collection...')
  
  // Get all tracked companies
  const { data: companies, error: companiesError } = await supabase
    .from('tracked_companies')
    .select('*, users!inner(id)')
    .eq('is_target', true)
  
  if (companiesError) {
    console.error('Error fetching companies:', companiesError)
    return
  }
  
  console.log(`📊 Found ${companies.length} companies to track`)
  
  // Get all tracked competitors grouped by user
  const { data: competitors, error: compError } = await supabase
    .from('tracked_competitors')
    .select('*')
  
  if (compError) {
    console.error('Error fetching competitors:', compError)
  }
  
  // Group competitors by user
  const competitorsByUser = {}
  if (competitors) {
    for (const comp of competitors) {
      if (!competitorsByUser[comp.user_id]) {
        competitorsByUser[comp.user_id] = []
      }
      competitorsByUser[comp.user_id].push(comp)
    }
  }
  
  // Initialize detectors
  const detectors = [
    new FundingSignalDetector(),
    new HiringSignalDetector(),
    new TwitterSignalDetector(),
    new CompetitorReviewDetector()
  ]
  
  // Process each company
  let newSignals = 0
  
  for (const company of companies) {
    console.log(`🔍 Checking ${company.name}...`)
    
    const userCompetitors = competitorsByUser[company.user_id] || []
    
    for (const detector of detectors) {
      try {
        const signal = await detector.detect(company, userCompetitors)
        
        if (signal) {
          // Check if signal already exists (deduplication)
          const { data: existing } = await supabase
            .from('intent_signals')
            .select('id')
            .eq('company_id', company.id)
            .eq('signal_type', signal.type)
            .eq('title', signal.title)
            .gte('detected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h
            .limit(1)
          
          if (existing && existing.length > 0) {
            console.log(`  ⚠️ Signal already exists for ${company.name}`)
            continue
          }
          
          // Insert new signal
          const { error: insertError } = await supabase
            .from('intent_signals')
            .insert([{
              company_id: company.id,
              user_id: company.user_id,
              signal_type: signal.type,
              signal_category: signal.category,
              source: signal.source,
              source_url: signal.source_url,
              title: signal.title,
              description: signal.description,
              confidence_score: signal.confidence,
              detected_at: signal.detected_at
            }])
          
          if (insertError) {
            console.error('Error inserting signal:', insertError)
          } else {
            console.log(`  ✅ New ${signal.category} signal: ${signal.title}`)
            newSignals++
            
            // Update company's last_signal_at
            await supabase
              .from('tracked_companies')
              .update({ last_signal_at: new Date().toISOString() })
              .eq('id', company.id)
          }
        }
      } catch (error) {
        console.error(`Error processing ${company.name}:`, error)
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  console.log(`\n✅ Collection complete! Found ${newSignals} new signals.`)
  
  // Send digest emails if configured
  if (newSignals > 0) {
    await sendDigestEmails()
  }
}

async function sendDigestEmails() {
  // Get users with unread signals who want digests
  const { data: users, error } = await supabase
    .from('alert_preferences')
    .select('*, users!inner(email)')
    .eq('email_alerts', true)
  
  if (error || !users) return
  
  for (const pref of users) {
    // Get unread signals for user
    const { data: signals } = await supabase
      .from('intent_signals')
      .select(`
        *,
        tracked_companies (name, domain)
      `)
      .eq('user_id', pref.user_id)
      .eq('is_read', false)
      .order('detected_at', { ascending: false })
      .limit(10)
    
    if (!signals || signals.length === 0) continue
    
    // Send email (would use email service like SendGrid/Resend)
    console.log(`📧 Would send digest to ${pref.users.email} with ${signals.length} signals`)
  }
}

// Run collection
await collectSignals()

// Export for cron scheduling
export { collectSignals }
