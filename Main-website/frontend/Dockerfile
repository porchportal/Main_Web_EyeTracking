FROM node:23.11.0-alpine

# Set working directory
WORKDIR /app

# Copy package manifests from root
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the frontend directory
COPY frontend/ ./frontend/

# Set working directory to frontend for the app
WORKDIR /app/frontend

# Expose the frontend port
EXPOSE 3010

# Start the development server
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]