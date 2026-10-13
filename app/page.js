"use client";
import { useEffect, useMemo, useState } from "react";

const rp = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
const SEED = [
  { id: 1, name: "Kopi Susu", category: "Minuman", price: 18000, stock: 50, image: "/images/kopi-susu.jpg" },
  { id: 2, name: "Teh Manis", category: "Minuman", price: 8000, stock: 80, image: "/images/teh-manis.jpg" },
  { id: 3, name: "Air Mineral", category: "Minuman", price: 5000, stock: 100, image: "/images/air-mineral.jpg" },
  { id: 4, name: "Nasi Goreng", category: "Makanan", price: 25000, stock: 30, image: "/images/nasi-goreng.jpg" },
  { id: 5, name: "Mie Ayam", category: "Makanan", price: 20000, stock: 30, image: "/images/mie-ayam.jpg" },
  { id: 6, name: "Roti Bakar", category: "Snack", price: 15000, stock: 40, image: "/images/roti-bakar.jpg" },
  { id: 7, name: "Kentang Goreng", category: "Snack", price: 17000, stock: 40, image: "/images/kentang-goreng.jpg" },
];
const LEGACY_SEED_IMAGE_IDS = {
  1: "photo-1461023058943-07fcbe16d735",
  2: "photo-1556679343-c7306c1976bc",
  3: "photo-1523362628745-0c100150b504",
  4: "photo-1512058564366-18510be2db19",
  5: "photo-1569718212165-3a8278d5f624",
  6: "photo-1525351484163-7529414344d8",
  7: "photo-1573080496219-bb080dd4f877",
};

function useStore(key, init) {
  const [v, setV] = useState(init);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setV(JSON.parse(saved));
    } catch (error) {
      console.error(`Gagal membaca data ${key} dari penyimpanan browser.`, error);
    } finally {
      setReady(true);
    }
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch (error) {
      console.error(`Gagal menyimpan data ${key} ke penyimpanan browser.`, error);
    }
  }, [key, v, ready]);
  return [v, setV, ready];
}

function Receipt({ sale, onClose }) {
  return (
    <div className="modal" onClick={onClose}>
      <div className="receipt" onClick={(e) => e.stopPropagation()}>
        <h3>STRUK PEMBAYARAN</h3>
        <div className="receipt-center">{new Date(sale.date).toLocaleString("id-ID")}</div>
        <div className="receipt-center">{sale.id}</div>
        <hr />
        {sale.items.map((i) => (
          <div key={i.id}>
            <div>{i.name}</div>
            <div className="row"><span>{i.qty} x {rp(i.price)}</span><span>{rp(i.qty * i.price)}</span></div>
          </div>
        ))}
        <hr />
        <div className="row"><span>Subtotal</span><span>{rp(sale.subtotal)}</span></div>
        {sale.discount > 0 && <div className="row"><span>Diskon</span><span>-{rp(sale.discount)}</span></div>}
        {sale.tax > 0 && <div className="row"><span>PPN 11%</span><span>{rp(sale.tax)}</span></div>}
        <div className="row"><b>Total</b><b>{rp(sale.total)}</b></div>
        <div className="row"><span>Bayar ({sale.method})</span><span>{rp(sale.paid)}</span></div>
        <div className="row"><span>Kembali</span><span>{rp(sale.change)}</span></div>
        <hr />
        <div className="receipt-center">Terima kasih</div>
        <div className="actions">
          <button className="pri" onClick={() => window.print()}>Cetak</button>
          <button onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, detail, tone = "" }) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-icon" aria-hidden="true">{icon}</div>
      <div className="stat-copy"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>
    </div>
  );
}

