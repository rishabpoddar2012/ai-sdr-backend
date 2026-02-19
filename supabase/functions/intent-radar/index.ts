// Buying Intent Radar - Signal Detection Engine
// Supabase Edge Function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Signal detection algorithms
const SignalDetectors = {
  // Detect funding signals from text
  funding: (text) => {
    const patterns = [
      /raised\s+\$[\d,]+(?:\s*million)?/i,
      /series\s+[a-d]\s+round/i,
      /secured\s+\$[\d,]+\s+in\s+funding/i,
      /\$[\d,]+m?\s+(?:seed|angel|venture)/i,
      /valuation\s+of\s+\$[\d,]+/i
    ]
    
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        const amount = text.match(/\$[\d,]+(?:\.\d+)?(?:\s*million|M)?/i)
        return {
          detected: true,
          category: 'hot',
          confidence: 95,
          extracted_data: { amount: amount?.[0] || 'unknown' }
        }
      }
    }
    return { detected: false }
  },

  // Detect hiring signals
  hiring: (text) => {
    const patterns = [
      /hiring\s+(\d+)\s+\w+/i,
      /(?:join|we're looking for|we are looking for)\s+\w+/i,
      /(?:job opening|career opportunity|position available)/i,
      /(?:sdr|sales development|account executive|ae)\s+(?:needed|wanted|hiring)/i,
      /growing\s+(?:our|the)\s+team/i
    ]
    
    const salesRoles = ['sdr', 'sales', 'ae', 'account executive', 'bdr', 'business development']
    const isSalesHiring = salesRoles.some(role => text.toLowerCase().includes(role))
    
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return {
          detected: true,
          category: isSalesHiring ? 'hot' : 'warm',
          confidence: isSalesHiring ? 90 : 75,
          extracted_data: { role_type: isSalesHiring ? 'sales' : 'general' }
        }
      }
    }
    return { detected: false }
  },

  // Detect expansion/growth signals
  expansion: (text) => {
    const patterns = [
      /expanding\s+(?:to|into)\s+\w+/i,
      /new\s+office\s+in/i,
      /opening\s+\w+\s+headquarters/i,
      /launched\s+in\s+\w+/i,
      /entering\s+(?:the|new)\s+market/i
    ]
    
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return {
          detected: true,
          category: 'warm',
          confidence: 80,
          extracted_data: {}
        }
      }
    }
    return { detected: false }
  },

  // Detect competitor complaint signals
  complaint: (text) => {
    const negativePatterns = [
      /(?:terrible|awful|horrible|worst)\s+\w+/i,
      /(?:hate|dislike|frustrated|annoyed)\s+with/i,
      /(?:switching|moving|migrating)\s+(?:away|from)/i,
      /looking\s+for\s+alternatives/i,
      /(?:not|never)\s+recommend/i
    ]
    
    const competitorMentions = ['salesforce', 'hubspot', 'apollo', 'zoominfo', ' outreach']
    const hasCompetitor = competitorMentions.some(c => text.toLowerCase().includes(c))
    
    for (const pattern of negativePatterns) {
      if (pattern.test(text)) {
        return {
          detected: true,
          category: 'hot',
          confidence: hasCompetitor ? 95 : 85,
          extracted_data: { has_competitor_mention: hasCompetitor }
        }
      }
    }
    return { detected: false }
  },

  // Detect tech stack changes
  techChange: (text) => {
    const patterns = [
      /(?:implementing|adopting|switching\s+to)\s+\w+/i,
      /(?:new|migrated|upgraded)\s+(?:crm|platform|tool|software)/i,
      /(?:salesforce|hubspot|pipedrive|apollo)\s+\w+/i
    ]
    
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return {
          detected: true,
          category: 'warm',
          confidence: 75,
          extracted_data: {}
        }
      }
    }
    return { detected: false }
  }
}

// Main signal analysis function
function analyzeSignal(text, source) {
  const results = []
  
  for (const [type, detector] of Object.entries(SignalDetectors)) {
    const result = detector(text)
    if (result.detected) {
      results.push({
        type,
        category: result.category,
        confidence: result.confidence,
        ...result.extracted_data
      })
    }
  }
  
  // Return highest confidence signal
  if (results.length === 0) return null
  
  return results.sort((a, b) => b.confidence - a.confidence)[0]
}

