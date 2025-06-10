# Dockerfile for Frontend (Next.js)

# --- Dependencies Stage (Shared) ---
FROM node:18-alpine AS deps

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app

# Copy root package.json and frontend package.json
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/

# If types package exists, copy its package.json
COPY packages/types/package*.json ./packages/types/

# Install dependencies
RUN npm install

# --- Development Stage ---
FROM node:18-alpine AS development

# Set up environment
RUN apk add --no-cache libc6-compat

# Explicitly set development mode
ENV NODE_ENV=development

# Set working directory at monorepo root
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/

# Install all dependencies
RUN npm install --include=dev

# Copy source code for frontend
COPY apps/frontend/ ./apps/frontend/
# Copy packages if they exist
COPY packages/ ./packages/

# Set working directory to frontend
WORKDIR /usr/src/app/apps/frontend

# Expose port
EXPOSE 3000

# Run development server
CMD ["npm", "run", "dev"]

# --- Builder Stage (For Production) ---
FROM node:18-alpine AS builder

WORKDIR /usr/src/app 

# Copy all source files from monorepo root
COPY . .

# Install dependencies
RUN npm install

# Build the frontend app
RUN npm run build --filter=frontend...

# --- Production Runner Stage ---
FROM node:18-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only the necessary built artifacts from the builder stage
COPY --from=builder /usr/src/app/apps/frontend/public ./apps/frontend/public/
COPY --from=builder --chown=nextjs:nodejs /usr/src/app/apps/frontend/.next/standalone ./apps/frontend/
COPY --from=builder --chown=nextjs:nodejs /usr/src/app/apps/frontend/.next/static ./apps/frontend/.next/static/
# If server.js is in apps/frontend after standalone build
COPY --from=builder /usr/src/app/apps/frontend/server.js ./apps/frontend/server.js

USER nextjs

EXPOSE 3000

# Set the correct working directory for the standalone output
WORKDIR /usr/src/app/apps/frontend

CMD ["node", "server.js"] 