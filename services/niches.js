/**
 * Niche Configuration System
 * Pre-built and custom niche templates for lead generation
 */

const NICHE_TEMPLATES = {
  // Marketing & Agencies
  'performance-marketing': {
    name: 'Performance Marketing Agency',
    description: 'Find businesses looking for paid ads, PPC, and performance marketing',
    keywords: [
      'facebook ads', 'meta ads', 'google ads', 'ppc', 'performance marketing',
      'paid media', 'shopify marketing', 'roas', 'cpm', 'cpc', 'conversion rate'
    ],
    sources: {
      hackerNews: true,
      reddit: true,
      upwork: true,
      linkedin: true
    },
    subreddits: ['forhire', 'startups', 'shopify', 'ecommerce', 'marketing'],
    buyerIntent: [
      /looking for (?:a )?(?:marketing )?agency/i,
      /need (?:help with )?(?:facebook|google|meta) ads/i,
      /hiring (?:a )?(?:ppc|paid media) (?:expert|agency|specialist)/i,
      /(?:low|poor) roas/i,
      /need to scale (?:ads|campaigns)/i
    ],
    scoringWeights: {
      budget: ['$5k', '$10k', '$50k', '$100k', 'budget', 'spend'],
      urgency: ['asap', 'urgent', 'immediately', 'this week', 'hiring now'],
      intent: ['agency', 'hire', 'looking for', 'need help']
    }
  },

  // B2B Insurance
  'b2b-insurance': {
    name: 'B2B Insurance',
    description: 'Find businesses looking for commercial insurance, liability coverage, and employee benefits',
    keywords: [
      'business insurance', 'commercial insurance', 'liability insurance',
      'workers compensation', 'employee benefits', 'group health insurance',
      'professional liability', 'e&o insurance', 'd&o insurance',
      'cyber insurance', 'business owner policy', 'bop'
    ],
    sources: {
      hackerNews: true,
      reddit: true,
      upwork: false,
      linkedin: true
    },
    subreddits: ['smallbusiness', 'startups', 'entrepreneur', 'consulting'],
    buyerIntent: [
      /need (?:business|commercial) insurance/i,
      /looking for (?:liability|workers comp) (?:insurance|coverage)/i,
      /(?:employee|group) benefits/i,
      /just incorporated/i,
      /hiring (?:first )?employees/i,
      /liability coverage/i
    ],
    scoringWeights: {
      budget: ['$100k revenue', '$1m', 'funding', 'series a', 'series b'],
      urgency: ['need asap', 'before launch', 'compliance required'],
      intent: ['insurance broker', 'insurance agent', 'coverage', 'policy']
    }
  },

  // Commodity Buyers
  'commodity-buyers': {
    name: 'Commodity Buyers',
    description: 'Find businesses looking to buy commodities in bulk',
    keywords: [
      'bulk purchase', 'wholesale', 'commodity buyer', 'raw materials',
      'supplier needed', 'vendor required', 'bulk order', 'import',
      'procurement', 'sourcing', 'b2b supplier'
    ],
    sources: {
      hackerNews: false,
      reddit: true,
      upwork: false,
      linkedin: true
    },
    subreddits: ['smallbusiness', 'manufacturing', 'import', 'wholesale'],
    buyerIntent: [
      /looking for (?:a )?supplier/i,
      /need (?:to source|to buy) (?:bulk|wholesale)/i,
      /(?:raw materials|commodities) needed/i,
      /procurement (?:manager|team)/i,
      /bulk order/i
    ],
    scoringWeights: {
      budget: ['container', 'tons', 'kg', 'metric tons', 'bulk'],
      urgency: ['immediate need', 'urgent requirement', 'asap'],
      intent: ['supplier', 'vendor', 'manufacturer', 'wholesaler']
    }
  },

  // SaaS/Tech Hiring
  'saas-hiring': {
    name: 'SaaS/Tech Hiring',
    description: 'Find tech companies actively hiring (signals growth and budget)',
    keywords: [
      'hiring', 'we are hiring', 'join our team', 'open positions',
      'software engineer', 'sales development', 'customer success',
      'product manager', 'devops', 'full stack'
    ],
    sources: {
      hackerNews: true,
      reddit: true,
      upwork: false,
      linkedin: true
    },
    subreddits: ['startups', 'SaaS', 'techjobs', 'cofounder'],
    buyerIntent: [
      /(?:we're|we are) hiring/i,
      /(?:join|come work with) our team/i,
      /(?:series a|series b|series c) (?:funded|raised)/i,
      /(?:looking for|hiring) (?:sales|marketing|growth)/i,
      /(?:scale|grow|expand) (?:team|sales|marketing)/i
    ],
    scoringWeights: {
      budget: ['$5m', '$10m', '$50m', 'series a', 'series b', 'funded'],
      urgency: ['immediate hire', 'start asap', 'urgent'],
      intent: ['hiring', 'join us', 'open role', 'position']
    }
  },

  // Real Estate Investors
  'real-estate-investors': {
    name: 'Real Estate Investors',
    description: 'Find real estate investors and property buyers',
    keywords: [
      'real estate investor', 'property investment', 'buying property',
      'investment property', 'rental property', 'fix and flip',
      'commercial real estate', 'multifamily', 'reits'
    ],
    sources: {
      hackerNews: false,
      reddit: true,
      upwork: false,
      linkedin: true
    },
    subreddits: ['realestateinvesting', 'realestate', 'landlord', 'flipping'],
    buyerIntent: [
      /looking to (?:buy|invest in) (?:property|real estate)/i,
      /(?:seeking|need) (?:investment|rental) (?:property|properties)/i,
      /(?:cash buyer|cash on hand)/i,
      /(?:cap rate|roi|cash flow) (?:looking for|minimum)/i
    ],
    scoringWeights: {
      budget: ['$500k', '$1m', '$5m', 'cash buyer', 'all cash'],
      urgency: ['ready to buy', 'immediate purchase', 'close quickly'],
      intent: ['investor', 'buyer', 'acquisition', 'portfolio']
    }
  },

  // Manufacturing/Industrial
  'manufacturing': {
    name: 'Manufacturing & Industrial',
    description: 'Find manufacturers looking for equipment, suppliers, or services',
    keywords: [
      'manufacturing', 'factory equipment', 'industrial machinery',
      'production line', 'automation', 'cnc machine', '3d printing',
      'injection molding', 'sheet metal', 'fabrication'
    ],
    sources: {
      hackerNews: false,
      reddit: true,
      upwork: false,
      linkedin: true
    },
    subreddits: ['manufacturing', 'machinists', 'engineering', 'automation'],
    buyerIntent: [
      /looking for (?:manufacturer|fabricator)/i,
      /need (?:cnc|machining|fabrication) (?:services|work)/i,
      /(?:buying|sourcing) (?:equipment|machinery)/i,
      /production (?:capacity|capabilities)/i
    ],
    scoringWeights: {
      budget: ['$100k', '$500k', '$1m', 'capital expenditure', 'capex'],
      urgency: ['production deadline', 'line down', 'urgent need'],
      intent: ['supplier', 'vendor', 'contract manufacturer', 'oem']
    }
  }
};

// Get all available niches
const getAvailableNiches = () => {
  return Object.entries(NICHE_TEMPLATES).map(([id, template]) => ({
    id,
    name: template.name,
    description: template.description
  }));
};

// Get niche configuration
const getNicheConfig = (nicheId) => {
  return NICHE_TEMPLATES[nicheId] || null;
};

// Apply niche configuration to user
const applyNicheToUser = (user, nicheId, customizations = {}) => {
  const config = getNicheConfig(nicheId);
  if (!config) throw new Error(`Niche not found: ${nicheId}`);

  // Merge with customizations
  user.keywords = customizations.keywords || config.keywords;
  user.sourcesConfig = { ...config.sources, ...customizations.sources };
  user.nicheId = nicheId;
  user.nicheConfig = {
    subreddits: config.subreddits,
    buyerIntent: config.buyerIntent.map(p => p.source),
    scoringWeights: config.scoringWeights
  };

  return user;
};

// Create custom niche
const createCustomNiche = (name, description, config) => {
  const id = name.toLowerCase().replace(/\s+/g, '-');
  
  NICHE_TEMPLATES[id] = {
    name,
    description,
    keywords: config.keywords || [],
    sources: config.sources || { hackerNews: true, reddit: true, upwork: false, linkedin: false },
    subreddits: config.subreddits || [],
    buyerIntent: (config.buyerIntentPatterns || []).map(p => new RegExp(p, 'i')),
    scoringWeights: config.scoringWeights || { budget: [], urgency: [], intent: [] }
  };

  return id;
};

// Get keywords for a specific niche with industry context
const getNicheKeywords = (nicheId, industry = null) => {
  const config = getNicheConfig(nicheId);
  if (!config) return [];

  let keywords = [...config.keywords];

  // Add industry-specific terms if provided
  if (industry) {
    const industryTerms = {
      'fintech': ['financial services', 'banking', 'payments', 'lending'],
      'healthcare': ['medical', 'health tech', 'clinical', 'patient care'],
      'ecommerce': ['shopify', 'woocommerce', 'amazon seller', 'dropshipping'],
      'saas': ['b2b software', 'cloud', 'subscription', 'recurring revenue'],
      'manufacturing': ['industrial', 'factory', 'production', 'oem']
    };

    const terms = industryTerms[industry.toLowerCase()];
    if (terms) {
      keywords = [...keywords, ...terms];
    }
  }

  return keywords;
};

module.exports = {
  NICHE_TEMPLATES,
  getAvailableNiches,
  getNicheConfig,
  applyNicheToUser,
  createCustomNiche,
  getNicheKeywords
};
