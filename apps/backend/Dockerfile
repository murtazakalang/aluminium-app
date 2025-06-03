# Dockerfile for Backend (Node.js/Express)

# Use an official Node runtime as a parent image
FROM node:18-slim AS development

# Install Puppeteer dependencies for Debian-based Linux
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-liberation \
    fonts-noto \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libu2f-udev \
    libvulkan1 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxshmfence1 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system-installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Set the working directory in the container
WORKDIR /usr/src/app/apps/backend

# Ensure we're in development mode so devDependencies are installed
ENV NODE_ENV=development

# Copy package.json files first for better caching
COPY apps/backend/package*.json ./
COPY package*.json ../../

# Install app dependencies
RUN cd ../.. && npm install --include=dev

# Copy the source code (but not node_modules thanks to .dockerignore)
COPY apps/backend/src ./src
COPY apps/backend/.env* ./

# Application Port (ensure this matches your .env or config)
EXPOSE 3001

# Command to run the app in development mode (using nodemon)
CMD [ "npm", "run", "dev" ]

# --- Production Build Stage ---
FROM node:18-slim AS builder

WORKDIR /usr/src/app

# Copy package.json files first
COPY apps/backend/package*.json ./apps/backend/
COPY package*.json ./

# Install dependencies for the entire monorepo
RUN npm install

# Copy source code (we only copy what we need)
COPY apps/backend/src ./apps/backend/src

# Build the app
RUN npm run build --filter=backend...

# --- Production Runtime Stage ---
FROM node:18-slim AS production

# Install Puppeteer dependencies for Debian-based Linux
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-liberation \
    fonts-noto \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libu2f-udev \
    libvulkan1 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxshmfence1 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system-installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /usr/src/app

# Copy only necessary artifacts from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules/
COPY --from=builder /usr/src/app/apps/backend/dist ./apps/backend/dist/
COPY --from=builder /usr/src/app/apps/backend/package.json ./apps/backend/
COPY --from=builder /usr/src/app/package*.json ./

# Expose the application port
EXPOSE 3001

# Set environment to production
ENV NODE_ENV=production

# Command to run the optimized production app
WORKDIR /usr/src/app/apps/backend
CMD [ "node", "dist/server.js" ] 