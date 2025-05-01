# Gunakan image Node.js
FROM node:18-slim

# Tambahkan metadata build time
ARG BUILD_TIME
LABEL build_time="Build at ${BUILD_TIME}"

# Tentukan working directory di dalam container
WORKDIR /app

# Salin file package.json dan package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Salin semua file proyek ke dalam container
COPY . .

# Perintah untuk menjalankan server
CMD ["node", "index.js"]