// Main handler
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // ===== INTENT SIGNALS API =====

    // Get all intent signals for user
    if (path === '/api/intent-signals' && method === 'GET') {
      const { data: { user } } = await supabase.auth.getUser(
        req.headers.get('authorization')?.split(' ')[1] || ''
      )
      
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('intent_signals')
        .select(`
          *,
          tracked_companies (name, domain, industry)
        `)
        .eq('user_id', user.id)
        .order('detected_at', { ascending: false })
        .limit(100)

      if (error) throw error

      return new Response(
        JSON.stringify({ signals: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get unread count
    if (path === '/api/intent-signals/unread-count' && method === 'GET') {
      const { data: { user } } = await supabase.auth.getUser(
        req.headers.get('authorization')?.split(' ')[1] || ''
      )
      
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase.rpc('get_unread_signal_count', {
        p_user_id: user.id
      })

      if (error) throw error

      return new Response(
        JSON.stringify({ count: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mark signals as read
    if (path === '/api/intent-signals/mark-read' && method === 'POST') {
      const { data: { user } } = await supabase.auth.getUser(
        req.headers.get('authorization')?.split(' ')[1] || ''
      )
      
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { signal_ids } = await req.json()

      await supabase.rpc('mark_signals_read', {
        p_user_id: user.id,
        p_signal_ids: signal_ids
      })

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get hot leads this week
    if (path === '/api/intent-signals/hot-leads' && method === 'GET') {
      const { data: { user } } = await supabase.auth.getUser(
        req.headers.get('authorization')?.split(' ')[1] || ''
      )
      
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase.rpc('get_hot_leads_this_week', {
        p_user_id: user.id
      })

      if (error) throw error

      return new Response(
        JSON.stringify({ leads: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== COMPANY TRACKING API =====

    // Add company to track
    if (path === '/api/tracked-companies' && method === 'POST') {
      const { data: { user } } = await supabase.auth.getUser(
        req.headers.get('authorization')?.split(' ')[1] || ''
      )
      
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const companyData = await req.json()
      companyData.user_id = user.id

      const { data, error } = await supabase
        .from('tracked_companies')
        .insert([companyData])
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ company: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get tracked companies
    if (path === '/api/tracked-companies' && method === 'GET') {
      const { data: { user } } = await supabase.auth.getUser(
        req.headers.get('authorization')?.split(' ')[1] || ''
      )
      
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('tracked_companies')
        .select('*')
        .eq('user_id', user.id)
        .order('last_signal_at', { ascending: false, nullsFirst: false })

      if (error) throw error

      return new Response(
        JSON.stringify({ companies: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== SIGNAL ANALYSIS API =====

    // Analyze text for signals (test endpoint)
    if (path === '/api/analyze-signal' && method === 'POST') {
      const { text, source } = await req.json()
      
      const signal = analyzeSignal(text, source || 'manual')

      return new Response(
        JSON.stringify({ 
          signal,
          text,
          has_signal: signal !== null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== DASHBOARD STATS =====

    if (path === '/api/intent-dashboard' && method === 'GET') {
      const { data: { user } } = await supabase.auth.getUser(
        req.headers.get('authorization')?.split(' ')[1] || ''
      )
      
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get stats
      const [hotSignals, warmSignals, totalCompanies, unreadCount] = await Promise.all([
        supabase.from('intent_signals')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('signal_category', 'hot'),
        supabase.from('intent_signals')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('signal_category', 'warm'),
        supabase.from('tracked_companies')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase.rpc('get_unread_signal_count', { p_user_id: user.id })
      ])

      return new Response(
        JSON.stringify({
          stats: {
            hot_signals: hotSignals.count || 0,
            warm_signals: warmSignals.count || 0,
            total_companies: totalCompanies.count || 0,
            unread_signals: unreadCount.data || 0
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Default
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
