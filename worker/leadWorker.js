#!/usr/bin/env node
/**
 * AI SDR Lead Worker
 * Runs scrapers periodically and saves leads to database
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const cron = require('node-cron');
const { User, Lead } = require('../models');
const { Op } = require('sequelize');
const emailService = require('../services/email');

// Import scrapers (adjust paths based on actual location)
const hnScraper = require('../../ai_sdr/sources/hn_intent');
const redditScraper = require('../../ai_sdr/sources/reddit_jobs');
const upworkScraper = require('../../ai_sdr/sources/upwork_rss');

// Scraper configuration
const SCRAPERS = {
  hackernews: {
    name: 'Hacker News',
    enabled: true,
    scrape: () => hnScraper.collectHNLeads()
  },
  reddit: {
    name: 'Reddit',
    enabled: true,
    scrape: () => redditScraper.collectRedditLeads()
  },
  upwork: {
    name: 'Upwork',
    enabled: true,
    scrape: () => upworkScraper.collectUpworkLeads()
  }
};

/**
 * Check if lead matches user keywords
 */
function matchesKeywords(lead, keywords) {
  if (!keywords || keywords.length === 0) return true;
  
  const text = `${lead.title || ''} ${lead.text || ''} ${lead.intent || ''}`.toLowerCase();
  
  return keywords.some(keyword => 
    text.includes(keyword.toLowerCase())
  );
}

/**
 * Score a lead based on various signals
 */
function scoreLead(lead) {
  const signals = lead.signals || [];
  const text = `${lead.title || ''} ${lead.text || ''}`.toLowerCase();
  
  let scorePoints = 0;
  
  // Budget signals
  const budgetPatterns = [/'budget', 'spend', 'investment', '$', 'k', 'monthly', 'ad spend']/i];
  if (budgetPatterns.some(p => p.test(text))) scorePoints += 2;
  
  // Urgency signals
  const urgencyPatterns = [/asap/i, /urgent/i, /immediately/i, /this week/i, /right now/i];
  if (urgencyPatterns.some(p => p.test(text))) scorePoints += 2;
  
  // Platform-specific signals
  const platformSignals = ['Meta/Facebook Ads', 'Google Ads', 'Shopify', 'PPC', 'Performance focus'];
  const hasPlatformSignal = signals.some(s => 
    platformSignals.some(ps => s.toLowerCase().includes(ps.toLowerCase()))
  );
  if (hasPlatformSignal) scorePoints += 1;
  
  // Company type signals
  if (signals.includes('Startup')) scorePoints += 1;
  if (signals.includes('SaaS')) scorePoints += 1;
  if (signals.includes('E-commerce')) scorePoints += 1;
  
  // Determine score category
  if (scorePoints >= 4) return 'hot';
  if (scorePoints >= 2) return 'warm';
  return 'cold';
}

/**
 * Transform scraped lead to database format
 */
function transformLead(scrapedLead, userId) {
  const score = scoreLead(scrapedLead);
  
  return {
    userId,
    source: scrapedLead.source.replace('-', '_'),
    sourceUrl: scrapedLead.url,
    companyName: scrapedLead.companyName || scrapedLead.author || 'Unknown',
    companyWebsite: scrapedLead.companyWebsite || null,
    companySize: scrapedLead.companySize || null,
    companyIndustry: scrapedLead.companyIndustry || null,
    contactName: scrapedLead.contactName || null,
    contactTitle: scrapedLead.contactTitle || null,
    contactEmail: scrapedLead.contactEmail || null,
    contactLinkedIn: scrapedLead.contactLinkedIn || null,
    contactPhone: scrapedLead.contactPhone || null,
    intent: scrapedLead.title || scrapedLead.text?.substring(0, 200),
    description: scrapedLead.text,
    score: score,
    scoreReason: `Matched ${scrapedLead.signals?.length || 0} signals`,
    aiAnalysis: {
      signals: scrapedLead.signals || [],
      geo: scrapedLead.geo,
      budgetHint: scrapedLead.budgetHint
    },
    budgetSignal: scrapedLead.budgetHint || null,
    urgencySignal: scrapedLead.signals?.find(s => 
      /urgent|asap|immediately/i.test(s)
    ) || null,
    status: 'new',
    tags: scrapedLead.signals || [],
    rawData: scrapedLead.raw || scrapedLead
  };
}

/**
 * Check if lead already exists for user
 */
async function leadExists(sourceUrl, userId) {
  const existing = await Lead.findOne({
    where: {
      sourceUrl,
      userId
    }
  });
  return !!existing;
}

/**
 * Run scraper and collect leads
 */
async function runScraper(scraperKey, scraperConfig) {
  console.log(`🔍 Running ${scraperConfig.name} scraper...`);
  
  try {
    const leads = await scraperConfig.scrape();
    console.log(`✅ ${scraperConfig.name}: Found ${leads.length} leads`);
    return leads;
  } catch (error) {
    console.error(`❌ ${scraperConfig.name} scraper failed:`, error.message);
    return [];
  }
}

