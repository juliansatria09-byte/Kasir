# Kasir WARKOP KU JKT

## Menjalankan aplikasi

    npm install
    npm run dev

## Konfigurasi MySQL

Atur `DATABASE_URL` ke connection URL MySQL berformat `mysql://USER:PASSWORD@HOST:3306/DATABASE`. Aplikasi membuat tabel yang dibutuhkan secara otomatis dan mengisi menu awal jika tabel produk masih kosong.

Contoh `.env.local` untuk pengembangan:

    DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
    DATABASE_SSL=disable
    ADMIN_SETUP_TOKEN=ganti-dengan-token-acak-panjang

Jangan commit `.env.local` atau membagikan token rahasia. Untuk koneksi database jarak jauh, aktifkan TLS dengan tidak mengatur `DATABASE_SSL=disable`.

## Membuat admin pertama

Atur `ADMIN_SETUP_TOKEN` sebagai environment variable di Railway, lalu buka halaman login dan pilih **Siapkan akun admin**. Masukkan token, nama pengguna admin, serta kata sandi minimal 12 karakter. Endpoint hanya mengizinkan pembuatan satu admin. Hapus `ADMIN_SETUP_TOKEN` dari environment setelah setup selesai.

Pendaftaran publik hanya membuat akun kasir. Kasir dapat melakukan transaksi dan melihat transaksinya sendiri. Hanya admin yang dapat menambah, mengubah, serta menghapus produk dan mengakses catatan dana. Hak akses diterapkan pada API server; cookie sesi bersifat HttpOnly dan kata sandi di-hash sebelum disimpan.

## Deployment

Railway harus memiliki service MySQL dan service aplikasi harus menggunakan `DATABASE_URL` yang merujuk ke URL MySQL tersebut, serta `ADMIN_SETUP_TOKEN` untuk membuat admin pertama. Setelah mengganti database, tabel akan dibuat otomatis; data yang tersimpan di service PostgreSQL lama tidak disalin. Pertahankan service PostgreSQL sampai yakin tidak ada data yang perlu dipindahkan.

Untuk menjalankan versi yang sama di Vercel, atur `DATABASE_URL` MySQL yang dapat diakses dari Vercel melalui dashboard dan deploy ulang. Jangan menyimpan nilai koneksi atau token di Git.
