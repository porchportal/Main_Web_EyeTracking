FROM node:23.11.0-alpine

# Set working directory
WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Build Next.js app
RUN npm run build

# Expose the frontend port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]