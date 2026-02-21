#!/usr/bin/env node
/**
 * Competitor Defector Detector CLI
 * Command-line interface for running detection tasks
 */

require('dotenv').config();
const CompetitorDefectorDetector = require('./detector');

const detector = new CompetitorDefectorDetector();

const commands = {
    /**
     * Scrape competitors for a user
     */
    async scrape(args) {
        const userId = args[0] || process.env.USER_ID;
        const competitor = args.find(a => a.startsWith('--competitor='))?.split('=')[1];
        
        if (!userId) {
            console.error('Error: userId required. Set USER_ID env var or pass as argument.');
            process.exit(1);
        }
        
        console.log(`Starting scrape for user ${userId}...`);
        
        const options = {
            sources: ['g2', 'capterra']
        };
        
        if (competitor) {
            // Get specific competitor
            const { data } = await detector.supabase
                .from('competitors')
                .select('*')
                .eq('user_id', userId)
                .ilike('name', `%${competitor}%`);
            
            options.competitors = data || [];
        }
        
        const results = await detector.runDetection(userId, options);
        
        console.log('\n=== SCRAPE RESULTS ===');
        console.log(`Reviews scraped: ${results.scraped}`);
        console.log(`Defectors detected: ${results.detected}`);
        console.log(`Leads created: ${results.leads_created}`);
        console.log(`Alerts sent: ${results.alerts_sent}`);
        
        if (results.errors.length > 0) {
            console.log('\nErrors:');
            results.errors.forEach(e => console.log(`  - ${e}`));
        }
    },

    /**
     * Process unprocessed reviews
     */
    async process(args) {
        const userId = args[0] || process.env.USER_ID;
        
        if (!userId) {
            console.error('Error: userId required');
            process.exit(1);
        }
        
        console.log(`Processing unprocessed reviews for user ${userId}...`);
        
        const results = await detector.processUnprocessedReviews(userId);
        
        console.log('\n=== PROCESSING RESULTS ===');
        console.log(`Defectors found: ${results.defectorsFound}`);
        console.log(`Leads created: ${results.leadsCreated}`);
        console.log(`Alerts sent: ${results.alertsSent}`);
    },

    /**
     * Monitor and send alerts
     */
    async monitor(args) {
        const userId = args[0] || process.env.USER_ID;
        
        if (!userId) {
            console.error('Error: userId required');
            process.exit(1);
        }
        
        console.log(`Starting monitor for user ${userId}...`);
        
        // Get unread alerts
        const alerts = await detector.alertSystem.getUnreadAlerts(userId);
        
        console.log(`Found ${alerts.length} unread alerts`);
        
        alerts.forEach(alert => {
            console.log(`\n[${alert.severity.toUpperCase()}] ${alert.alert_type}`);
            console.log(alert.message);
        });
    },

    /**
     * Generate pitches for leads
     */
    async pitches(args) {
        const userId = args[0] || process.env.USER_ID;
        const pitchType = args.find(a => a.startsWith('--type='))?.split('=')[1] || 'email';
        
        if (!userId) {
            console.error('Error: userId required');
            process.exit(1);
        }
        
        console.log(`Generating ${pitchType} pitches for user ${userId}...`);
        
        // Get leads needing pitches
        const leads = await detector.getLeadsNeedingPitches(userId, 5);
        
        console.log(`Found ${leads.length} leads needing pitches`);
        
        for (const lead of leads) {
            try {
                console.log(`\nGenerating pitch for ${lead.company_name}...`);
                
                const pitch = await detector.generateLeadPitch(lead.id, pitchType);
                
                console.log('\n=== GENERATED PITCH ===');
                console.log(`Subject: ${pitch.pitch_subject}`);
                console.log('\nBody:');
                console.log(pitch.pitch_body);
                console.log('=======================\n');
            } catch (error) {
                console.error(`Error generating pitch for ${lead.id}:`, error.message);
            }
        }
    },

    /**
     * Add a competitor
     */
    async addCompetitor(args) {
        const userId = args[0] || process.env.USER_ID;
        const name = args[1];
        const g2Slug = args.find(a => a.startsWith('--g2='))?.split('=')[1];
        const capterraSlug = args.find(a => a.startsWith('--capterra='))?.split('=')[1];
        
        if (!userId || !name) {
            console.error('Error: userId and competitor name required');
            process.exit(1);
        }
        
        const competitor = await detector.addCompetitor({
            user_id: userId,
            name,
            g2_slug: g2Slug,
            capterra_slug: capterraSlug,
            is_active: true
        });
        
        console.log('Competitor added:', competitor);
    },

    /**
     * Show help
     */
    help() {
        console.log(`
Competitor Defector Detector CLI

Usage: node cli.js <command> [options]

Commands:
  scrape <userId> [--competitor=name]   Scrape reviews for user's competitors
  process <userId>                      Process unprocessed reviews
  monitor <userId>                      Check and display alerts
  pitches <userId> [--type=email]       Generate pitches for leads
  add-competitor <userId> <name>        Add competitor to monitor
  help                                  Show this help

Environment Variables:
  SUPABASE_URL          Supabase project URL
  SUPABASE_SERVICE_KEY  Supabase service role key
  OPENAI_API_KEY        OpenAI API key (for AI pitches)
  USER_ID               Default user ID

Examples:
  node cli.js scrape user-123
  node cli.js scrape user-123 --competitor=salesforce
  node cli.js pitches user-123 --type=linkedin
  node cli.js add-competitor user-123 "Salesforce" --g2=salesforce-crm
        `);
    }
};

// Run command
const [,, cmd, ...args] = process.argv;

if (!cmd || cmd === 'help') {
    commands.help();
} else if (commands[cmd]) {
    commands[cmd](args).catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
} else {
    console.error(`Unknown command: ${cmd}`);
    commands.help();
    process.exit(1);
}
