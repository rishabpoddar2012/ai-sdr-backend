const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Capterra Review Scraper
 * Scrapes negative reviews from Capterra.com for specified competitors
 */
class CapterraScraper {
    constructor(config = {}) {
        this.baseUrl = 'https://www.capterra.com';
        this.delay = config.delay || 2000;
        this.maxPages = config.maxPages || 5;
        this.supabase = config.supabase || null;
        
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        };
    }

    /**
     * Initialize Supabase client
     */
    initSupabase(url, key) {
        const { createClient } = require('@supabase/supabase-js');
        this.supabase = createClient(url, key);
    }

    /**
     * Fetch reviews for a specific product
     * @param {string} productSlug - Capterra product slug (e.g., 'salesforce-crm')
     * @param {string} competitorId - UUID of competitor in database
     * @param {string} userId - UUID of user
     * @returns {Promise<Array>} Array of review objects
     */
    async fetchReviews(productSlug, competitorId, userId) {
        const reviews = [];
        
        try {
            for (let page = 1; page <= this.maxPages; page++) {
                // Capterra uses different URL patterns
                const url = `${this.baseUrl}/reviews/${productSlug}?page=${page}`;
                
                console.log(`[Capterra] Fetching page ${page}: ${url}`);
                
        const response = await axios.get(url, {
            headers: this.headers,
            timeout: 30000,
            validateStatus: (status) => status < 500
        });

                if (response.status === 403 || response.status === 429) {
                    console.warn('[Capterra] Rate limited or blocked.');
                    break;
                }

                const $ = cheerio.load(response.data);
                const pageReviews = this.parseReviews($, productSlug, competitorId, userId);
                
                if (pageReviews.length === 0) {
                    console.log('[Capterra] No more reviews found.');
                    break;
                }
                
                reviews.push(...pageReviews);
                console.log(`[Capterra] Found ${pageReviews.length} reviews on page ${page}`);
                
                if (page < this.maxPages) {
                    await this.sleep(this.delay);
                }
            }
        } catch (error) {
            console.error('[Capterra] Error fetching reviews:', error.message);
        }
        
        return reviews;
    }

    /**
     * Alternative fetch using Capterra's search/browse pages
     * @param {string} productName - Product name to search for
     * @param {string} competitorId - UUID of competitor
     * @param {string} userId - UUID of user
     * @returns {Promise<Array>}
     */
    async fetchReviewsBySearch(productName, competitorId, userId) {
        const reviews = [];
        
        try {
            // Try to find the product first
            const searchUrl = `${this.baseUrl}/search/?q=${encodeURIComponent(productName)}`;
            
            const response = await axios.get(searchUrl, {
                headers: this.headers,
                timeout: 30000
            });
            
            const $ = cheerio.load(response.data);
            
            // Look for product link
            const productLink = $('.product-card a, .search-result a').first().attr('href');
            
            if (productLink) {
                const productSlug = productLink.split('/').pop();
                return await this.fetchReviews(productSlug, competitorId, userId);
            }
        } catch (error) {
            console.error('[Capterra] Error searching for product:', error.message);
        }
        
        return reviews;
    }

    /**
     * Parse reviews from Capterra HTML
     * @param {CheerioStatic} $ - Cheerio loaded HTML
     * @param {string} productSlug - Product identifier
     * @param {string} competitorId - Competitor UUID
     * @param {string} userId - User UUID
     * @returns {Array} Parsed reviews
     */
    parseReviews($, productSlug, competitorId, userId) {
        const reviews = [];
        
        // Capterra review selectors
        $('.review-card, .review-item, [data-testid="review"]').each((i, elem) => {
            try {
                const $review = $(elem);
                
                const reviewId = $review.attr('data-review-id') || $review.attr('id') || `capterra_${Date.now()}_${i}`;
                const reviewerName = $review.find('.reviewer-name, .user-name, [itemprop="author"]').first().text().trim();
                const reviewerTitle = $review.find('.reviewer-title, .user-title').first().text().trim();
                const reviewerCompany = $review.find('.reviewer-company, .company-name').first().text().trim();
                
                // Rating extraction
                let rating = null;
                const ratingElem = $review.find('.rating-stars, [itemprop="ratingValue"], .star-rating').first();
                const ratingText = ratingElem.text().trim() || ratingElem.attr('content');
                if (ratingText) {
                    const match = ratingText.match(/(\d+(\.\d+)?)/);
                    if (match) rating = parseFloat(match[1]);
                }
                
                // Review content
                const reviewTitle = $review.find('.review-title, [itemprop="name"], h3').first().text().trim();
                const reviewContent = $review.find('.review-text, [itemprop="reviewBody"], .description').first().text().trim();
                
                // Date
                const dateText = $review.find('.review-date, [itemprop="datePublished"], time').first().text().trim();
                const datePosted = this.parseDate(dateText);
                
                // Company info
                const companySize = $review.find('.company-size, .employees').first().text().trim();
                const industry = $review.find('.industry, .company-industry').first().text().trim();
                
                // Pros and cons (Capterra specific)
                const pros = $review.find('.pros-text, [data-testid="pros"]').first().text().trim();
                const cons = $review.find('.cons-text, [data-testid="cons"]').first().text().trim();
                
                if (reviewContent && reviewContent.length > 20) {
                    reviews.push({
                        competitor_id: competitorId,
                        user_id: userId,
                        source: 'capterra',
                        source_review_id: reviewId,
                        reviewer_name: reviewerName || 'Anonymous',
                        reviewer_title: reviewerTitle,
                        reviewer_company: reviewerCompany,
                        reviewer_company_size: companySize,
                        reviewer_industry: industry,
                        review_title: reviewTitle,
                        review_content: `${reviewContent}\n\nPros: ${pros}\nCons: ${cons}`.trim(),
                        rating: rating,
                        date_posted: datePosted,
                        source_url: `${this.baseUrl}/reviews/${productSlug}`,
                        is_negative: rating !== null && rating <= 3,
                        raw_data: {
                            product_slug: productSlug,
                            pros: pros,
                            cons: cons,
                            parsed_at: new Date().toISOString()
                        }
                    });
                }
            } catch (parseError) {
                console.error('[Capterra] Error parsing review:', parseError.message);
            }
        });
        
        return reviews;
    }

    /**
     * Parse date string
     * @param {string} dateText 
     * @returns {string|null}
     */
    parseDate(dateText) {
        if (!dateText) return null;
        
        try {
            // Handle various date formats
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
            
            const date = new Date(dateText);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (e) {
            console.warn('[Capterra] Could not parse date:', dateText);
        }
        
        return null;
    }

    /**
     * Save reviews to database
     * @param {Array} reviews 
     * @returns {Promise<number>}
     */
    async saveReviews(reviews) {
        if (!this.supabase || reviews.length === 0) {
            return 0;
        }
        
        let saved = 0;
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
                console.error('[Capterra] Error saving reviews:', error);
            } else {
                saved += batch.length;
            }
        }
        
        return saved;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = CapterraScraper;
