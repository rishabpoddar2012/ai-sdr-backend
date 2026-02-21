# Competitor Defection Detector

A system that detects when prospects are defecting from competitors by scraping review sites (G2, Capterra) for negative reviews containing defection keywords.

## Features

- **Review Scraping**: Automated scraping of G2 and Capterra for negative competitor reviews
- **Keyword Detection**: AI-powered detection of defection signals
- **Lead Scoring**: Priority scoring based on defection intent strength
- **Alert System**: Real-time notifications when high-intent defectors are detected
- **Pitch Generation**: AI-generated personalized outreach messages

## Defection Keywords Detected

- "switching" / "switch from"
- "alternative" / "looking for alternative"
- "replacement" / "replace"
- "tired of"
- "moving from" / "moving to"
- "leaving" / "left"
- "dissatisfied"
- "frustrated with"
- "problems with"
- "issues with"
- "canceling" / "canceled"
- "not renewing"
- "exploring options"
- "evaluating alternatives"

## Installation

```bash
cd /home/ubuntu/clawd/ai-sdr-backend/competitor-defector
npm install
```

## Usage

```bash
# Run scraper manually
npm run scrape

# Run with specific competitor
npm run scrape -- --competitor=salesforce

# Start alert monitoring
npm run monitor

# Generate pitches for detected defectors
npm run generate-pitches
```

## API Endpoints

- `POST /api/competitor-defector/scrape` - Trigger manual scrape
- `GET /api/competitor-defector/leads` - List defector leads
- `POST /api/competitor-defector/alert` - Configure alerts
- `GET /api/competitor-defector/pitches/:leadId` - Get generated pitches

## Database Schema

See `schema.sql` for complete database schema including:
- `competitor_reviews` table
- `defector_leads` table
- `defector_alerts` table
- `competitor_pitches` table

## Integration

This module integrates with the existing AI SDR platform:
- Uses shared Supabase database
- Leverages existing lead scoring system
- Integrates with notification services
- Compatible with existing UI components
