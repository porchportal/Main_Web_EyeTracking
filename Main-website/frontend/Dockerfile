FROM node:23.11.0-alpine

# Set working directory
WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire frontend app
COPY . .

# Expose the frontend port
EXPOSE 3010

# Start the development server
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]