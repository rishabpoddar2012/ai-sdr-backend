const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

/**
 * G2 Review Scraper
 * Scrapes negative reviews from G2.com for specified competitors
 */
class G2Scraper {
    constructor(config = {}) {
        this.baseUrl = 'https://www.g2.com';
        this.delay = config.delay || 2000; // Delay between requests (ms)
        this.maxPages = config.maxPages || 5;
        this.supabase = config.supabase || null;
        
        // Browser-like headers to avoid blocking
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0'
        };
    }

    /**
     * Initialize Supabase client
     */
    initSupabase(url, key) {
        this.supabase = createClient(url, key);
    }

    /**
     * Fetch reviews for a specific product
     * @param {string} productSlug - G2 product slug (e.g., 'salesforce-crm')
     * @param {string} competitorId - UUID of competitor in database
     * @param {string} userId - UUID of user
     * @returns {Promise<Array>} Array of review objects
     */
    async fetchReviews(productSlug, competitorId, userId) {
        const reviews = [];
        
        try {
            for (let page = 1; page <= this.maxPages; page++) {
                const url = `${this.baseUrl}/products/${productSlug}/reviews?page=${page}`;
                
                console.log(`[G2] Fetching page ${page}: ${url}`);
                
        const response = await axios.get(url, {
            headers: this.headers,
            timeout: 30000,
            validateStatus: (status) => status < 500
        });

                if (response.status === 403 || response.status === 429) {
                    console.warn('[G2] Rate limited or blocked. Consider increasing delay.');
                    break;
                }

                const $ = cheerio.load(response.data);
                const pageReviews = this.parseReviews($, productSlug, competitorId, userId);
                
                if (pageReviews.length === 0) {
                    console.log('[G2] No more reviews found.');
                    break;
                }
                
                reviews.push(...pageReviews);
                console.log(`[G2] Found ${pageReviews.length} reviews on page ${page}`);
                
                // Delay between requests
                if (page < this.maxPages) {
                    await this.sleep(this.delay);
                }
            }
        } catch (error) {
            console.error('[G2] Error fetching reviews:', error.message);
        }
        
        return reviews;
    }

    /**
     * Parse reviews from HTML
     * @param {CheerioStatic} $ - Cheerio loaded HTML
     * @param {string} productSlug - Product identifier
     * @param {string} competitorId - Competitor UUID
     * @param {string} userId - User UUID
     * @returns {Array} Parsed reviews
     */
    parseReviews($, productSlug, competitorId, userId) {
        const reviews = [];
        
        // G2 review selectors (may need updating as site changes)
        $('.review').each((i, elem) => {
            try {
                const $review = $(elem);
                
                // Extract review data
                const reviewId = $review.attr('id') || `g2_${Date.now()}_${i}`;
                const reviewerName = $review.find('.author-name, .reviewer-name, [itemprop="author"]').first().text().trim();
                const reviewerTitle = $review.find('.author-title, .reviewer-title').first().text().trim();
                const reviewerCompany = $review.find('.author-company, .reviewer-company').first().text().trim();
                
                // Rating - look for stars or numeric rating
                let rating = null;
                const ratingText = $review.find('.rating, .stars, [itemprop="ratingValue"]').first().text().trim();
                if (ratingText) {
                    const match = ratingText.match(/(\d+(\.\d+)?)/);
                    if (match) rating = parseFloat(match[1]);
                }
                
                // Review content
                const reviewTitle = $review.find('.review-title, [itemprop="name"]').first().text().trim();
                const reviewContent = $review.find('.review-content, [itemprop="reviewBody"], .text').first().text().trim();
                
                // Date
                const dateText = $review.find('.review-date, [itemprop="datePublished"], time').first().text().trim();
                const datePosted = this.parseDate(dateText);
                
                // Company size and industry (if available)
                const companySize = $review.find('.company-size, .employee-range').first().text().trim();
                const industry = $review.find('.industry, .company-industry').first().text().trim();
                
                // Only include if we have meaningful content
                if (reviewContent && reviewContent.length > 20) {
                    reviews.push({
                        competitor_id: competitorId,
                        user_id: userId,
                        source: 'g2',
                        source_review_id: reviewId,
                        reviewer_name: reviewerName || 'Anonymous',
                        reviewer_title: reviewerTitle,
                        reviewer_company: reviewerCompany,
                        reviewer_company_size: companySize,
                        reviewer_industry: industry,
                        review_title: reviewTitle,
                        review_content: reviewContent,
                        rating: rating,
                        date_posted: datePosted,
                        source_url: `${this.baseUrl}/products/${productSlug}/reviews`,
                        is_negative: rating !== null && rating <= 3,
                        raw_data: {
                            product_slug: productSlug,
                            parsed_at: new Date().toISOString()
                        }
                    });
                }
            } catch (parseError) {
                console.error('[G2] Error parsing review:', parseError.message);
            }
        });
        
        return reviews;
    }

    /**
     * Parse date string to ISO format
     * @param {string} dateText 
     * @returns {string|null}
     */
    parseDate(dateText) {
        if (!dateText) return null;
        
        try {
            // Handle relative dates like "2 days ago", "1 month ago"
            const relativeMatch = dateText.match(/(\d+)\s+(day|week|month|year)s?\s+ago/i);
            if (relativeMatch) {
                const amount = parseInt(relativeMatch[1]);
                const unit = relativeMatch[2];
                const date = new Date();
                
                switch (unit) {
                    case 'day': date.setDate(date.getDate() - amount); break;
                    case 'week': date.setDate(date.getDate() - (amount * 7)); break;
                    case 'month': date.setMonth(date.getMonth() - amount); break;
                    case 'year': date.setFullYear(date.getFullYear() - amount); break;
                }
                
                return date.toISOString().split('T')[0];
            }
            
            // Try parsing as regular date
            const date = new Date(dateText);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (e) {
            console.warn('[G2] Could not parse date:', dateText);
        }
        
        return null;
    }

    /**
     * Save reviews to database
     * @param {Array} reviews 
     * @returns {Promise<number>} Number of reviews saved
     */
    async saveReviews(reviews) {
        if (!this.supabase || reviews.length === 0) {
            return 0;
        }
        
        let saved = 0;
        
        // Insert in batches to avoid payload limits
        const batchSize = 50;
        for (let i = 0; i < reviews.length; i += batchSize) {
            const batch = reviews.slice(i, i + batchSize);
            
            const { data, error } = await this.supabase
                .from('competitor_reviews')
                .upsert(batch, { 
                    onConflict: 'source_review_id',
                    ignoreDuplicates: true 
                });
            
            if (error) {
                console.error('[G2] Error saving reviews batch:', error);
            } else {
                saved += batch.length;
            }
        }
        
        return saved;
    }

    /**
     * Sleep utility
     * @param {number} ms 
     * @returns {Promise}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = G2Scraper;
