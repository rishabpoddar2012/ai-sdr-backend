# AI SDR Backend

## Database & Authentication System

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```env
NODE_ENV=development
PORT=4000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_sdr

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

3. Set up PostgreSQL database:
```bash
createdb ai_sdr
npm run db:migrate
```

4. Run server:
```bash
npm run dev
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### User
- `GET /api/user/profile` - Get current user
- `PUT /api/user/profile` - Update profile
- `DELETE /api/user/account` - Delete account

### Leads
- `GET /api/leads` - Get user's leads
- `GET /api/leads/:id` - Get single lead
- `POST /api/leads/:id/favorite` - Favorite a lead
- `DELETE /api/leads/:id/favorite` - Unfavorite

### Sources
- `GET /api/sources` - Get configured sources
- `PUT /api/sources` - Update source configuration

### Subscription
- `GET /api/subscription` - Get current subscription
- `GET /api/subscription/usage` - Get usage stats

## Database Schema

See `models/` directory for full schema.

## Deployment

1. Create PostgreSQL database on Render/Railway
2. Set environment variables
3. Run migrations
4. Deploy
