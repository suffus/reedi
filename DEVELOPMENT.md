# Development Setup

This guide will help you set up the Reedi development environment.

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Quick Start

1. **Install dependencies:**
   ```bash
   # Frontend dependencies
   npm install
   
   # Backend dependencies
   cd backend
   npm install
   cd ..
   ```

2. **Set up PostgreSQL:**
   ```bash
   # Start PostgreSQL (if not already running)
   sudo systemctl start postgresql
   
   # Create database (if it doesn't exist)
   createdb -h localhost -U postgres reedi
   ```

3. **Set up environment variables:**
   ```bash
   # Frontend (.env.local)
   echo "NEXT_PUBLIC_API_URL=http://localhost:8088/api" > .env.local
   
   # Backend (.env) - already configured
   ```

4. **Run the development servers:**
   ```bash
   # Option 1: Use the development script (recommended)
   npm run dev:full
   
   # Option 2: Run servers separately
   # Terminal 1 - Backend:
   cd backend
   npm run dev
   
   # Terminal 2 - Frontend:
   npm run dev
   ```

## Development URLs

- **Frontend:** http://localhost:3000 (or next available port if 3000 is in use)
- **Backend API:** http://localhost:8088/api
- **Health Check:** http://localhost:8088/health

**Current Setup:**
- Frontend: http://localhost:3001
- Backend: http://localhost:8088

## Troubleshooting

### Port Issues
- Frontend runs on port 3000
- Backend runs on port 8088
- Make sure these ports are available

### Database Issues
- Ensure PostgreSQL is running: `sudo systemctl status postgresql`
- Check database connection: `psql -h localhost -U postgres -d reedi`
- Run migrations: `cd backend && npx prisma migrate deploy`

### API Connection Issues
- Verify the `NEXT_PUBLIC_API_URL` in `.env.local` points to `http://localhost:8088/api`
- Check that the backend is running and accessible at http://localhost:8088/health

## Available Scripts

- `npm run dev` - Start frontend only
- `npm run dev:full` - Start both frontend and backend
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking 