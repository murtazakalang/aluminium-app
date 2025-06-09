#!/bin/bash

echo "🚀 Quick Deployment Script for Aluminium App"
echo "This script provides alternatives to the slow build process"

# Function to check available memory
check_memory() {
    local available_memory=$(free -m | awk 'NR==2{print $7}')
    echo "Available memory: ${available_memory}MB"
    if [ $available_memory -lt 2000 ]; then
        echo "⚠️ WARNING: Less than 2GB available memory. Build may fail."
        return 1
    fi
    return 0
}

# Function to clean up Docker
cleanup_docker() {
    echo "🧹 Cleaning up Docker..."
    docker-compose -f docker-compose-prod.yml down 2>/dev/null || true
    docker-compose -f docker-compose.yml down 2>/dev/null || true
    docker-compose -f docker-compose-fast.yml down 2>/dev/null || true
    docker system prune -f
    docker builder prune -f
}

# Function to create minimal production build
create_minimal_build() {
    echo "📦 Creating minimal production build..."
    
    # Create minimal frontend Dockerfile
    cat > apps/frontend/Dockerfile.minimal << 'EOF'
FROM node:18-alpine

RUN apk add --no-cache libc6-compat
ENV NODE_OPTIONS="--max-old-space-size=1024"
ENV NODE_ENV=production

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/ ./packages/

# Install only production dependencies
RUN npm ci --only=production --no-audit --no-fund && npm cache clean --force

# Copy source
COPY apps/frontend/ ./apps/frontend/

WORKDIR /usr/src/app/apps/frontend

# Build at runtime to save image size
EXPOSE 3000
CMD ["sh", "-c", "npm run build && npm start"]
EOF

    # Create minimal backend Dockerfile
    cat > apps/backend/Dockerfile.minimal << 'EOF'
FROM node:18-alpine

RUN apk add --no-cache chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_OPTIONS="--max-old-space-size=1024"

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

RUN npm ci --only=production --no-audit --no-fund && npm cache clean --force

COPY apps/backend/src ./apps/backend/src

WORKDIR /usr/src/app/apps/backend
EXPOSE 3001
CMD ["node", "src/server.js"]
EOF
}

# Function for fast deployment
fast_deploy() {
    echo "⚡ Starting fast deployment..."
    
    cleanup_docker
    create_minimal_build
    
    # Build with timeouts and resource limits
    echo "🔨 Building backend (minimal)..."
    timeout 600 docker build -f apps/backend/Dockerfile.minimal -t aluminium-backend:minimal . || {
        echo "❌ Backend build failed"
        return 1
    }
    
    echo "🔨 Building frontend (minimal)..."
    timeout 900 docker build -f apps/frontend/Dockerfile.minimal -t aluminium-frontend:minimal . || {
        echo "❌ Frontend build failed"
        return 1
    }
    
    # Create minimal docker-compose
    cat > docker-compose-minimal.yml << 'EOF'
services:
  backend:
    image: aluminium-backend:minimal
    container_name: aluminium-backend-minimal
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - MONGO_URI=mongodb+srv://murtazakalang:happylife@cluster0.olbow0k.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
      - PORT=3001
      - FRONTEND_URL=http://34.47.207.4:3000
      - PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage
    depends_on:
      - mongo
    networks:
      - aluminium-network
    restart: unless-stopped

  frontend:
    image: aluminium-frontend:minimal
    container_name: aluminium-frontend-minimal
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://34.47.207.4/api
    depends_on:
      - backend
    networks:
      - aluminium-network
    restart: unless-stopped

  mongo:
    image: mongo:latest
    container_name: aluminium-mongo-minimal
    ports:
      - "27017:27017"
    volumes:
      - mongo-data-minimal:/data/db
    networks:
      - aluminium-network
    restart: unless-stopped
    command: mongod --wiredTigerCacheSizeGB 1

networks:
  aluminium-network:
    driver: bridge

volumes:
  mongo-data-minimal:
    driver: local
EOF
    
    echo "🚀 Starting minimal deployment..."
    docker-compose -f docker-compose-minimal.yml up -d
    
    if [ $? -eq 0 ]; then
        echo "✅ Fast deployment successful!"
        echo "📱 Frontend: http://34.47.207.4:3000"
        echo "🔧 Backend: http://34.47.207.4:3001"
        return 0
    else
        echo "❌ Fast deployment failed"
        return 1
    fi
}

# Function for development mode deployment
dev_deploy() {
    echo "🔧 Starting development mode deployment..."
    
    cleanup_docker
    
    # Use the fast docker-compose that we know works
    echo "🚀 Using development containers with production environment..."
    docker-compose -f docker-compose-fast.yml up -d
    
    if [ $? -eq 0 ]; then
        echo "✅ Development mode deployment successful!"
        return 0
    else
        echo "❌ Development mode deployment failed"
        return 1
    fi
}

# Main menu
echo ""
echo "Choose deployment option:"
echo "1) Fast Deploy (minimal build, fastest)"
echo "2) Development Mode (uses dev containers with prod env)"
echo "3) Clean and exit"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo "🚀 Selected: Fast Deploy"
        check_memory || echo "⚠️ Proceeding despite low memory..."
        fast_deploy
        ;;
    2)
        echo "🔧 Selected: Development Mode"
        dev_deploy
        ;;
    3)
        echo "🧹 Cleaning up..."
        cleanup_docker
        echo "✅ Cleanup complete"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo ""
    echo "📊 Monitor your application:"
    echo "   docker ps"
    echo "   docker logs aluminium-frontend-minimal -f"
    echo "   docker logs aluminium-backend-minimal -f"
else
    echo ""
    echo "❌ Deployment failed. Check the logs above for details."
    echo ""
    echo "💡 Troubleshooting tips:"
    echo "   1. Check available disk space: df -h"
    echo "   2. Check memory usage: free -h"
    echo "   3. Try option 2 (Development Mode) if option 1 failed"
    echo "   4. Consider upgrading to e2-standard-4 (4 vCPUs, 16GB RAM)"
fi 