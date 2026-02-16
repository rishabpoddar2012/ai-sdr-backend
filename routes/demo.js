/**
 * Demo & Public Routes
 * Provides demo functionality without authentication
 * Live stats and sample leads
 */

const { Lead } = require('../models');
const { Op } = require('sequelize');

// Sample/demo leads for showcase
const SAMPLE_LEADS = [
  {
    id: 'demo-001',
    companyName: 'TechFlow AI',
    companyWebsite: 'https://techflow.ai',
    contactName: 'Sarah Chen',
    contactEmail: 'sarah@techflow.ai',
    contactLinkedIn: 'https://linkedin.com/in/sarahchen',
    score: 92,
    status: 'hot',
    source: 'angellist',
    intent: 'Recently raised Series A ($12M), hiring Head of Growth',
    signals: ['Recently Funded', 'Growth Hiring', 'Series A'],
    estimatedBudget: '$50k-100k/month',
    urgency: 'High',
    location: 'San Francisco, CA',
    industry: 'SaaS',
    companySize: '20-50',
    scrapedAt: new Date().toISOString()
  },
  {
    id: 'demo-002',
    companyName: 'Ecommerce Plus',
    companyWebsite: 'https://ecommerceplus.co',
    contactName: 'Mike Johnson',
    contactEmail: 'mike@ecommerceplus.co',
    score: 87,
    status: 'hot',
    source: 'twitter',
    intent: 'Looking for Facebook Ads agency, $30k/month budget mentioned',
    signals: ['Budget Mentioned', 'Active Search', 'Facebook Ads'],
    estimatedBudget: '$30k/month',
    urgency: 'Medium',
    location: 'New York, NY',
    industry: 'E-commerce',
    companySize: '10-20',
    scrapedAt: new Date().toISOString()
  },
  {
    id: 'demo-003',
    companyName: 'Apex Manufacturing',
    companyWebsite: 'https://apex-mfg.com',
    contactName: 'Raj Patel',
    contactEmail: 'raj@apex-mfg.com',
    contactPhone: '+91-98765-43210',
    score: 78,
    status: 'warm',
    source: 'indiamart',
    intent: 'Looking for digital marketing services for B2B lead generation',
    signals: ['B2B', 'Manufacturing', 'Digital Marketing'],
    estimatedBudget: '₹5-10 Lakh/month',
    urgency: 'Medium',
    location: 'Mumbai, India',
    industry: 'Manufacturing',
    companySize: '100-200',
    scrapedAt: new Date().toISOString()
  },
  {
    id: 'demo-004',
    companyName: 'ScaleUp Inc',
    companyWebsite: 'https://scaleup.io',
    contactName: 'Emily Watson',
    contactEmail: 'emily@scaleup.io',
    score: 85,
    status: 'hot',
    source: 'github_jobs',
    intent: 'Hiring Performance Marketing Manager, Series B company',
    signals: ['Series B', 'Hiring', 'Performance Marketing'],
    estimatedBudget: '$75k/month',
    urgency: 'High',
    location: 'Austin, TX',
    industry: 'SaaS',
    companySize: '50-100',
    scrapedAt: new Date().toISOString()
  },
  {
    id: 'demo-005',
    companyName: 'Global Textile Traders',
    companyWebsite: 'https://globaltextile.com',
    contactName: 'Amit Sharma',
    contactEmail: 'amit@globaltextile.com',
    contactPhone: '+91-99887-66554',
    score: 72,
    status: 'warm',
    source: 'tradeindia',
    intent: 'Exporter looking for international marketing agency',
    signals: ['Exporter', 'International', 'B2B'],
    estimatedBudget: '$10k/month',
    urgency: 'Low',
    location: 'Surat, India',
    industry: 'Textiles',
    companySize: '50-100',
    scrapedAt: new Date().toISOString()
  }
];

// Live stats (can be cached or faked for demo)
let LIVE_STATS = {
  totalLeadsCollected: 15420,
  leadsToday: 127,
  companiesHiring: 893,
  activeSearches: 2341,
  hotLeads: 1847,
  warmLeads: 5234,
  coldLeads: 8339,
  lastUpdated: new Date().toISOString()
};

