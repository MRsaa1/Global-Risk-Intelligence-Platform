FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (only runtime, no dev dependencies)
RUN npm ci --only=production && npm install -g tsx

# Copy source
COPY src ./src

# Expose port
EXPOSE 9002

# Set environment
ENV PORT=9002
ENV NODE_ENV=production

# Start using tsx to run TypeScript directly
# Use secure version in production, simple version for development
CMD ["tsx", "src/${MAIN_FILE:-main-secure}.ts"]

