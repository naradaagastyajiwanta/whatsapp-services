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
ENV DISABLE_CRON_JOBS=false

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY node-api/package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY node-api/ ./

# Copy the Railway entry point
COPY railway-entry.js ./

# Create a health check endpoint file
RUN echo 'const express = require("express"); \
const app = express(); \
const port = process.env.PORT || 3000; \
app.get("/health", (req, res) => { \
  res.status(200).json({ status: "ok", message: "Health check passed" }); \
}); \
app.get("/", (req, res) => { \
  res.status(200).json({ status: "ok", message: "WhatsApp Services API is running" }); \
}); \
app.listen(port, "0.0.0.0", () => { \
  console.log(`Health check server running on port ${port}`); \
});' > health-server.js

# Expose port
EXPOSE 3000

# Create startup script
RUN echo '#!/bin/sh \
\nnode --no-warnings health-server.js & \
\nsleep 2 \
\nexec node --no-warnings railway-entry.js' > start.sh && chmod +x start.sh

# Start the application using the startup script
CMD ["./start.sh"]
