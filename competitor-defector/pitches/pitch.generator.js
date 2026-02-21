/**
 * Defector Pitch Generator
 * Generates personalized outreach messages for competitor defectors
 */

class PitchGenerator {
    constructor(config = {}) {
        this.aiProvider = config.aiProvider || 'openai';
        this.aiApiKey = config.aiApiKey || null;
        this.model = config.model || 'gpt-4';
        this.companyName = config.companyName || 'Our Company';
        this.companyValueProp = config.companyValueProp || '';
    }

    /**
     * Generate pitch for a defector lead
     * @param {Object} lead - Defector lead object
     * @param {Object} review - Source review
     * @param {string} pitchType - 'email', 'linkedin', 'cold_call'
     * @returns {Promise<Object>}
     */
    async generatePitch(lead, review, pitchType = 'email') {
        const painPoints = lead.pain_points || [];
        const desiredFeatures = lead.desired_features || [];
        const currentTool = lead.current_tool || 'their current solution';
        
        // Build context for AI
        const context = {
            lead: {
                company_name: lead.company_name,
                contact_name: lead.contact_name,
                industry: lead.industry,
                company_size: lead.company_size,
                defection_stage: lead.defection_stage,
                timeline: lead.timeline
            },
            pain_points: painPoints,
            desired_features: desiredFeatures,
            current_tool: currentTool,
            review_excerpt: review?.review_content?.substring(0, 500),
            defection_score: lead.defection_intent_score
        };
        
        // Generate based on pitch type
        switch (pitchType) {
            case 'email':
                return this.generateEmailPitch(context, lead);
            case 'linkedin':
                return this.generateLinkedInPitch(context, lead);
            case 'cold_call':
                return this.generateColdCallScript(context, lead);
            default:
                return this.generateEmailPitch(context, lead);
        }
    }

    /**
     * Generate email pitch
     * @param {Object} context 
     * @param {Object} lead 
     * @returns {Promise<Object>}
     */
    async generateEmailPitch(context, lead) {
        const subject = this.generateEmailSubject(context);
        
        // Use template-based approach if no AI key
        if (!this.aiApiKey) {
            return this.generateTemplateEmail(context, subject);
        }
        
        // AI-generated pitch
        try {
            const prompt = this.buildEmailPrompt(context);
            const body = await this.callAI(prompt);
            
            return {
                pitch_subject: subject,
                pitch_body: body,
                pitch_type: 'email',
                personalization_points: this.extractPersonalization(context),
                pain_point_addressed: context.pain_points[0] || 'general dissatisfaction',
                value_proposition: this.generateValueProp(context),
                ai_model: this.model,
                ai_prompt: prompt,
                generated_at: new Date().toISOString()
            };
        } catch (error) {
            console.error('[Pitch] AI generation failed, using template:', error);
            return this.generateTemplateEmail(context, subject);
        }
    }

    /**
     * Generate LinkedIn connection message
     * @param {Object} context 
     * @param {Object} lead 
     * @returns {Promise<Object>}
     */
    async generateLinkedInPitch(context, lead) {
        const message = this.generateLinkedInMessage(context);
        
        return {
            pitch_subject: '',
            pitch_body: message,
            pitch_type: 'linkedin',
            personalization_points: this.extractPersonalization(context),
            pain_point_addressed: context.pain_points[0],
            value_proposition: this.generateValueProp(context),
            generated_at: new Date().toISOString()
        };
    }

    /**
     * Generate cold call script
     * @param {Object} context 
     * @param {Object} lead 
     * @returns {Promise<Object>}
     */
    async generateColdCallScript(context, lead) {
        const script = this.generateCallScript(context);
        
        return {
            pitch_subject: 'Cold Call Script',
            pitch_body: script,
            pitch_type: 'cold_call_script',
            personalization_points: this.extractPersonalization(context),
            pain_point_addressed: context.pain_points[0],
            value_proposition: this.generateValueProp(context),
            generated_at: new Date().toISOString()
        };
    }