function Kasir({ products, setProducts, sales, setSales, onDone, funds }) {
  const [cart, setCart] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Semua");
  const [disc, setDisc] = useState(0);
  const [ppn, setPpn] = useState(false);
  const [method, setMethod] = useState("Tunai");
  const [paid, setPaid] = useState("");

  const cats = ["Semua", ...new Set(products.map((p) => p.category))];
  const list = products.filter((p) => (cat === "Semua" || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase()));
  const inCart = (id) => cart.find((c) => c.id === id)?.qty || 0;
  const add = (product) => {
    if (!product || inCart(product.id) >= product.stock) return;
    setCart((current) => current.some((item) => item.id === product.id)
      ? current.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
      : [...current, { id: product.id, name: product.name, price: product.price, qty: 1 }]);
  };
  const dec = (id) => setCart((current) => current.flatMap((item) => item.id === id ? (item.qty > 1 ? [{ ...item, qty: item.qty - 1 }] : []) : [item]));
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = Math.round(subtotal * Math.min(Math.max(+disc || 0, 0), 100) / 100);
  const tax = ppn ? Math.round((subtotal - discount) * 0.11) : 0;
  const total = subtotal - discount + tax;
  const pay = method === "Tunai" ? +paid || 0 : total;
  const change = pay - total;
  const ok = cart.length > 0 && pay >= total;
  const today = new Date().toDateString();
  const todaySales = sales.filter((sale) => new Date(sale.date).toDateString() === today);
  const revenueToday = todaySales.reduce((sum, sale) => sum + sale.total, 0);
  const fundBalance = funds.reduce((sum, entry) => sum + (entry.type === "Masuk" ? entry.amount : -entry.amount), 0);
  const checkout = () => {
    if (!ok) return;
    const sale = { id: "TRX-" + Date.now(), date: new Date().toISOString(), items: cart, subtotal, discount, tax, total, method, paid: pay, change };
    setSales([sale, ...sales]);
    setProducts(products.map((product) => {
      const item = cart.find((line) => line.id === product.id);
      return item ? { ...product, stock: product.stock - item.qty } : product;
    }));
    setCart([]); setDisc(0); setPpn(false); setPaid(""); onDone(sale);
  };
  const quick = [...new Set([total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, 100000])].filter((n) => n >= total && n > 0);

  return (
    <>
      <div className="welcome-row">
        <div><p className="eyebrow">RINGKASAN HARI INI</p><h2>Selamat bertugas 👋</h2><p>Kelola pesanan dan pantau ringkasan tokomu.</p></div>
        <div className="date-pill">{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
      </div>
      <div className="stats">
        <div className="stat-enter" style={{ "--enter-index": 0 }}><Stat icon="↗" label="Penjualan hari ini" value={rp(revenueToday)} detail={`${todaySales.length} transaksi`} tone="green" /></div>
        <div className="stat-enter" style={{ "--enter-index": 1 }}><Stat icon="▤" label="Transaksi hari ini" value={todaySales.length} detail="Transaksi berhasil" tone="blue" /></div>
        <div className="stat-enter" style={{ "--enter-index": 2 }}><Stat icon="◉" label="Produk tersedia" value={products.length} detail={`${products.filter((product) => product.stock <= 5).length} stok menipis`} tone="amber" /></div>
        <div className="stat-enter" style={{ "--enter-index": 3 }}><Stat icon="Rp" label="Saldo kas tercatat" value={rp(fundBalance)} detail="Dari catatan dana" tone="purple" /></div>
      </div>
      <div className="pos">
        <section className="product-area">
          <div className="section-heading"><div><p className="eyebrow">MENU TOKO</p><h2>Pilih produk</h2></div><span className="product-count">{list.length} produk</span></div>
          <div className="bar">
            <input aria-label="Cari produk" placeholder="⌕  Cari nama produk..." value={q} onChange={(e) => setQ(e.target.value)} />
            <select aria-label="Filter kategori" value={cat} onChange={(e) => setCat(e.target.value)}>{cats.map((category) => <option key={category}>{category}</option>)}</select>
          </div>
          <div className="grid">
            {list.map((product, index) => (
              <button key={product.id} className="item" style={{ "--enter-index": index }} onClick={() => add(product)} disabled={product.stock - inCart(product.id) <= 0}>
                <div className="product-image-wrap"><img className="product-image" src={product.image || SEED.find((item) => item.id === product.id)?.image || "/images/kopi-susu.jpg"} alt={product.name} loading="lazy" /><span className="add-product" aria-hidden="true">+</span></div>
                <span className="product-category">{product.category}</span><b>{product.name}</b>
                <div className="product-meta"><span className="p">{rp(product.price)}</span><small>{product.stock - inCart(product.id) <= 0 ? "Stok habis" : `Stok ${product.stock - inCart(product.id)}`}</small></div>
              </button>
            ))}
            {!list.length && <div className="empty">Produk tidak ditemukan.</div>}
          </div>
        </section>

        <aside className="card cart">
          <div className="cart-heading"><div><p className="eyebrow">TRANSAKSI BARU</p><h2>Pesanan</h2></div><span className="cart-count">{cart.reduce((sum, item) => sum + item.qty, 0)} item</span></div>
          {!cart.length && <div className="empty cart-empty"><span>🛍️</span><b>Pesanan masih kosong</b><small>Pilih produk untuk memulai transaksi.</small></div>}
          {cart.map((item) => (
            <div className="line" key={item.id}>
              <div><div className="line-name">{item.name}</div><small>{rp(item.price)}</small></div>
              <div className="qty"><button onClick={() => dec(item.id)} aria-label="Kurangi">−</button><span>{item.qty}</span><button onClick={() => add(products.find((product) => product.id === item.id))} aria-label="Tambah">+</button></div>
              <b>{rp(item.price * item.qty)}</b>
            </div>
          ))}
          <div className="fields">
            <label>Diskon (%)<input type="number" min="0" max="100" value={disc} onChange={(e) => setDisc(e.target.value)} /></label>
            <label>Metode<select value={method} onChange={(e) => setMethod(e.target.value)}><option>Tunai</option><option>QRIS</option><option>Debit</option></select></label>
          </div>
          <label className="tax-option"><input type="checkbox" checked={ppn} onChange={(e) => setPpn(e.target.checked)} />Tambah PPN 11%</label>
          <div className="row subtotal-row"><span>Subtotal</span><span>{rp(subtotal)}</span></div>
          {discount > 0 && <div className="row"><span>Diskon</span><span>-{rp(discount)}</span></div>}
          {tax > 0 && <div className="row"><span>PPN</span><span>{rp(tax)}</span></div>}
          <div className="row total"><span>Total pembayaran</span><span>{rp(total)}</span></div>
          {method === "Tunai" && (
            <div className="payment-box">
              <label>Uang diterima<input type="number" placeholder="Masukkan nominal" value={paid} onChange={(e) => setPaid(e.target.value)} /></label>
              <div className="quick">{quick.map((amount) => <button key={amount} onClick={() => setPaid(String(amount))}>{rp(amount)}</button>)}</div>
              <div className="row change-row"><span>Kembalian</span><b>{rp(Math.max(change, 0))}</b></div>
            </div>
          )}
          <div className="actions"><button onClick={() => setCart([])} disabled={!cart.length}>Kosongkan</button><button className="pri" onClick={checkout} disabled={!ok}>Bayar sekarang <span aria-hidden="true">→</span></button></div>
        </aside>
      </div>
    </>
  );
}

function Riwayat({ sales, onOpen }) {
  const todaySales = sales.filter((sale) => new Date(sale.date).toDateString() === new Date().toDateString());
  const exportCsv = () => {
    const rows = [["ID", "Tanggal", "Metode", "Total"], ...sales.map((sale) => [sale.id, sale.date, sale.method, sale.total])];
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv" }));
    link.download = "riwayat-transaksi.csv"; link.click(); URL.revokeObjectURL(link.href);
  };
  return (
    <>
      <div className="welcome-row"><div><p className="eyebrow">LAPORAN TOKO</p><h2>Riwayat transaksi</h2><p>Pantau penjualan dan cetak ulang struk.</p></div></div>
      <div className="stats">
        <Stat icon="↗" label="Penjualan hari ini" value={rp(todaySales.reduce((sum, sale) => sum + sale.total, 0))} tone="green" />
        <Stat icon="▤" label="Transaksi hari ini" value={todaySales.length} tone="blue" />
        <Stat icon="◷" label="Semua transaksi" value={sales.length} tone="amber" />
      </div>
      <div className="card table-card">
        <div className="section-heading"><div><h2>Semua transaksi</h2><p>Daftar transaksi penjualan tokomu.</p></div><button onClick={exportCsv} disabled={!sales.length}>Unduh CSV</button></div>
        {!sales.length ? <div className="empty">Belum ada transaksi.</div> : (
          <div className="table-scroll"><table><thead><tr><th>ID</th><th>Waktu</th><th>Metode</th><th className="r">Total</th><th></th></tr></thead><tbody>{sales.map((sale) => (
            <tr key={sale.id}><td><b>{sale.id}</b></td><td>{new Date(sale.date).toLocaleString("id-ID")}</td><td><span className="status-pill">{sale.method}</span></td><td className="r">{rp(sale.total)}</td><td className="r"><button onClick={() => onOpen(sale)}>Lihat struk</button></td></tr>
          ))}</tbody></table></div>
        )}
      </div>
    </>
  );
}

function Produk({ products, setProducts }) {
  const blank = { name: "", category: "", price: "", stock: "", image: "" };
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const valid = form.name.trim() && form.category.trim() && +form.price > 0 && form.stock !== "" && +form.stock >= 0;
  const save = () => {
    if (!valid) return;
    const data = { name: form.name.trim(), category: form.category.trim(), price: +form.price, stock: +form.stock, image: form.image.trim() };
    setProducts(editId ? products.map((product) => product.id === editId ? { ...product, ...data } : product) : [...products, { id: Date.now(), ...data }]);
    setForm(blank); setEditId(null);
  };
  return (
    <>
      <div className="welcome-row"><div><p className="eyebrow">INVENTARIS</p><h2>Kelola produk</h2><p>Atur menu, harga, stok, dan foto produk.</p></div></div>
      <div className="card product-form-card">
        <h2>{editId ? "Ubah produk" : "Tambah produk baru"}</h2>
        <div className="form">
          <input aria-label="Nama produk" placeholder="Nama produk" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input aria-label="Kategori" placeholder="Kategori" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input aria-label="Harga" type="number" min="1" placeholder="Harga (Rp)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <input aria-label="Stok" type="number" min="0" placeholder="Stok" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          <input className="image-url-input" aria-label="URL foto produk" type="url" placeholder="URL foto produk (opsional)" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
          <div className="form-buttons"><button className="pri" onClick={save} disabled={!valid}>{editId ? "Simpan perubahan" : "Tambah produk"}</button>{editId && <button onClick={() => { setEditId(null); setForm(blank); }}>Batal</button>}</div>
        </div>
      </div>
      <div className="card table-card">
        <div className="section-heading"><div><h2>Daftar produk</h2><p>{products.length} produk terdaftar</p></div></div>
        <div className="table-scroll"><table><thead><tr><th>Produk</th><th>Kategori</th><th className="r">Harga</th><th className="r">Stok</th><th></th></tr></thead><tbody>{products.map((product) => (
          <tr key={product.id}><td><div className="table-product"><img src={product.image || "https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=160&q=80"} alt="" /><b>{product.name}</b></div></td><td>{product.category}</td><td className="r">{rp(product.price)}</td><td className="r">{product.stock}</td><td className="r"><button onClick={() => { setEditId(product.id); setForm({ name: product.name, category: product.category, price: product.price, stock: product.stock, image: product.image || "" }); }}>Ubah</button>{" "}<button className="danger" onClick={() => { if (confirm(`Hapus ${product.name}?`)) setProducts(products.filter((item) => item.id !== product.id)); }}>Hapus</button></td></tr>
        ))}</tbody></table></div>
      </div>
    </>
  );
}

function Keuangan({ funds, setFunds }) {
  const [form, setForm] = useState({ type: "Masuk", note: "", amount: "", date: new Date().toISOString().slice(0, 10) });
  const totals = useMemo(() => funds.reduce((result, entry) => {
    result[entry.type === "Masuk" ? "income" : "expense"] += entry.amount;
    return result;
  }, { income: 0, expense: 0 }), [funds]);
  const valid = form.note.trim() && +form.amount > 0 && form.date;
  const addEntry = (event) => {
    event.preventDefault();
    if (!valid) return;
    setFunds([{ id: Date.now(), ...form, note: form.note.trim(), amount: +form.amount }, ...funds]);
    setForm({ ...form, note: "", amount: "" });
  };
  return (
    <>
      <div className="welcome-row"><div><p className="eyebrow">ARUS KAS</p><h2>Catatan dana</h2><p>Catat setiap dana masuk dan pengeluaran tokomu.</p></div></div>
      <div className="stats">
        <Stat icon="↓" label="Total dana masuk" value={rp(totals.income)} detail={`${funds.filter((entry) => entry.type === "Masuk").length} catatan`} tone="green" />
        <Stat icon="↑" label="Total pengeluaran" value={rp(totals.expense)} detail={`${funds.filter((entry) => entry.type === "Keluar").length} catatan`} tone="red" />
        <Stat icon="Rp" label="Saldo dana" value={rp(totals.income - totals.expense)} detail="Dana masuk dikurangi keluar" tone="purple" />
      </div>
      <div className="finance-grid">
        <form className="card finance-form" onSubmit={addEntry}>
          <p className="eyebrow">CATAT DANA</p><h2>Tambah catatan</h2>
          <label>Jenis catatan<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Masuk</option><option>Keluar</option></select></label>
          <label>Keterangan<input placeholder="Contoh: Belanja bahan baku" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          <label>Nominal (Rp)<input type="number" min="1" placeholder="Masukkan nominal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          <label>Tanggal<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <button className="pri" type="submit" disabled={!valid}>Simpan catatan</button>
        </form>
        <div className="card table-card finance-history">
          <div className="section-heading"><div><h2>Riwayat dana</h2><p>Semua catatan pemasukan dan pengeluaran.</p></div></div>
          {!funds.length ? <div className="empty">Belum ada catatan dana.</div> : <div className="fund-list">{funds.map((entry) => (
            <div className="fund-entry" key={entry.id}>
              <div className={`fund-icon ${entry.type === "Masuk" ? "income" : "expense"}`}>{entry.type === "Masuk" ? "↓" : "↑"}</div>
              <div className="fund-info"><b>{entry.note}</b><small>{new Date(`${entry.date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} · Dana {entry.type.toLowerCase()}</small></div>
              <strong className={entry.type === "Masuk" ? "income-text" : "expense-text"}>{entry.type === "Masuk" ? "+" : "−"}{rp(entry.amount)}</strong>
              <button className="icon-button danger" aria-label={`Hapus catatan ${entry.note}`} onClick={() => setFunds(funds.filter((item) => item.id !== entry.id))}>×</button>
            </div>
          ))}</div>}
        </div>
      </div>
    </>
  );
}

function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const submit = (event) => {
    event.preventDefault();
    const normalizedUsername = username.trim();
    if (mode === "register") {
      if (!normalizedUsername || !password) {
        setError("Nama pengguna dan kata sandi wajib diisi.");
        return;
      }
      if (password.length < 6) {
        setError("Kata sandi harus terdiri dari minimal 6 karakter.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Konfirmasi kata sandi tidak cocok.");
        return;
      }
      try {
        const accounts = JSON.parse(localStorage.getItem("kasir.accounts") || "[]");
        if (!Array.isArray(accounts)) throw new Error("Format data akun tidak valid.");
        if (accounts.some((account) => account.username.toLowerCase() === normalizedUsername.toLowerCase())) {
          setError("Nama pengguna sudah digunakan. Silakan pilih nama lain.");
          return;
        }
        localStorage.setItem("kasir.accounts", JSON.stringify([...accounts, { username: normalizedUsername, password }]));
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setNotice("Pendaftaran berhasil. Silakan masuk dengan akun baru.");
        setError("");
      } catch (storageError) {
        console.error("Gagal menyimpan akun baru.", storageError);
        setError("Akun tidak dapat disimpan di browser ini. Periksa pengaturan penyimpanan browser.");
      }
      return;
    }
    let validAccount = normalizedUsername.toLowerCase() === "kasir" && password === "1234";
    try {
      const accounts = JSON.parse(localStorage.getItem("kasir.accounts") || "[]");
      if (!Array.isArray(accounts)) throw new Error("Format data akun tidak valid.");
      validAccount ||= accounts.some((account) => account.username.toLowerCase() === normalizedUsername.toLowerCase() && account.password === password);
    } catch (storageError) {
      console.error("Gagal membaca akun yang tersimpan.", storageError);
      setError("Data akun tidak dapat dibaca. Periksa penyimpanan browser.");
      return;
    }
    if (!validAccount) {
      setError("Nama pengguna atau kata sandi belum benar.");
      return;
    }
    setError("");
    onLogin();
  };
  return (
    <main className="login-page">
      <section className="login-art">
        <div className="brand login-brand"><span className="brand-mark">W</span><span>WARKOP KU JKT</span></div>
        <div className="login-promo">
          <span className="promo-tag">SISTEM KASIR TOKO</span>
          <h1>Kelola toko,<br />lebih <em>mudah.</em></h1>
          <p>Penjualan, stok produk, dan catatan keuangan dalam satu tempat.</p>
          <div className="promo-orbit orbit-one"></div><div className="promo-orbit orbit-two"></div>
          <div className="promo-card"><span className="promo-card-icon">↗</span><span><small>Penjualan hari ini</small><b>Semua tercatat rapi</b></span><span className="promo-spark">✳</span></div>
        </div>
        <div className="login-art-footer">PENGELOLAAN TOKO YANG LEBIH RINGKAS</div>
      </section>
      <section className="login-side">
        <div className="login-box">
          <div className="mobile-brand brand login-brand"><span className="brand-mark">W</span><span>WARKOP KU JKT</span></div>
          <p className="eyebrow">{mode === "login" ? "SELAMAT DATANG KEMBALI" : "MULAI BERSAMA KAMI"}</p>
          <h2>{mode === "login" ? "Masuk ke akunmu" : "Buat akun baru"}</h2>
          <p className="login-description">{mode === "login" ? "Silakan masuk untuk membuka halaman kasir." : "Daftarkan akun untuk mulai mengelola tokomu."}</p>
          <form onSubmit={submit}>
            <label>Nama pengguna<div className="login-input"><span aria-hidden="true">◎</span><input autoComplete="username" placeholder="Masukkan nama pengguna" value={username} onChange={(e) => setUsername(e.target.value)} /></div></label>
            <label>Kata sandi<div className="login-input"><span aria-hidden="true">⌑</span><input autoComplete={mode === "login" ? "current-password" : "new-password"} type={showPassword ? "text" : "password"} placeholder={mode === "login" ? "Masukkan kata sandi" : "Buat kata sandi (min. 6 karakter)"} value={password} onChange={(e) => setPassword(e.target.value)} /><button className="show-password" type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Sembunyikan" : "Lihat"}</button></div></label>
            {mode === "register" && <label>Konfirmasi kata sandi<div className="login-input"><span aria-hidden="true">⌑</span><input autoComplete="new-password" type={showPassword ? "text" : "password"} placeholder="Ulangi kata sandi" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div></label>}
            {error && <div className="login-error" role="alert">{error}</div>}
            {notice && <div className="login-notice" role="status">{notice}</div>}
            <button className="pri login-submit" type="submit">{mode === "login" ? "Masuk ke kasir" : "Daftar akun"} <span aria-hidden="true">→</span></button>
          </form>
          <p className="auth-switch">{mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"} <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setNotice(""); }}> {mode === "login" ? "Daftar sekarang" : "Masuk di sini"}</button></p>
        </div>
      </section>
    </main>
  );
}

export default function Page() {
  const [tab, setTab] = useState("kasir");
  const [products, setProducts, productsReady] = useStore("kasir.products", SEED);
  const [sales, setSales] = useStore("kasir.sales", []);
  const [funds, setFunds] = useStore("kasir.funds", []);
  const [receipt, setReceipt] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    try { setAuthenticated(sessionStorage.getItem("kasir.authenticated") === "true"); }
    catch (error) { console.error("Gagal membaca status login.", error); }
    finally { setAuthReady(true); }
  }, []);
  useEffect(() => {
    if (!productsReady) return;
    setProducts((current) => current.map((product) => {
      const legacyImageId = LEGACY_SEED_IMAGE_IDS[product.id];
      const seed = SEED.find((item) => item.id === product.id);
      return seed && legacyImageId && product.image?.includes(legacyImageId)
        ? { ...product, image: seed.image }
        : product;
    }));
  }, [productsReady, setProducts]);
  const login = () => {
    try { sessionStorage.setItem("kasir.authenticated", "true"); }
    catch (error) { console.error("Gagal menyimpan status login.", error); }
    setAuthenticated(true);
  };
  const logout = () => {
    try { sessionStorage.removeItem("kasir.authenticated"); }
    catch (error) { console.error("Gagal menghapus status login.", error); }
    setAuthenticated(false); setTab("kasir");
  };
  const tabs = [["kasir", "Kasir", "▦"], ["riwayat", "Riwayat", "◷"], ["produk", "Produk", "▧"], ["keuangan", "Catatan dana", "↕"]];
  if (!authReady) return <main className="loading-screen"><span className="brand-mark">K</span></main>;
  if (!authenticated) return <Login onLogin={login} />;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">K</span><span>Kasir<span className="brand-dot">.</span></span></div>
        <p className="nav-label">MENU UTAMA</p>
        <nav aria-label="Menu utama">{tabs.map(([key, label, icon]) => <button key={key} className={`nav-link ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}><span className="nav-icon" aria-hidden="true">{icon}</span>{label}{tab === key && <span className="active-indicator"></span>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="profile"><div className="avatar">K</div><div><b>Kasir Toko</b><small>Administrator</small></div><button className="logout-button" aria-label="Keluar" onClick={logout} title="Keluar">↪</button></div></div>
      </aside>
      <div className="main-column">
        <header className="topbar"><div><span className="topbar-store">{tabs.find(([key]) => key === tab)?.[1]}</span></div><div className="topbar-right"><span className="open-indicator"></span><span>Toko buka</span><div className="topbar-avatar">K</div></div></header>
        <main className="wrap">
          <div key={tab} className="tab-transition">
            {tab === "kasir" && <Kasir products={products} setProducts={setProducts} sales={sales} setSales={setSales} onDone={setReceipt} funds={funds} />}
            {tab === "riwayat" && <Riwayat sales={sales} onOpen={setReceipt} />}
            {tab === "produk" && <Produk products={products} setProducts={setProducts} />}
            {tab === "keuangan" && <Keuangan funds={funds} setFunds={setFunds} />}
          </div>
        </main>
      </div>
      {receipt && <Receipt sale={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
