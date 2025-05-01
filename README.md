# WhatsApp Services - Railway Deployment Guide

## Tentang Project
Project ini terdiri dari dua komponen utama:
1. **node-api**: Backend API berbasis Node.js yang menangani integrasi WhatsApp
2. **dashboard**: Frontend untuk manajemen WhatsApp

## Persiapan Deployment ke Railway

### Langkah 1: Setup Database
1. Buat database MySQL di Railway App
2. Catat kredensial database yang diberikan oleh Railway:
   - Host
   - Username
   - Password
   - Database name
   - Port

### Langkah 2: Konfigurasi Environment Variables
1. Salin file `.env.example` menjadi `.env`
2. Isi kredensial database dari Railway
3. Sesuaikan nilai secret keys untuk keamanan

### Langkah 3: Deploy ke Railway
1. Login ke Railway CLI:
   ```
   railway login
   ```
2. Inisialisasi project:
   ```
   railway init
   ```
3. Link project dengan Railway:
   ```
   railway link
   ```
4. Deploy project:
   ```
   railway up
   ```

## Perbedaan dengan Deployment Original
- Database: Menggunakan database MySQL dari Railway, bukan server perusahaan original
- Environment: Menggunakan environment variables Railway
- Deployment: Single service deployment vs multi-container setup original

## Troubleshooting
- Pastikan semua environment variables sudah dikonfigurasi dengan benar
- Jika ada masalah dengan WhatsApp sessions, cek volume storage di Railway
- Untuk masalah puppeteer, pastikan buildpack sudah mendukung Chrome/Chromium

## Maintenance
- Backup database secara berkala
- Monitor penggunaan resource di Railway dashboard
- Update dependencies sesuai kebutuhan
