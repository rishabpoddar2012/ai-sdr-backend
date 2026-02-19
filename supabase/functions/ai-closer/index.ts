// AI Sales Closer - Pitch Generation Engine
// Generates personalized sales pitches using lead context

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// OpenAI API call
async function generateWithOpenAI(prompt, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert sales coach who writes highly personalized, persuasive sales pitches. Your pitches are specific, mention concrete details about the prospect, and include clear value propositions.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// Rule-based pitch generation (fallback when no OpenAI key)
function generateRuleBasedPitch(lead, playbook, template) {
  const companyName = lead.company_name || lead.tracked_companies?.name || 'your company'
  const contactName = lead.contact_name || 'there'
  const industry = lead.industry || 'your industry'
  
  // Build pitch based on signal type
  let opening = ''
  let valueProp = ''
  let socialProof = ''
  
  if (lead.signal_type === 'funding') {
    opening = `Hi ${contactName}, congrats on the recent funding news! I saw ${companyName} just raised capital. Most companies at your stage struggle with scaling their sales process efficiently.`
    valueProp = `We help ${industry} companies like yours build a predictable revenue engine without hiring 10 more sales reps.`
    socialProof = `Recently helped a similar company increase their conversion rate by 40% in just 60 days.`
  } else if (lead.signal_type === 'hiring') {
    opening = `Hi ${contactName}, noticed ${companyName} is actively hiring. Growing teams face unique challenges!`
    valueProp = `We specialize in helping fast-growing companies streamline their sales process so new hires can contribute from day one.`
    socialProof = `One of our clients reduced their sales onboarding time by 50% while doubling their team size.`
  } else if (lead.signal_type === 'expansion') {
    opening = `Hi ${contactName}, exciting to see ${companyName} expanding! That's a significant milestone.`
    valueProp = `We help expanding companies maintain their sales momentum while entering new markets.`
    socialProof = `Helped a company in a similar expansion phase hit their revenue targets 2 months early.`
  } else {
    opening = `Hi ${contactName}, reaching out because ${companyName} fits the profile of companies we help best.`
    valueProp = playbook?.value_props?.[0] || 'We help companies like yours grow revenue predictably.'
    socialProof = playbook?.case_studies?.[0] 
      ? `${playbook.case_studies[0].company} saw ${playbook.case_studies[0].result} with our approach.`
      : 'Our customers typically see 3x improvement in their sales metrics.'
  }
  
  return {
    pitch: `${opening}\n\n${valueProp}\n\n${socialProof}\n\nWorth a brief conversation to see if we can help ${companyName} achieve similar results?`,
    talking_points: [
      `Mention: ${companyName}'s recent ${lead.signal_type || 'growth'}`,
      'Focus on: Efficiency and scalability',
      'Avoid: Pricing discussion until value is established'
    ],
    points_to_avoid: [
      'Generic pitches without company specifics',
      'Leading with price',
      'Technical jargon'
    ]
  }
}

// Parse AI response into structured format
function parseAIResponse(aiText) {
  const sections = {
    pitch: '',
    email_subject: '',
    talking_points: [],
    points_to_avoid: [],
    objection_handlers: {},
    recommended_time: '',
    recommended_channel: ''
  }
  
  // Extract sections using regex
  const pitchMatch = aiText.match(/🎯\s*PITCH:?\s*([\s\S]*?)(?=💬|🛡️|⏰|$)/i)
  const subjectMatch = aiText.match(/📧\s*EMAIL SUBJECT:?\s*([\s\S]*?)(?=\n\n|💬|🎯|$)/i)
  const talkingMatch = aiText.match(/💬\s*TALKING POINTS:?\s*([\s\S]*?)(?=🛡️|⏰|$)/i)
  const avoidMatch = aiText.match(/❌\s*POINTS TO AVOID:?\s*([\s\S]*?)(?=🛡️|⏰|$)/i)
  const objectionMatch = aiText.match(/🛡️\s*OBJECTION HANDLING:?\s*([\s\S]*?)(?=⏰|$)/i)
  const timingMatch = aiText.match(/⏰\s*TIMING:?\s*([\s\S]*?)$/i)
  
  if (pitchMatch) sections.pitch = pitchMatch[1].trim()
  if (subjectMatch) sections.email_subject = subjectMatch[1].trim()
  
  if (talkingMatch) {
    sections.talking_points = talkingMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map(line => line.replace(/^[-•]\s*/, '').trim())
  }
  
  if (avoidMatch) {
    sections.points_to_avoid = avoidMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map(line => line.replace(/^[-•]\s*/, '').trim())
  }
  
  if (objectionMatch) {
    const objections = objectionMatch[1].split(/\n(?=If they say|When they say)/i)
    objections.forEach(obj => {
      const match = obj.match(/If they say["']?(.+?)["']?[:\n]/i)
      if (match) {
        const key = match[1].trim()
        const response = obj.replace(match[0], '').trim()
        sections.objection_handlers[key] = response
      }
    })
  }
  
  if (timingMatch) {
    const timing = timingMatch[1]
    const timeMatch = timing.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)
    if (timeMatch) sections.recommended_time = timeMatch[1]
    
    if (timing.toLowerCase().includes('call')) sections.recommended_channel = 'call'
    else if (timing.toLowerCase().includes('email')) sections.recommended_channel = 'email'
    else if (timing.toLowerCase().includes('linkedin')) sections.recommended_channel = 'linkedin'
  }
  
  return sections
}

// Generate comprehensive AI prompt
function buildPrompt(lead, playbook, intentSignal) {
  const context = {
    company: lead.company_name || lead.tracked_companies?.name || 'Unknown Company',
    contact: lead.contact_name || 'the decision maker',
    title: lead.contact_title || '',
    industry: lead.industry || playbook?.industry || 'their industry',
    signal: intentSignal?.signal_type || lead.signal_type || 'general',
    signal_details: intentSignal?.title || '',
    signal_description: intentSignal?.description || ''
  }
  
  let prompt = `Generate a highly personalized sales pitch for ${context.contact} at ${context.company}.\n\n`
  prompt += `CONTEXT:\n`
  prompt += `- Company: ${context.company}\n`
  prompt += `- Contact: ${context.contact}${context.title ? ` (${context.title})` : ''}\n`
  prompt += `- Industry: ${context.industry}\n`
  prompt += `- Recent Signal: ${context.signal}\n`
  if (context.signal_details) prompt += `- Signal Details: ${context.signal_details}\n`
  if (context.signal_description) prompt += `- Description: ${context.signal_description}\n`
  
  if (playbook) {
    prompt += `\nOUR VALUE PROPOSITIONS:\n`
    playbook.value_props?.forEach((prop, i) => {
      prompt += `${i + 1}. ${prop}\n`
    })
    
    if (playbook.case_studies?.length > 0) {
      prompt += `\nSOCIAL PROOF:\n`
      playbook.case_studies.slice(0, 2).forEach(cs => {
        prompt += `- ${cs.company}: ${cs.result}\n`
      })
    }
  }
  
  prompt += `\nGenerate the following:\n\n`
  prompt += `🎯 PITCH: A personalized opening pitch (2-3 paragraphs) that:\n`
  prompt += `   - References the specific signal/context\n`
  prompt += `   - Shows we understand their situation\n`
  prompt += `   - Presents relevant value proposition\n`
  prompt += `   - Includes soft call-to-action\n\n`
  prompt += `📧 EMAIL SUBJECT: A compelling subject line (under 50 chars)\n\n`
  prompt += `💬 TALKING POINTS: 3-5 specific points to mention\n\n`
  prompt += `❌ POINTS TO AVOID: 2-3 things NOT to mention\n\n`
  prompt += `🛡️ OBJECTION HANDLING: Responses to:\n`
  prompt += `   - "We already have a vendor"\n`
  prompt += `   - "We don't have budget"\n`
  prompt += `   - "Send me an email"\n\n`
  prompt += `⏰ TIMING: Best time/day to reach out and recommended channel (call/email)\n`
  
  return prompt
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

    // Get authenticated user
    const authHeader = req.headers.get('authorization')
    let userId = null
    
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.split(' ')[1])
      userId = user?.id
    }

    // ===== GENERATE PITCH =====
    if (path === '/api/ai-closer/generate' && method === 'POST') {
      const { lead_id, signal_id, playbook_id, use_ai = true } = await req.json()
      
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Fetch lead data
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select(`
          *,
          tracked_companies (name, domain, industry, employee_count)
        `)
        .eq('id', lead_id)
        .eq('user_id', userId)
        .single()

      if (leadError || !lead) {
        return new Response(
          JSON.stringify({ error: 'Lead not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Fetch intent signal if provided
      let intentSignal = null
      if (signal_id) {
        const { data: signal } = await supabase
          .from('intent_signals')
          .select('*')
          .eq('id', signal_id)
          .eq('user_id', userId)
          .single()
        intentSignal = signal
      }

      // Fetch playbook
      let playbook = null
      if (playbook_id) {
        const { data: pb } = await supabase
          .from('sales_playbooks')
          .select('*')
          .eq('id', playbook_id)
          .eq('user_id', userId)
          .single()
        playbook = pb
      } else {
        // Get default playbook
        const { data: pb } = await supabase
          .from('sales_playbooks')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .limit(1)
          .single()
        playbook = pb
      }

      // Generate pitch
      let generatedContent
      let aiModel = 'rule-based'
      let confidenceScore = 70

      const openAIKey = Deno.env.get('OPENAI_API_KEY')
      
      if (use_ai && openAIKey) {
        try {
          const prompt = buildPrompt(lead, playbook, intentSignal)
          const aiResponse = await generateWithOpenAI(prompt, openAIKey)
          generatedContent = parseAIResponse(aiResponse)
          aiModel = 'gpt-4'
          confidenceScore = 85
        } catch (aiError) {
          console.error('AI generation failed, falling back to rule-based:', aiError)
          generatedContent = generateRuleBasedPitch(lead, playbook, null)
        }
      } else {
        generatedContent = generateRuleBasedPitch(lead, playbook, null)
      }

      // Save generated pitch
      const { data: savedPitch, error: saveError } = await supabase
        .from('generated_pitches')
        .insert([{
          user_id: userId,
          lead_id: lead_id,
          lead_context: {
            lead: lead,
            signal: intentSignal,
            playbook: playbook
          },
          pitch_text: generatedContent.pitch,
          email_subject: generatedContent.email_subject,
          talking_points: generatedContent.talking_points,
          points_to_avoid: generatedContent.points_to_avoid,
          objection_handlers: generatedContent.objection_handlers,
          recommended_channel: generatedContent.recommended_channel,
          ai_model: aiModel,
          confidence_score: confidenceScore
        }])
        .select()
        .single()

      if (saveError) {
        console.error('Error saving pitch:', saveError)
      }

      return new Response(
        JSON.stringify({
          pitch: {
            id: savedPitch?.id,
            ...generatedContent,
            ai_model: aiModel,
            confidence_score: confidenceScore
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== GET GENERATED PITCHES =====
    if (path === '/api/ai-closer/pitches' && method === 'GET') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const leadId = url.searchParams.get('lead_id')
      
      let query = supabase
        .from('generated_pitches')
        .select(`
          *,
          leads (company_name, contact_name, score)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (leadId) {
        query = query.eq('lead_id', leadId)
      }

      const { data, error } = await query.limit(50)

      if (error) throw error

      return new Response(
        JSON.stringify({ pitches: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== GET OBJECTION HANDLERS =====
    if (path === '/api/ai-closer/objections' && method === 'GET') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const category = url.searchParams.get('category')
      
      let query = supabase
        .from('objection_templates')
        .select('*')
        .eq('user_id', userId)
        .order('success_rate', { ascending: false })

      if (category) {
        query = query.eq('category', category)
      }

      const { data, error } = await query.limit(20)

      if (error) throw error

      return new Response(
        JSON.stringify({ objections: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== GET PITCH TEMPLATES =====
    if (path === '/api/ai-closer/templates' && method === 'GET') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const category = url.searchParams.get('category')
      
      let query = supabase
        .from('pitch_templates')
        .select('*')
        .or(`user_id.eq.${userId},is_default.eq.true`)
        .order('usage_count', { ascending: false })

      if (category) {
        query = query.eq('category', category)
      }

      const { data, error } = await query

      if (error) throw error

      return new Response(
        JSON.stringify({ templates: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== SAVE PLAYBOOK =====
    if (path === '/api/ai-closer/playbook' && method === 'POST') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const playbookData = await req.json()
      playbookData.user_id = userId

      const { data, error } = await supabase
        .from('sales_playbooks')
        .insert([playbookData])
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ playbook: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== TRACK PITCH USAGE =====
    if (path === '/api/ai-closer/track-usage' && method === 'POST') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { pitch_id, outcome, notes } = await req.json()

      const { error } = await supabase
        .from('generated_pitches')
        .update({
          was_used: true,
          used_at: new Date().toISOString(),
          outcome: outcome,
          notes: notes
        })
        .eq('id', pitch_id)
        .eq('user_id', userId)

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true }),
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
