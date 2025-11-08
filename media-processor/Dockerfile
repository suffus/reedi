# Use Node.js 18 Alpine as base image for smaller size
FROM node:23-alpine AS base

# Install system dependencies including FFmpeg
RUN apk add --no-cache \
    ffmpeg \
    ffmpeg-dev \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .


COPY patches/node_modules/file-type/package.json node_modules/file-type/package.json


# Build TypeScript
RUN npm run build

# Create production image
FROM node:23-alpine AS production

# Install FFmpeg and other runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    && rm -rf /var/cache/apk/*

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from base stage
COPY --from=base /app/dist ./dist

# Copy necessary config files
COPY tsconfig.json ./
COPY env.example ./

# Create necessary directories
RUN mkdir -p logs output

# Set ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to nodejs user
USER nodejs

# Expose port
EXPOSE 8044

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8044/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

COPY patches/node_modules/file-type/package.json node_modules/file-type/package.json

RUN cat node_modules/file-type/package.json



# Start the application
CMD ["node", "dist/index.js"] 