    /**
     * Generate email subject line
     * @param {Object} context 
     * @returns {string}
     */
    generateEmailSubject(context) {
        const subjects = [
            `Quick question about ${context.lead.company_name}'s ${context.current_tool} setup`,
            `Alternative to ${context.current_tool} for ${context.lead.industry || 'companies'} like yours`,
            `Saw your review - thought I'd reach out`,
            `${context.pain_points[0] ? `Solving "${context.pain_points[0].substring(0, 40)}..."` : 'A better solution'}`,
            `Switching from ${context.current_tool}?`,
            `${context.lead.company_name} + ${this.companyName}`,
            `Help with ${context.current_tool} migration`
        ];
        
        // Select based on defection stage and score
        if (context.defection_score >= 80) {
            return subjects[4]; // Direct switching question
        } else if (context.lead.defection_stage === 'researching') {
            return subjects[1]; // Alternative positioning
        } else if (context.pain_points.length > 0) {
            return subjects[3]; // Pain-point focused
        }
        
        return subjects[0];
    }

    /**
     * Generate template-based email
     * @param {Object} context 
     * @param {string} subject 
     * @returns {Object}
     */
    generateTemplateEmail(context, subject) {
        const { lead, pain_points, current_tool } = context;
        const firstName = lead.contact_name ? lead.contact_name.split(' ')[0] : 'there';
        
        const templates = [
            // Template 1: Pain-point focused
            {
                condition: pain_points.length > 0,
                body: `Hi ${firstName},

I noticed your team has been dealing with ${pain_points[0] || 'challenges'} with ${current_tool}. 

We help ${lead.industry || 'companies'} like ${lead.company_name} switch to a more reliable solution without the ${pain_points[1] || 'headaches'}.

${this.companyValueProp || 'Our platform is built specifically for teams looking to migrate away from legacy tools.'}

Worth a brief conversation to see if we're a fit?

Best,
[Your Name]`
            },
            // Template 2: Switching focused
            {
                condition: lead.defection_stage === 'evaluating',
                body: `Hi ${firstName},

I saw you're evaluating alternatives to ${current_tool}. 

Since you're comparing options, I'd love to show you why ${this.companyName} has become the go-to choice for ${lead.industry || 'teams'} making the switch.

Key differences our customers mention:
• ${this.getRandomBenefit()}
• ${this.getRandomBenefit()}
• ${this.getRandomBenefit()}

Can we schedule 15 minutes this week?

Best,
[Your Name]`
            },
            // Template 3: Review response
            {
                condition: !!context.review_excerpt,
                body: `Hi ${firstName},

I came across your review about ${current_tool} and wanted to reach out directly.

Your point about ${pain_points[0] || 'the challenges you mentioned'} really resonated - it's exactly why we built ${this.companyName}.

We've helped dozens of teams migrate from ${current_tool} and typically see:
• 40% reduction in ${pain_points[0] || 'manual work'}
• 2x faster ${lead.industry ? lead.industry.toLowerCase() : 'team'} workflows
• Much happier teams (and fewer support tickets)

Happy to share how ${lead.company_name} could achieve similar results.

Best,
[Your Name]`
            },
            // Template 4: General
            {
                condition: true,
                body: `Hi ${firstName},

Quick question: Is ${lead.company_name} still using ${current_tool}?

We've been helping similar ${lead.company_size || 'sized'} ${lead.industry || 'companies'} make the switch to a more modern solution.

${this.companyValueProp || 'Our customers typically save 10+ hours per week and see immediate ROI.'}

Open to a brief conversation about what you're looking for in your next solution?

Best,
[Your Name]`
            }
        ];
        
        // Find first matching template
        const template = templates.find(t => t.condition);
        
        return {
            pitch_subject: subject,
            pitch_body: template.body,
            pitch_type: 'email',
            personalization_points: this.extractPersonalization(context),
            pain_point_addressed: pain_points[0],
            value_proposition: this.generateValueProp(context),
            ai_model: 'template',
            generated_at: new Date().toISOString()
        };
    }

    /**
     * Generate LinkedIn connection message
     * @param {Object} context 
     * @returns {string}
     */
    generateLinkedInMessage(context) {
        const { lead, current_tool } = context;
        const firstName = lead.contact_name ? lead.contact_name.split(' ')[0] : '';
        
        const messages = [
            `Hi ${firstName}, saw you're evaluating alternatives to ${current_tool}. We help teams like ${lead.company_name} make that transition smoothly. Worth connecting?`,
            `Hi ${firstName}, noticed your experience with ${current_tool}. Would love to connect and share how others in ${lead.industry || 'your space'} have solved similar challenges.`,
            `Hi ${firstName}, I'm helping ${lead.industry || 'companies'} migrate from ${current_tool} to better solutions. Thought we might have common interests worth connecting over.`,
            `Hi ${firstName}, quick question - is ${lead.company_name} still on ${current_tool}? We specialize in helping teams like yours upgrade their stack.`
        ];
        
        return messages[Math.floor(Math.random() * messages.length)];
    }

    /**
     * Generate cold call script
     * @param {Object} context 
     * @returns {string}
     */
    generateCallScript(context) {
        const { lead, pain_points, current_tool } = context;
        
        return `
COLD CALL SCRIPT - ${lead.company_name}

OPENING (15 seconds):
"Hi ${lead.contact_name ? lead.contact_name.split(' ')[0] : 'there'}, this is [Your Name] from ${this.companyName}. 
Quick question - are you still using ${current_tool} at ${lead.company_name}?"

[IF YES]

PAIN AMPLIFICATION:
"I ask because we've been hearing from a lot of ${lead.industry || 'teams'} like yours that are dealing with ${pain_points[0] || 'limitations'} with ${current_tool}. 
Is that something you're running into as well?"

[LISTEN - Let them talk]

VALUE PROP:
"That makes sense. We've helped ${lead.industry || 'similar companies'} switch to ${this.companyName} and typically see:
• ${this.getRandomBenefit()}
• ${this.getRandomBenefit()}

Would it be worth a brief conversation to see if we could do the same for ${lead.company_name}?"

CLOSE:
"I have [Tuesday 2pm] or [Thursday 10am] open for 15 minutes. Which works better?"

[IF NO / NOT INTERESTED]

VOICEMAIL:
"Hi ${lead.contact_name ? lead.contact_name.split(' ')[0] : ''}, this is [Your Name] from ${this.companyName}. 
I'm calling because we help ${lead.industry || 'companies'} like ${lead.company_name} solve ${pain_points[0] || 'the challenges'} you're facing with ${current_tool}.

Give me a callback at [NUMBER] or I'll try you again tomorrow. Thanks!"

OBJECTION HANDLERS:

"We're locked into a contract"
→ "Totally understand. When does that expire? We can start the evaluation now so you're ready to switch immediately."

"We're happy with what we have"
→ "Glad to hear it! Just to clarify - are you happy with everything, or are there areas where ${current_tool} falls short?"

"Send me some information"
→ "Happy to. So I send the most relevant info - what's your biggest challenge with ${current_tool} right now?"

"Not the right person"
→ "No problem! Who handles your ${current_tool} evaluation or procurement decisions?"
`;
    }

