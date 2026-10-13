# Kasir WARKOP KU JKT

## Menjalankan aplikasi

    npm install
    npm run dev

## Konfigurasi PostgreSQL

Atur `DATABASE_URL` ke PostgreSQL. Aplikasi membuat tabel yang diperlukan dan mengisi menu awal secara otomatis ketika pertama kali dibuka. Akun dan data produk, transaksi, serta dana disimpan bersama di database.

Contoh file `.env.local` untuk pengembangan:

    DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
    ADMIN_SETUP_TOKEN=ganti-dengan-token-acak-panjang

Jangan commit `.env.local` atau membagikan token rahasia.

## Membuat admin pertama

Atur `ADMIN_SETUP_TOKEN` sebagai environment variable di Railway, lalu buka halaman login dan pilih **Siapkan akun admin**. Masukkan token tersebut, nama pengguna admin, serta kata sandi minimal 12 karakter. Endpoint penyiapan mengizinkan pembuatan satu admin saja dan otomatis tertutup setelah admin pertama dibuat. Hapus `ADMIN_SETUP_TOKEN` dari environment setelah setup selesai.

Pendaftaran publik hanya membuat akun kasir. Kasir dapat melakukan transaksi dan melihat transaksinya sendiri. Hanya admin yang dapat menambah, mengubah, serta menghapus produk dan mengakses catatan dana. Hak akses diterapkan pada API server; cookie sesi bersifat HttpOnly dan kata sandi di-hash sebelum disimpan.

## Deployment

Deployment Railway memerlukan `DATABASE_URL` PostgreSQL dan `ADMIN_SETUP_TOKEN` di environment service aplikasi. Untuk menjalankan deployment Vercel dengan autentikasi dan data yang sama, atur environment variable yang sama melalui dashboard Vercel tanpa menaruh nilainya di Git. Setelah mengatur environment variable, deploy ulang aplikasi.
