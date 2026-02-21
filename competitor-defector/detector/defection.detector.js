/**
 * Defection Keyword Detector
 * Detects defection signals in review text using keyword matching and NLP
 */

class DefectionDetector {
    constructor(config = {}) {
        this.keywords = config.keywords || this.getDefaultKeywords();
        this.caseSensitive = config.caseSensitive || false;
        this.minKeywordMatches = config.minKeywordMatches || 1;
        this.contextWindow = config.contextWindow || 100; // Characters around keyword
    }

    /**
     * Default defection keywords with weights
     */
    getDefaultKeywords() {
        return {
            // High-intent switching keywords (weight 4-5)
            'switching from': { weight: 5, category: 'switching' },
            'switch from': { weight: 5, category: 'switching' },
            'switching to': { weight: 4, category: 'switching' },
            'switched to': { weight: 4, category: 'switching' },
            'moved to': { weight: 4, category: 'switching' },
            'migrating to': { weight: 5, category: 'switching' },
            'moving away from': { weight: 5, category: 'switching' },
            'left for': { weight: 5, category: 'switching' },
            
            // Alternative seeking (weight 3-4)
            'looking for alternative': { weight: 4, category: 'alternative' },
            'evaluating alternatives': { weight: 4, category: 'alternative' },
            'considering alternatives': { weight: 4, category: 'alternative' },
            'exploring options': { weight: 3, category: 'alternative' },
            'better alternative': { weight: 3, category: 'alternative' },
            'cheaper alternative': { weight: 3, category: 'alternative' },
            'alternative to': { weight: 3, category: 'alternative' },
            
            // Replacement intent (weight 3-4)
            'looking to replace': { weight: 4, category: 'replacement' },
            'need to replace': { weight: 4, category: 'replacement' },
            'replacing with': { weight: 4, category: 'replacement' },
            'replace with': { weight: 3, category: 'replacement' },
            
            // Pain/frustration (weight 2-4)
            'tired of': { weight: 4, category: 'pain' },
            'fed up with': { weight: 4, category: 'pain' },
            'sick of': { weight: 4, category: 'pain' },
            'frustrated with': { weight: 4, category: 'pain' },
            'hate using': { weight: 4, category: 'pain' },
            'unhappy with': { weight: 3, category: 'pain' },
            'dissatisfied with': { weight: 3, category: 'pain' },
            'disappointed with': { weight: 3, category: 'pain' },
            'regret choosing': { weight: 4, category: 'pain' },
            'waste of money': { weight: 4, category: 'pain' },
            'not worth the': { weight: 3, category: 'pain' },
            'problems with': { weight: 3, category: 'pain' },
            'issues with': { weight: 3, category: 'pain' },
            'constantly crashes': { weight: 3, category: 'pain' },
            'buggy': { weight: 2, category: 'pain' },
            'unreliable': { weight: 3, category: 'pain' },
            'terrible support': { weight: 3, category: 'pain' },
            'poor customer service': { weight: 3, category: 'pain' },
            
            // Churn signals (weight 3-5)
            'canceling subscription': { weight: 5, category: 'churn' },
            'cancelled subscription': { weight: 5, category: 'churn' },
            'not renewing': { weight: 5, category: 'churn' },
            'won\'t renew': { weight: 5, category: 'churn' },
            'subscription ending': { weight: 4, category: 'churn' },
            'leaving for': { weight: 5, category: 'churn' },
            'stopped using': { weight: 4, category: 'churn' },
            'done with': { weight: 4, category: 'churn' },
            
            // Timeline urgency (weight 2-3)
            'need something asap': { weight: 3, category: 'timeline' },
            'immediately': { weight: 3, category: 'timeline' },
            'this quarter': { weight: 2, category: 'timeline' },
            'end of month': { weight: 2, category: 'timeline' },
            'next month': { weight: 2, category: 'timeline' },
            
            // Comparison shopping (weight 3)
            'comparing with': { weight: 3, category: 'comparison' },
            'versus': { weight: 3, category: 'comparison' },
            'vs': { weight: 2, category: 'comparison' },
            'looking at': { weight: 2, category: 'comparison' }
        };
    }