    /**
     * Build AI prompt for email generation
     * @param {Object} context 
     * @returns {string}
     */
    buildEmailPrompt(context) {
        return `Write a personalized cold email to ${context.lead.contact_name || 'a decision maker'} at ${context.lead.company_name}.

CONTEXT:
- Company: ${context.lead.company_name} (${context.lead.industry || 'unknown industry'}, ${context.lead.company_size || 'unknown size'})
- Current tool: ${context.current_tool}
- Pain points: ${context.pain_points.join(', ') || 'general dissatisfaction'}
- Stage: ${context.lead.defection_stage || 'unknown'}
- Timeline: ${context.lead.timeline || 'unknown'}

${context.review_excerpt ? `REVIEW EXCERPT: "${context.review_excerpt}"` : ''}

ABOUT US:
${this.companyValueProp}

INSTRUCTIONS:
1. Keep it under 150 words
2. Reference their specific pain points
3. Show empathy for their situation
4. Include a clear, low-friction CTA
5. Be conversational, not salesy
6. No generic "hope you're doing well" openings

Write the email body only (no subject line):`;
    }

    /**
     * Call AI provider
     * @param {string} prompt 
     * @returns {Promise<string>}
     */
    async callAI(prompt) {
        if (this.aiProvider === 'openai') {
            const OpenAI = require('openai');
            const openai = new OpenAI({ apiKey: this.aiApiKey });
            
            const response = await openai.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 500
            });
            
            return response.choices[0].message.content.trim();
        }
        
        // Add support for other providers as needed
        throw new Error(`AI provider ${this.aiProvider} not supported`);
    }

    /**
     * Extract personalization points
     * @param {Object} context 
     * @returns {Array}
     */
    extractPersonalization(context) {
        const points = [];
        
        if (context.lead.company_name) points.push('company_name');
        if (context.lead.contact_name) points.push('contact_name');
        if (context.lead.industry) points.push('industry');
        if (context.pain_points.length > 0) points.push('pain_points');
        if (context.current_tool) points.push('current_tool');
        if (context.lead.timeline) points.push('timeline');
        
        return points;
    }

    /**
     * Generate value proposition
     * @param {Object} context 
     * @returns {string}
     */
    generateValueProp(context) {
        const props = [
            'Save 10+ hours per week with automation',
            '40% faster workflow completion',
            'Reduce operational costs by 30%',
            'Zero-downtime migration from legacy tools',
            'Dedicated onboarding for switching teams',
            '24/7 support with <5 minute response time'
        ];
        
        return props[Math.floor(Math.random() * props.length)];
    }

    /**
     * Get random benefit
     * @returns {string}
     */
    getRandomBenefit() {
        const benefits = [
            'Seamless data migration from your current tool',
            'Dedicated switching support team',
            'Better pricing with no hidden fees',
            'More intuitive user interface',
            'Better integration ecosystem',
            'Faster performance and reliability',
            'Superior customer support',
            'More flexible customization options'
        ];
        
        return benefits[Math.floor(Math.random() * benefits.length)];
    }

    /**
     * Save pitch to database
     * @param {Object} pitch 
 * @param {string} leadId 
 * @param {string} userId 
 * @param {Object} supabase 
 * @returns {Promise<Object>}
 */
    async savePitch(pitch, leadId, userId, supabase) {
        const { data, error } = await supabase
            .from('competitor_pitches')
            .insert({
                user_id: userId,
                defector_lead_id: leadId,
                ...pitch
            })
            .select()
            .single();
        
        if (error) {
            console.error('[Pitch] Error saving pitch:', error);
            throw error;
        }
        
        return data;
    }

    /**
     * Generate batch of pitches for multiple leads
     * @param {Array} leads 
 * @param {string} pitchType 
 * @returns {Promise<Array>}
 */
    async generateBatchPitches(leads, pitchType = 'email') {
        const pitches = [];
        
        for (const lead of leads) {
            try {
                const pitch = await this.generatePitch(lead, lead.review, pitchType);
                pitches.push({
                    lead_id: lead.id,
                    ...pitch
                });
            } catch (error) {
                console.error(`[Pitch] Error generating pitch for ${lead.id}:`, error);
            }
        }
        
        return pitches;
    }
}

module.exports = PitchGenerator;
