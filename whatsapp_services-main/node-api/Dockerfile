# Gunakan image Node.js
FROM node:18-slim

# Tambahkan metadata build time
ARG BUILD_TIME
LABEL build_time="Build at ${BUILD_TIME}"

# Set batas memori Node.js
ENV NODE_OPTIONS="--max-old-space-size=1024"
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_DISABLE_DEV_SHM_USAGE=true

# Instal dependensi Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
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
    procps \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Tentukan working directory di dalam container
WORKDIR /app

# Salin file package.json dan package-lock.json
COPY package.json package-lock.json ./

# Install dependencies dengan mode produksi
RUN npm ci --only=production

RUN npm install

# Salin semua file proyek ke dalam container
COPY . .

# Buat direktori untuk sesi whatsapp dan atur izin
RUN mkdir -p /app/.wwebjs_auth && chmod -R 755 /app/.wwebjs_auth

# Perintah untuk menjalankan server
CMD ["node", "--no-warnings", "index.js"]