    /**
     * Analyze text for defection signals
     * @param {string} text - Review or message text
     * @returns {Object} Analysis results
     */
    analyze(text) {
        if (!text || text.length < 10) {
            return {
                hasDefectionSignal: false,
                score: 0,
                keywords: [],
                categories: {},
                excerpts: [],
                sentiment: 'neutral'
            };
        }

        const normalizedText = this.caseSensitive ? text : text.toLowerCase();
        const matches = [];
        const categories = {};
        const excerpts = [];
        let totalWeight = 0;

        // Check each keyword
        for (const [keyword, config] of Object.entries(this.keywords)) {
            const searchText = this.caseSensitive ? text : keyword.toLowerCase();
            const index = normalizedText.indexOf(searchText);
            
            if (index !== -1) {
                matches.push(keyword);
                totalWeight += config.weight;
                
                // Track by category
                if (!categories[config.category]) {
                    categories[config.category] = [];
                }
                categories[config.category].push(keyword);
                
                // Extract excerpt around keyword
                const excerpt = this.extractExcerpt(text, index, keyword.length);
                excerpts.push({
                    keyword,
                    excerpt,
                    position: index
                });
            }
        }

        // Calculate defection score (0-100)
        const score = this.calculateScore(totalWeight, matches.length, categories);
        
        // Determine if this is a defection signal
        const hasDefectionSignal = matches.length >= this.minKeywordMatches && score >= 30;
        
        // Determine sentiment
        const sentiment = this.determineSentiment(categories);

        return {
            hasDefectionSignal,
            score,
            keywords: matches,
            categories,
            excerpts,
            sentiment,
            matchCount: matches.length
        };
    }

    /**
     * Calculate defection intent score
     * @param {number} totalWeight - Sum of keyword weights
     * @param {number} matchCount - Number of keyword matches
     * @param {Object} categories - Categories of matches
     * @returns {number} Score 0-100
     */
    calculateScore(totalWeight, matchCount, categories) {
        let score = 0;
        
        // Base score from keyword weights
        score += Math.min(50, totalWeight * 5);
        
        // Bonus for multiple keywords
        if (matchCount >= 3) score += 15;
        if (matchCount >= 5) score += 10;
        
        // Category bonuses
        const categoryCount = Object.keys(categories).length;
        if (categoryCount >= 2) score += 10;
        if (categoryCount >= 3) score += 10;
        
        // Specific high-value combinations
        if (categories['switching'] && categories['pain']) score += 10;
        if (categories['churn'] && categories['alternative']) score += 15;
        if (categories['switching'] && categories['timeline']) score += 10;
        
        return Math.min(100, score);
    }

    /**
     * Extract excerpt around keyword match
     * @param {string} text 
     * @param {number} position 
     * @param {number} keywordLength 
     * @returns {string}
     */
    extractExcerpt(text, position, keywordLength) {
        const start = Math.max(0, position - this.contextWindow);
        const end = Math.min(text.length, position + keywordLength + this.contextWindow);
        
        let excerpt = text.substring(start, end);
        
        // Add ellipsis if truncated
        if (start > 0) excerpt = '...' + excerpt;
        if (end < text.length) excerpt = excerpt + '...';
        
        return excerpt.trim();
    }

    /**
     * Determine overall sentiment based on categories
     * @param {Object} categories 
     * @returns {string}
     */
    determineSentiment(categories) {
        const negativeCategories = ['pain', 'churn'];
        const positiveCategories = ['switching', 'alternative'];
        
        const hasNegative = negativeCategories.some(c => categories[c]);
        const hasPositive = positiveCategories.some(c => categories[c]);
        
        if (hasNegative && hasPositive) return 'mixed_defection';
        if (hasNegative) return 'negative';
        if (hasPositive) return 'seeking_alternative';
        return 'neutral';
    }

