# Panduan Deployment WhatsApp Services ke Railway App

## Persiapan yang Telah Dilakukan

Beberapa file konfigurasi telah dibuat untuk memudahkan deployment ke Railway:

1. **Konfigurasi Database**: Aplikasi telah dikonfigurasi untuk menggunakan PostgreSQL Railway
2. **File Railway**: `railway.toml`, `nixpacks.toml`, dan `Procfile` telah dibuat
3. **Penyesuaian Kode**: Kode telah disesuaikan untuk mendukung PostgreSQL dan Railway

## Langkah-langkah Deployment

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
```

### 2. Login ke Railway
```bash
railway login
```

### 3. Inisialisasi Project Railway
```bash
railway init
```
Pilih "Create new project" saat diminta.

### 4. Tambahkan Database PostgreSQL
```bash
railway add
```
Pilih "PostgreSQL" dari daftar plugin yang tersedia.

### 5. Konfigurasi Environment Variables
Kredensial database akan otomatis ditambahkan oleh Railway. Namun, Anda perlu menambahkan variabel lain yang diperlukan:

```bash
railway variables set SESSION_SECRET=your_new_secret_key
railway variables set JWT_SECRET=your_new_jwt_secret_key
railway variables set JWT_EXPIRES_IN=7d
railway variables set MAX_CONCURRENT_CLIENTS=10
```

### 6. Deploy Aplikasi
```bash
railway up
```

### 7. Buka Aplikasi
```bash
railway open
```

## Monitoring dan Troubleshooting

### Melihat Log
```bash
railway logs
```

### Restart Aplikasi
```bash
railway service restart
```

### Melihat Status
```bash
railway status
```

## Migrasi Data (Jika Diperlukan)

Jika Anda perlu memigrasikan data dari MySQL ke PostgreSQL:

1. Ekspor data dari MySQL lama
2. Konversi format data jika diperlukan
3. Impor ke PostgreSQL Railway

## Perbedaan dengan Setup Original

1. **Database**: PostgreSQL alih-alih MySQL
2. **Deployment**: Single service alih-alih multi-container
3. **Environment**: Menggunakan Railway environment variables

## Keamanan

Pastikan untuk mengganti semua secret keys default dengan nilai yang aman dan unik untuk lingkungan produksi Anda.

## Pemeliharaan

- Backup database secara berkala
- Pantau penggunaan resource di dashboard Railway
- Update dependencies secara berkala untuk keamanan
