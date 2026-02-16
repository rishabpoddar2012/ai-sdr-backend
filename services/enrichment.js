const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Smart Enrichment Service
 * Finds contact details, company info, and validates leads
 */

// Enrich a lead with additional data
const enrichLead = async (lead) => {
  const enriched = { ...lead };
  
  try {
    // 1. Find company website if not provided
    if (!enriched.companyWebsite && enriched.companyName) {
      enriched.companyWebsite = await findCompanyWebsite(enriched.companyName);
    }
    
    // 2. Find contact email if not provided
    if (!enriched.contactEmail) {
      enriched.contactEmail = await findEmail(
        enriched.companyWebsite,
        enriched.contactName,
        enriched.companyName
      );
    }
    
    // 3. Find LinkedIn profile
    if (!enriched.contactLinkedIn) {
      enriched.contactLinkedIn = await findLinkedIn(
        enriched.contactName,
        enriched.companyName
      );
    }
    
    // 4. Get company info
    const companyInfo = await getCompanyInfo(enriched.companyWebsite);
    enriched.companySize = companyInfo.size || enriched.companySize;
    enriched.companyIndustry = companyInfo.industry || enriched.companyIndustry;
    enriched.companyDescription = companyInfo.description;
    
    // 5. Validate email domain
    enriched.emailValid = enriched.contactEmail ? 
      await validateEmailDomain(enriched.contactEmail) : false;
    
    enriched.enrichedAt = new Date().toISOString();
    enriched.enrichmentSource = 'automated';
    
  } catch (error) {
    console.error('Enrichment error:', error.message);
    enriched.enrichmentError = error.message;
  }
  
  return enriched;
};

// Find company website from name
const findCompanyWebsite = async (companyName) => {
  try {
    // Try common patterns
    const domain = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/inc$|llc$|corp$|ltd$/i, '');
    
    const candidates = [
      `https://${domain}.com`,
      `https://www.${domain}.com`,
      `https://${domain}.io`,
      `https://${domain}.co`
    ];
    
    for (const url of candidates) {
      try {
        const response = await axios.head(url, { 
          timeout: 5000,
          maxRedirects: 3
        });
        if (response.status === 200) return url;
      } catch (e) {
        continue;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

// Find email patterns
const findEmail = async (website, contactName, companyName) => {
  if (!website) return null;
  
  try {
    // Try common patterns
    const domain = new URL(website).hostname.replace('www.', '');
    
    // Pattern 1: first@company.com
    if (contactName) {
      const first = contactName.split(' ')[0].toLowerCase();
      const last = contactName.split(' ').slice(-1)[0].toLowerCase();
      
      const patterns = [
        `${first}@${domain}`,
        `${first}.${last}@${domain}`,
        `${first[0]}${last}@${domain}`,
        `${first}_${last}@${domain}`,
        `hello@${domain}`,
        `contact@${domain}`,
        `info@${domain}`
      ];
      
      // Return first pattern (user can verify)
      return patterns[0];
    }
    
    return `hello@${domain}`;
  } catch (error) {
    return null;
  }
};

// Find LinkedIn profile
const findLinkedIn = async (contactName, companyName) => {
  if (!contactName || !companyName) return null;
  
  const searchQuery = encodeURIComponent(`${contactName} ${companyName}`);
  return `https://www.linkedin.com/search/results/people/?keywords=${searchQuery}`;
};

// Get company info
const getCompanyInfo = async (website) => {
  if (!website) return {};
  
  try {
    const response = await axios.get(website, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI_SDR/1.0)'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract meta description
    const description = $('meta[name="description"]').attr('content') ||
                       $('meta[property="og:description"]').attr('content') ||
                       $('p').first().text().substring(0, 200);
    
    // Try to detect company size from careers/about page
    const text = $('body').text().toLowerCase();
    let size = null;
    
    if (text.includes('10,000+') || text.includes('enterprise')) size = '10,000+';
    else if (text.includes('1,000-') || text.includes('1000-')) size = '1,000-10,000';
    else if (text.includes('100-') || text.includes('500-')) size = '100-1,000';
    else if (text.includes('10-') || text.includes('50-')) size = '10-100';
    else if (text.includes('startup') || text.includes('small team')) size = '1-10';
    
    return {
      description,
      size
    };
  } catch (error) {
    return {};
  }
};

// Validate email domain
const validateEmailDomain = async (email) => {
  try {
    const domain = email.split('@')[1];
    const response = await axios.get(`https://dns.google/resolve?name=${domain}&type=MX`, {
      timeout: 5000
    });
    return response.data && response.data.Answer && response.data.Answer.length > 0;
  } catch (error) {
    return false;
  }
};

// Batch enrich multiple leads
const batchEnrich = async (leads, concurrency = 5) => {
  const results = [];
  
  for (let i = 0; i < leads.length; i += concurrency) {
    const batch = leads.slice(i, i + concurrency);
    const enrichedBatch = await Promise.all(
      batch.map(lead => enrichLead(lead))
    );
    results.push(...enrichedBatch);
  }
  
  return results;
};

module.exports = {
  enrichLead,
  batchEnrich,
  findCompanyWebsite,
  findEmail,
  findLinkedIn,
  getCompanyInfo
};
