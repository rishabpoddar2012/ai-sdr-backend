#!/bin/bash
# AI SDR Deployment Script
# Run this script to deploy the backend to Supabase

set -e

echo "🚀 AI SDR Deployment Script"
echo "=========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_REF="qazrfivyfrgfcnibilzo"
SUPABASE_URL="https://qazrfivyfrgfcnibilzo.supabase.co"

echo -e "${YELLOW}Project Ref:${NC} $PROJECT_REF"
echo -e "${YELLOW}Supabase URL:${NC} $SUPABASE_URL"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}Installing Supabase CLI...${NC}"
    npm install -g supabase
fi

# Check if logged in
echo -e "${YELLOW}Checking Supabase login...${NC}"
if ! supabase projects list &> /dev/null; then
    echo -e "${RED}Not logged in to Supabase${NC}"
    echo "Please run: supabase login"
    exit 1
fi

echo -e "${GREEN}✓ Logged in to Supabase${NC}"
echo ""

# Link project
echo -e "${YELLOW}Linking project...${NC}"
supabase link --project-ref $PROJECT_REF

echo -e "${GREEN}✓ Project linked${NC}"
echo ""

# Deploy edge functions
echo -e "${YELLOW}Deploying Edge Functions...${NC}"
supabase functions deploy api

echo -e "${GREEN}✓ Edge Functions deployed${NC}"
echo ""

# Get database connection string
echo -e "${YELLOW}Please enter your Supabase database connection string:${NC}"
echo "(Get it from: Supabase Dashboard → Settings → Database → Connection string)"
read -s -p "Database URL: " DATABASE_URL
echo ""

# Run migrations
echo -e "${YELLOW}Running database migrations...${NC}"
if command -v psql &> /dev/null; then
    psql "$DATABASE_URL" -f supabase/migrations/001_initial_schema.sql
    echo -e "${GREEN}✓ Migrations completed${NC}"
else
    echo -e "${YELLOW}psql not found. Please install PostgreSQL client and run:${NC}"
    echo "psql \"$DATABASE_URL\" -f supabase/migrations/001_initial_schema.sql"
fi

echo ""
echo -e "${GREEN}==========================${NC}"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}==========================${NC}"
echo ""
echo "Test your deployment:"
echo "  Health: $SUPABASE_URL/functions/v1/api/health"
echo ""
echo "Next steps:"
echo "1. Set environment variables in Supabase Dashboard"
echo "2. Deploy frontend to Vercel"
echo "3. Test end-to-end signup flow"
