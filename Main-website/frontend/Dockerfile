FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install dependencies for better performance
RUN apk add --no-cache libc6-compat wget su-exec

# Copy package manifests
COPY package*.json ./

# Install dependencies
# Note: Using --prefer-offline for faster builds when packages are cached
RUN npm ci --prefer-offline --no-audit

# Copy environment file
COPY .env.frontend ./.env.frontend

# Copy the entire frontend app
COPY . .

# Copy and set up entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set environment variables for better Docker development
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV WATCHPACK_POLLING=true
# Suppress punycode deprecation warning
ENV NODE_OPTIONS="--no-deprecation"

# Expose the frontend port
EXPOSE 3010

# Use entrypoint script to handle permissions and user switching
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Start the development server with proper host configuration
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3010"]