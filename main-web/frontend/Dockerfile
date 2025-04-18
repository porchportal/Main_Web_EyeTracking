
FROM node:23.10.0

# Set working directory
WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies from package-lock.json (for reproducible builds)
RUN npm ci

# Copy the rest of the app
COPY . .

# Build Next.js app
RUN npm run build

# Expose the frontend port
EXPOSE 3000

# Run Next.js in production
CMD ["npm", "start"]