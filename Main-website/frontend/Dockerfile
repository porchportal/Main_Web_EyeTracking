FROM node:21-alpine

# Set working directory
WORKDIR /app

# Install dependencies for better performance
RUN apk add --no-cache libc6-compat

# Copy package manifests
COPY package*.json ./
COPY .env.frontend ./.env.frontend

# Install all dependencies (including devDependencies for build process)
RUN npm ci && npm cache clean --force

# Copy the entire frontend app
COPY . .

# Set environment variables for better Docker development
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV WATCHPACK_POLLING=true
# Suppress punycode deprecation warning
ENV NODE_OPTIONS="--no-deprecation"

# Expose the frontend port
EXPOSE 3010

# Start the development server with proper host configuration
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3010"]