// Niche presets
const NICHE_PRESETS = {
  'b2b-insurance': {
    id: 'b2b-insurance',
    name: 'B2B Insurance Agents',
    description: 'Find insurance agents looking for lead generation',
    icon: '🛡️',
    keywords: [
      'insurance leads',
      'life insurance marketing',
      'health insurance leads',
      'commercial insurance',
      'insurance agent marketing'
    ],
    sources: ['indiamart', 'reddit', 'twitter'],
    filters: {
      industries: ['insurance', 'financial services'],
      minScore: 60
    },
    emailTemplate: 'insurance_outreach'
  },
  'saas-founders': {
    id: 'saas-founders',
    name: 'SaaS Founders',
    description: 'Startups and SaaS companies hiring for growth',
    icon: '🚀',
    keywords: [
      'saas marketing',
      'b2b saas growth',
      'startup marketing',
      'product led growth',
      'saas customer acquisition'
    ],
    sources: ['angellist', 'github', 'hackernews'],
    filters: {
      industries: ['saas', 'software', 'technology'],
      fundingStages: ['seed', 'series a', 'series b'],
      minScore: 65
    },
    emailTemplate: 'saas_outreach'
  },
  'marketing-agencies': {
    id: 'marketing-agencies',
    name: 'Marketing Agencies',
    description: 'Agencies looking for white-label or partnership',
    icon: '📢',
    keywords: [
      'white label marketing',
      'marketing partnership',
      'agency collaboration',
      'outsourced ppc',
      'marketing reseller'
    ],
    sources: ['upwork', 'twitter', 'reddit'],
    filters: {
      businessTypes: ['agency', 'consultant'],
      minScore: 55
    },
    emailTemplate: 'agency_partnership'
  },
  'real-estate': {
    id: 'real-estate',
    name: 'Real Estate',
    description: 'Real estate agents and developers needing leads',
    icon: '🏠',
    keywords: [
      'real estate leads',
      'property marketing',
      'realtor advertising',
      'real estate ppc',
      'property developer marketing'
    ],
    sources: ['indiamart', 'twitter', 'reddit'],
    filters: {
      industries: ['real estate', 'property', 'construction'],
      minScore: 60
    },
    emailTemplate: 'realestate_outreach'
  },
  'manufacturing': {
    id: 'manufacturing',
    name: 'Manufacturing',
    description: 'Manufacturers looking for B2B marketing',
    icon: '🏭',
    keywords: [
      'manufacturing marketing',
      'industrial leads',
      'b2b manufacturing',
      'factory marketing',
      'industrial advertising'
    ],
    sources: ['tradeindia', 'indiamart', 'github'],
    filters: {
      industries: ['manufacturing', 'industrial'],
      businessTypes: ['manufacturer', 'exporter'],
      minScore: 55
    },
    emailTemplate: 'manufacturing_outreach'
  },
  'ecommerce': {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Online stores looking for performance marketing',
    icon: '🛒',
    keywords: [
      'shopify marketing',
      'ecommerce ppc',
      'facebook ads shopify',
      'google shopping ads',
      'amazon marketing'
    ],
    sources: ['twitter', 'reddit', 'upwork'],
    filters: {
      industries: ['ecommerce', 'retail', 'd2c'],
      platforms: ['shopify', 'woocommerce', 'magento'],
      minScore: 60
    },
    emailTemplate: 'ecommerce_outreach'
  }
};

/**
 * Get sample/demo leads (no auth required)
 */
