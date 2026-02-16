// Supabase Edge Function - Main API
// This runs on Deno at the edge

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Enhanced rule-based scoring (FREE - no AI needed)
function scoreLead(text) {
  const lower = text.toLowerCase();
  
  const hotSignals = [
    'urgent', 'asap', 'immediately', 'this week', 'today',
    'hiring now', 'start asap', '$50k', '$100k', '$500k',
    'budget approved', 'series a', 'series b', 'decision made'
  ];
  
  const warmSignals = [
    'interested', 'looking for', 'seeking', 'considering',
    'evaluation', 'comparing', 'quote', 'proposal'
  ];
  
  let hotCount = hotSignals.filter(s => lower.includes(s)).length;
  let warmCount = warmSignals.filter(s => lower.includes(s)).length;
  
  const budgetMatch = text.match(/\$[\d,]+(?:k|K)?/);
  
  if (hotCount >= 2) {
    return { score: 'hot', confidence: 90, reason: 'Strong buying signals detected' };
  } else if (hotCount >= 1 || warmCount >= 2) {
    return { score: 'warm', confidence: 75, reason: 'Moderate interest detected' };
  }
  
  return { score: 'cold', confidence: 50, reason: 'No strong signals' };
}

// Main handler
serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Health check
    if (path === '/health') {
      return new Response(
        JSON.stringify({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Register
    if (path === '/api/auth/register' && method === 'POST') {
      const { email, password, firstName, lastName } = await req.json();
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      
      const { data, error } = await supabase
        .from('users')
        .insert([{ 
          email, 
          password: hashedPassword,
          first_name: firstName,
          last_name: lastName
        }])
        .select('id, email, api_key')
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: { user: data } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Login
    if (path === '/api/auth/login' && method === 'POST') {
      const { email, password } = await req.json();
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify password
      const valid = await verifyPassword(password, data.password);
      if (!valid) {
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate JWT
      const token = await generateJWT(data.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: { 
            user: { 
              id: data.id, 
              email: data.email,
              apiKey: data.api_key 
            }, 
            token 
          } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test scoring
    if (path === '/api/test/scoring' && method === 'POST') {
      const { text } = await req.json();
      const result = scoreLead(text);
      
      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: not found
    return new Response(
      JSON.stringify({ success: false, message: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper functions
async function hashPassword(password) {
  // Simple hash for demo - use bcrypt in production
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function verifyPassword(password, hash) {
  const computed = await hashPassword(password);
  return computed === hash;
}

async function generateJWT(userId) {
  // Simple JWT implementation
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ 
    sub: userId, 
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  }));
  const signature = btoa(await hashPassword(header + '.' + payload));
  return `${header}.${payload}.${signature}`;
}
