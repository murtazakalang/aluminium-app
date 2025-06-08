#!/bin/bash

# Fix Frontend Build Script for Aluminium App
echo "🔧 Fixing frontend build issues..."

# 1. Stop any hanging builds and clean up
echo "🛑 Stopping any running builds..."
docker-compose -f docker-compose-prod.yml kill frontend 2>/dev/null || true
docker container prune -f

# 2. Clean Docker build cache to avoid corrupted layers
echo "🧹 Cleaning Docker build cache..."
docker builder prune -f

# 3. Switch to optimized Dockerfile
echo "📁 Switching to optimized frontend Dockerfile..."
if [ -f "apps/frontend/Dockerfile" ]; then
    cp apps/frontend/Dockerfile apps/frontend/Dockerfile.backup
fi
cp apps/frontend/Dockerfile.optimized apps/frontend/Dockerfile

# 4. Create .dockerignore if it doesn't exist to reduce build context
echo "📋 Optimizing build context..."
cat > apps/frontend/.dockerignore << 'EOF'
node_modules
.next
.git
.gitignore
README.md
Dockerfile*
.dockerignore
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.env*.local
.DS_Store
*.tgz
.nyc_output
coverage
.cache
EOF

# 5. Optimize system for building
echo "⚡ Optimizing system for build..."

# Increase swap if needed (temporary)
if [ $(free -m | awk 'NR==2{print $3}') -gt 6000 ]; then
    echo "⚠️ High memory usage detected. Creating temporary swap..."
    sudo fallocate -l 2G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1024 count=2097152
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
fi

# Set Docker build memory limit
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain

# 6. Build with optimized settings
echo "🔨 Starting optimized frontend build..."

# Build with resource limits and timeout
timeout 1800 docker build \
    --progress=plain \
    --memory=3g \
    --memory-swap=4g \
    --cpus=1.5 \
    --target=runner \
    -f apps/frontend/Dockerfile \
    -t aluminium-frontend:optimized \
    . || {
    
    echo "❌ Build failed or timed out. Trying alternative approach..."
    
    # Alternative: Build with minimal resources
    echo "🔄 Attempting build with minimal resources..."
    
    # Clear all npm caches on host
    npm cache clean --force 2>/dev/null || true
    
    # Build with even more conservative settings
    timeout 2400 docker build \
        --progress=plain \
        --memory=2g \
        --memory-swap=3g \
        --cpus=1.0 \
        --target=runner \
        --no-cache \
        -f apps/frontend/Dockerfile \
        -t aluminium-frontend:optimized \
        . || {
        
        echo "❌ Build still failing. Trying yarn instead of npm..."
        
        # Create a Dockerfile that uses yarn
        cat > apps/frontend/Dockerfile.yarn << 'EOF'
FROM node:18-alpine AS builder

RUN apk add --no-cache libc6-compat
RUN npm install -g yarn

ENV NODE_OPTIONS="--max-old-space-size=1536"
WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/

RUN yarn install --frozen-lockfile --network-timeout 600000

COPY apps/frontend/ ./apps/frontend/
WORKDIR /usr/src/app/apps/frontend

RUN yarn build

FROM node:18-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /usr/src/app/apps/frontend/public ./apps/frontend/public/
COPY --from=builder --chown=nextjs:nodejs /usr/src/app/apps/frontend/.next/standalone ./apps/frontend/
COPY --from=builder --chown=nextjs:nodejs /usr/src/app/apps/frontend/.next/static ./apps/frontend/.next/static/

USER nextjs
EXPOSE 3000
WORKDIR /usr/src/app/apps/frontend
CMD ["node", "server.js"]
EOF
        
        # Try with yarn
        timeout 1800 docker build \
            --progress=plain \
            --memory=2g \
            --memory-swap=3g \
            --cpus=1.0 \
            -f apps/frontend/Dockerfile.yarn \
            -t aluminium-frontend:optimized \
            .
    }
}

if [ $? -eq 0 ]; then
    echo "✅ Frontend build completed successfully!"
    
    # Update docker-compose to use the new image
    sed -i.bak 's|dockerfile: ./apps/frontend/Dockerfile|dockerfile: ./apps/frontend/Dockerfile.optimized|' docker-compose-prod.yml
    
    echo "🚀 Updated docker-compose-prod.yml to use optimized frontend build"
    echo "📋 You can now run: docker-compose -f docker-compose-prod.yml up -d frontend"
    
else
    echo "❌ Frontend build failed even with optimizations."
    echo "📋 Manual troubleshooting steps:"
    echo "   1. Check available disk space: df -h"
    echo "   2. Check memory usage: free -h"
    echo "   3. Try building on a machine with more RAM"
    echo "   4. Consider using a smaller base image"
    echo "   5. Build frontend separately on development machine and copy dist files"
fi

# 7. Cleanup temporary swap
if [ -f /swapfile ]; then
    echo "🧹 Cleaning up temporary swap file..."
    sudo swapoff /swapfile 2>/dev/null || true
    sudo rm -f /swapfile 2>/dev/null || true
fi

echo "🔧 Frontend build fix script completed!" 