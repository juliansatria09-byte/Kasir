# Web Kasir (Next.js)

Jalankan aplikasi:

    npm install
    npm run dev

Buka http://localhost:3000. Masuk menggunakan akun demo **kasir** dengan kata sandi **1234**, atau buat akun dari tautan **Daftar sekarang** di halaman depan.

Aplikasi menyediakan transaksi kasir, riwayat penjualan, inventaris produk dengan URL foto, dan catatan dana masuk/keluar. Data akun, produk, transaksi, dan catatan dana tersimpan di `localStorage` browser; status login hanya disimpan selama sesi browser. Pendaftaran dan login ini hanya untuk prototipe lokal, bukan autentikasi aman untuk penggunaan produksi.