const getDemoLeads = async (req, res) => {
  try {
    const { niche, limit = 5, format = 'json' } = req.query;
    
    let leads = [...SAMPLE_LEADS];
    
    // Filter by niche if specified
    if (niche && NICHE_PRESETS[niche]) {
      const preset = NICHE_PRESETS[niche];
      leads = leads.filter(lead => 
        preset.sources.includes(lead.source) ||
        preset.filters.industries?.some(ind => 
          lead.industry?.toLowerCase().includes(ind.toLowerCase())
        )
      );
    }
    
    // Limit results
    leads = leads.slice(0, parseInt(limit));
    
    // Format response
    if (format === 'csv') {
      const csv = convertToCsv(leads);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=demo-leads.csv');
      return res.send(csv);
    }
    
    res.json({
      success: true,
      data: {
        leads,
        isDemo: true,
        note: 'These are sample leads for demonstration. Sign up to access real leads.',
        totalAvailable: 15420
      }
    });
  } catch (error) {
    console.error('Demo leads error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get live stats (public)
 */
const getLiveStats = async (req, res) => {
  try {
    // In production, this would query the database
    // For demo, we increment the stats slightly to simulate activity
    
    const now = new Date();
    const lastUpdate = new Date(LIVE_STATS.lastUpdated);
    const minutesSinceUpdate = (now - lastUpdate) / 60000;
    
    // Simulate small increases
    if (minutesSinceUpdate > 5) {
      LIVE_STATS.leadsToday += Math.floor(Math.random() * 3);
      LIVE_STATS.totalLeadsCollected += Math.floor(Math.random() * 5);
      LIVE_STATS.lastUpdated = now.toISOString();
    }
    
    res.json({
      success: true,
      data: {
        ...LIVE_STATS,
        sources: {
          indiamart: { leads: 4234, lastScraped: '2 min ago' },
          angellist: { leads: 1892, lastScraped: '5 min ago' },
          github: { leads: 1234, lastScraped: '10 min ago' },
          twitter: { leads: 3456, lastScraped: '1 min ago' },
          tradeindia: { leads: 2104, lastScraped: '3 min ago' },
          hackernews: { leads: 1500, lastScraped: '15 min ago' }
        },
        isLive: true
      }
    });
  } catch (error) {
    console.error('Live stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get niche presets
 */
const getNichePresets = async (req, res) => {
  try {
    // Return summarized version for list
    const presets = Object.values(NICHE_PRESETS).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      icon: p.icon,
      keywords: p.keywords.slice(0, 3),
      estimatedLeads: Math.floor(Math.random() * 500) + 100
    }));
    
    res.json({
      success: true,
      data: { presets }
    });
  } catch (error) {
    console.error('Niche presets error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get specific niche preset details
 */
const getNichePreset = async (req, res) => {
  try {
    const { id } = req.params;
    const preset = NICHE_PRESETS[id];
    
    if (!preset) {
      return res.status(404).json({
        success: false,
        message: 'Niche preset not found'
      });
    }
    
    res.json({
      success: true,
      data: { preset }
    });
  } catch (error) {
    console.error('Niche preset error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Export leads (demo or real)
 */
const exportLeads = async (req, res) => {
  try {
    const { 
      format = 'csv', 
      destination = 'download',
      demo = false 
    } = req.body;
    
    let leads;
    
    if (demo) {
      leads = SAMPLE_LEADS;
    } else {
      // Would fetch from database with auth
      return res.status(401).json({
        success: false,
        message: 'Authentication required for real leads'
      });
    }
    
    if (format === 'csv') {
      const csv = convertToCsv(leads);
      
      if (destination === 'download') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
        return res.send(csv);
      }
      
      // Return as string for other destinations
      return res.json({
        success: true,
        data: { csv, count: leads.length }
      });
    }
    
    if (format === 'json') {
      return res.json({
        success: true,
        data: { leads, count: leads.length }
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Unsupported format'
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Preview export templates
 */
const getExportTemplates = async (req, res) => {
  try {
    const templates = [
      {
        id: 'csv-simple',
        name: 'CSV (Simple)',
        description: 'Basic CSV with essential fields',
        format: 'csv',
        fields: ['companyName', 'contactEmail', 'score', 'status'],
        icon: '📄'
      },
      {
        id: 'csv-full',
        name: 'CSV (Full)',
        description: 'Complete data export',
        format: 'csv',
        fields: ['companyName', 'companyWebsite', 'contactName', 'contactEmail', 'contactPhone', 'contactLinkedIn', 'score', 'status', 'source', 'intent', 'signals', 'estimatedBudget', 'location', 'industry'],
        icon: '📊'
      },
      {
        id: 'sheets',
        name: 'Google Sheets',
        description: 'Direct export to Google Sheets',
        format: 'sheets',
        webhook: '/webhooks/sheets',
        icon: '📗'
      },
      {
        id: 'airtable',
        name: 'Airtable',
        description: 'Export to Airtable base',
        format: 'airtable',
        webhook: '/webhooks/airtable',
        icon: '🗂️'
      },
      {
        id: 'n8n',
        name: 'n8n Workflow',
        description: 'Trigger n8n automation',
        format: 'webhook',
        webhook: '/webhooks/n8n',
        icon: '⚡'
      }
    ];
    
    res.json({
      success: true,
      data: { templates }
    });
  } catch (error) {
    console.error('Export templates error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Helper: Convert to CSV
const convertToCsv = (leads) => {
  if (leads.length === 0) return '';
  
  const headers = Object.keys(leads[0]);
  
  const rows = leads.map(lead =>
    headers.map(h => {
      const val = lead[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val).replace(/"/g, '\\"');
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  
  return [headers.join(','), ...rows].join('\n');
};

module.exports = {
  getDemoLeads,
  getLiveStats,
  getNichePresets,
  getNichePreset,
  exportLeads,
  getExportTemplates,
  SAMPLE_LEADS,
  NICHE_PRESETS
};