/**
 * Distribute leads to users based on keyword matching
 */
async function distributeLeads(allLeads) {
  console.log(`📬 Distributing ${allLeads.length} leads to users...`);
  
  // Get all active users
  const users = await User.findAll({
    where: {
      isActive: true,
      leadsUsedThisMonth: { [Op.lt]: Lead.sequelize.col('leadsLimit') }
    }
  });
  
  console.log(`👥 Found ${users.length} active users`);
  
  let totalAssigned = 0;
  const userNewLeads = new Map(); // Track new leads per user for notifications
  
  for (const user of users) {
    const userKeywords = user.keywords || ['marketing agency', 'growth'];
    const userSources = user.sourcesConfig || { hackerNews: true, reddit: true, upwork: true };
    
    const matchingLeads = allLeads.filter(lead => {
      // Check source is enabled
      const sourceKey = lead.source.replace('-', '_').toLowerCase();
      const isSourceEnabled = 
        (sourceKey.includes('hackernews') && userSources.hackerNews) ||
        (sourceKey.includes('reddit') && userSources.reddit) ||
        (sourceKey.includes('upwork') && userSources.upwork);
      
      if (!isSourceEnabled) return false;
      
      // Check keywords match
      return matchesKeywords(lead, userKeywords);
    });
    
    const userNewLeadsList = [];
    
    for (const lead of matchingLeads) {
      // Check if already exists
      if (await leadExists(lead.url, user.id)) {
        continue;
      }
      
      // Check user hasn't exceeded limit
      if (user.leadsUsedThisMonth >= user.leadsLimit) {
        console.log(`⚠️ User ${user.email} reached lead limit`);
        break;
      }
      
      try {
        // Transform and save lead
        const leadData = transformLead(lead, user.id);
        const savedLead = await Lead.create(leadData);
        
        // Update user's lead count
        user.leadsUsedThisMonth += 1;
        await user.save();
        
        userNewLeadsList.push(savedLead);
        totalAssigned++;
        
        // Send notification for hot leads
        if (savedLead.score === 'hot') {
          await emailService.sendLeadNotification(user, savedLead);
        }
      } catch (error) {
        console.error('Failed to save lead:', error.message);
      }
    }
    
    if (userNewLeadsList.length > 0) {
      userNewLeads.set(user.id, { user, leads: userNewLeadsList });
    }
    
    console.log(`  📨 ${user.email}: ${userNewLeadsList.length} new leads`);
  }
  
  // Send daily digest emails
  for (const { user, leads } of userNewLeads.values()) {
    await emailService.sendDailyDigest(user, leads);
  }
  
  console.log(`✅ Total leads assigned: ${totalAssigned}`);
  return totalAssigned;
}

/**
 * Main worker job
 */
async function runWorker() {
  console.log('\n🚀 Starting lead collection job...');
  console.log(`⏰ ${new Date().toISOString()}`);
  
  const allLeads = [];
  
  // Run all enabled scrapers
  for (const [key, config] of Object.entries(SCRAPERS)) {
    if (config.enabled) {
      const leads = await runScraper(key, config);
      allLeads.push(...leads);
    }
  }
  
  console.log(`📊 Total raw leads collected: ${allLeads.length}`);
  
  // Distribute leads to users
  if (allLeads.length > 0) {
    await distributeLeads(allLeads);
  }
  
  console.log('✅ Job completed\n');
}

/**
 * Reset monthly lead counters (run on 1st of each month)
 */
async function resetMonthlyCounters() {
  console.log('🔄 Resetting monthly lead counters...');
  
  try {
    await User.update(
      { leadsUsedThisMonth: 0 },
      { where: {} }
    );
    console.log('✅ Monthly counters reset');
  } catch (error) {
    console.error('Failed to reset counters:', error);
  }
}

// CLI mode - run once
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'reset') {
    resetMonthlyCounters().then(() => process.exit(0));
  } else if (command === 'test-email') {
    // Test email sending
    const testUser = { email: process.env.TEST_EMAIL || 'test@example.com', firstName: 'Test' };
    emailService.sendWelcomeEmail(testUser).then(() => process.exit(0));
  } else {
    // Run worker once
    runWorker().then(() => process.exit(0));
  }
}

// Scheduled mode - run via cron
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
  console.log('📅 Scheduling worker jobs...');
  
  // Run every hour
  cron.schedule('0 * * * *', runWorker);
  
  // Reset counters on 1st of each month at midnight
  cron.schedule('0 0 1 * *', resetMonthlyCounters);
  
  console.log('✅ Scheduled: Hourly lead collection + Monthly counter reset');
}

module.exports = {
  runWorker,
  resetMonthlyCounters,
  matchesKeywords,
  scoreLead,
  transformLead
};
