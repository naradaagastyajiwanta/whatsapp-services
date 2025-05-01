FROM node:18-slim

# Install dependencies for bcrypt and Chromium
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    ca-certificates \
    fonts-liberation \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_DISABLE_DEV_SHM_USAGE=true

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY node-api/package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY node-api/ ./

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "--no-warnings", "index.js"]