    /**
     * Extract pain points from review text
     * @param {string} text 
     * @returns {Array}
     */
    extractPainPoints(text) {
        const painPatterns = [
            /(?:problem|issue|pain|struggle|difficult|hard to|can't|cannot|unable to)[^.]*[.!?]/gi,
            /(?:wish|would be nice|need|missing|lacking|doesn't have)[^.]*[.!?]/gi,
            /(?:too expensive|costly|overpriced|not worth)[^.]*[.!?]/gi,
            /(?:slow|laggy|crashes|bugs|glitches|unstable)[^.]*[.!?]/gi
        ];
        
        const painPoints = [];
        
        for (const pattern of painPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                painPoints.push(...matches.map(m => m.trim()));
            }
        }
        
        return [...new Set(painPoints)].slice(0, 5); // Deduplicate and limit
    }

    /**
     * Extract desired features from review text
     * @param {string} text 
     * @returns {Array}
     */
    extractDesiredFeatures(text) {
        const featurePatterns = [
            /(?:wish it had|would love|need|missing|should have|could use)[^.]*[.!?]/gi,
            /(?:feature|functionality|capability|option|setting)[^.]*[.!?]/gi,
            /(?:integrate|integration|connect|sync|api)[^.]*[.!?]/gi
        ];
        
        const features = [];
        
        for (const pattern of featurePatterns) {
            const matches = text.match(pattern);
            if (matches) {
                features.push(...matches.map(m => m.trim()));
            }
        }
        
        return [...new Set(features)].slice(0, 5);
    }

    /**
     * Detect timeline from review text
     * @param {string} text 
     * @returns {string|null}
     */
    detectTimeline(text) {
        const timelinePatterns = [
            { pattern: /(?:asap|immediately|right away|urgent)/i, value: 'ASAP' },
            { pattern: /(?:this week|within a week|next few days)/i, value: 'This week' },
            { pattern: /(?:this month|end of month|month end)/i, value: 'This month' },
            { pattern: /(?:next month|coming month)/i, value: 'Next month' },
            { pattern: /(?:this quarter|q[1-4]|quarter)/i, value: 'This quarter' },
            { pattern: /(?:next quarter|coming quarter)/i, value: 'Next quarter' },
            { pattern: /(?:this year|end of year|year end)/i, value: 'This year' },
            { pattern: /(?:6 months|six months|half year)/i, value: '6 months' },
            { pattern: /(?:1 year|one year|annual)/i, value: '1 year' }
        ];
        
        for (const { pattern, value } of timelinePatterns) {
            if (pattern.test(text)) {
                return value;
            }
        }
        
        return null;
    }

    /**
     * Detect defection stage
     * @param {string} text 
     * @returns {string}
     */
    detectStage(text) {
        const lowerText = text.toLowerCase();
        
        // Already switched
        if (/\b(switched to|moved to|migrated to|now using|currently using|we use)\b/i.test(lowerText)) {
            return 'implemented';
        }
        
        // Decision made
        if (/\b(decided to|choosing|going with|will be using|plan to use)\b/i.test(lowerText)) {
            return 'decided';
        }
        
        // Actively evaluating
        if (/\b(evaluating|comparing|testing|trial|demo|poc|pilot)\b/i.test(lowerText)) {
            return 'evaluating';
        }
        
        // Early research
        if (/\b(looking for|considering|exploring|researching|interested in)\b/i.test(lowerText)) {
            return 'researching';
        }
        
        return 'unknown';
    }

    /**
     * Batch analyze multiple texts
     * @param {Array<{id: string, text: string}>} items 
     * @returns {Array}
     */
    batchAnalyze(items) {
        return items.map(item => ({
            id: item.id,
            ...this.analyze(item.text)
        }));
    }
}

module.exports = DefectionDetector;
