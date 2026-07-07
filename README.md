# 🎫 VibeCheck Concert & Event Ticketing System

**VibeCheck** adalah platform penjualan, manajemen, dan pemindaian tiket konser/acara (event ticketing system) modern berbasis web. Sistem ini dirancang menggunakan arsitektur modern Next.js, basis data relasional Supabase, serta didesain dengan visual bertema **Brutalist Premium** yang interaktif.

---

## 🚀 Fitur Utama

### 🧑‍💻 Portal Guest / Pembeli
- **Pencarian Acara**: Telusuri konser dan acara musik aktif.
- **Pembelian Tiket & Checkout**: Proses pembelian tiket interaktif, pemilihan kategori, pengunggahan bukti bayar, dan akses ke metode pembayaran (unduh QRIS dinamis & salin rekening bank).
- **Ticket Vault**: Tempat penyimpanan tiket digital pembeli, lengkap dengan status (`PENDING`, `VALID`, `USED`, `EXPIRED`), fitur unduh tiket fisik (.png), serta QR Code unik per tiket (`ORD-...`).
- **Sesi Keamanan Aktivitas**: Keamanan sesi masuk yang melacak aktivitas pengguna dan melakukan logout otomatis jika pengguna tidak aktif dalam jangka waktu lama.

### 👑 Portal Administrator
- **Dashboard Overview**: Pemantauan real-time untuk pendapatan kotor, tiket terjual, acara aktif, dan antrean persetujuan pembayaran.
- **Laporan & Analisis Data**: Tab khusus laporan yang menyajikan grafik pendapatan mingguan/bulanan, rincian pendapatan berdasarkan genre musik, serta opsi cetak laporan fisik.
- **Konfigurasi Pembayaran (Payment Config)**: Panel pengaturan mandiri untuk mengunggah barcode QRIS toko serta nomor rekening bank (BCA, BNI, Mandiri, BRI).
- **Pembelian Offline**: Memungkinkan admin mendaftarkan transaksi tunai langsung di tempat, secara otomatis memisahkan pembelian tiket berkelipatan menjadi transaksi unik agar setiap tiket memiliki barcode `ORD-` yang berbeda.
- **Pemindai Tiket (Ticket Scanner)**: Halaman scanner (menggunakan kamera HP/webcam atau input manual) untuk memindai tiket penonton di gerbang masuk secara real-time dan mencegah pemindaian ganda (double-scan).

---

## 🛠️ Tech Stack & Arsitektur
- **Frontend / Backend**: Next.js 15+ (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS (Desain Neobrutalism/Brutalist)
- **Database & Auth**: Supabase (PostgreSQL, Row-Level Security Policies, Database Storage)
- **Email Dispatch**: Resend API (Pengiriman tiket elektronik otomatis dengan QR Code langsung ke Gmail pembeli)

---

## 📦 Panduan Instalasi & Setup Lokal

### 1. Klon Repositori & Instal Dependensi
Pastikan Anda telah menginstal [Node.js](https://nodejs.org/). Jalankan perintah berikut di terminal:
```bash
npm install
```

### 2. Setup Environment Variables (`.env.local`)
Buat berkas bernama `.env.local` di direktori utama (root) proyek dan isi variabel berikut:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=re_your_resend_api_key
```

### 3. Setup Basis Data Supabase
Jalankan skrip pembentukan tabel berikut di dalam **SQL Editor** Supabase Anda:

#### Tabel Pengaturan Pembayaran:
```sql
CREATE TABLE IF NOT EXISTS public.payment_settings (
    id integer PRIMARY KEY DEFAULT 1,
    qris_url text NOT NULL,
    bca text,
    bni text,
    mandiri text,
    bri text,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT one_row_only CHECK (id = 1)
);

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select access" ON public.payment_settings FOR SELECT TO public USING (true);
CREATE POLICY "Allow write/update access to admins" ON public.payment_settings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN'))
);
```

*(Catatan: Pastikan tabel `events`, `ticket_tiers`, `orders`, `tickets`, dan `profiles` sudah terkonfigurasi sesuai dengan relasi UUID).*

---

## 💻 Cara Menjalankan Proyek

### Mode Pengembangan (Development)
Jalankan server lokal untuk melakukan modifikasi kode secara real-time:
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

### Mode Produksi (Production Build)
Untuk melakukan kompilasi proyek dan menjalankannya dengan performa optimal:
```bash
npm run build
npm run start
```

---

## 📂 Struktur Folder Utama
```text
├── src/
│   ├── app/
│   │   ├── admin/                # Portal & Fitur Administrator (Dashboard, Scanner, Config, Offline)
│   │   ├── guest/                # Portal & Fitur Pembeli (Checkout, Ticket Vault)
│   │   ├── api/                  # API Routes (Send Email Notification via Resend)
│   │   ├── login/                # Sesi Login Utama
│   │   └── layout.tsx            # Root Layout
│   ├── components/               # Komponen UI Reusable (Input Brutalist, Timeout Listener, dll)
│   └── utils/
│       └── supabase/             # Inisialisasi Klien Supabase (Browser/Server client)
├── public/                       # Aset Statis (Gambar, Ikon, dll)
├── .gitignore                    # Konfigurasi pengabaian repositori Git
└── package.json                  # Dependensi proyek
```

---

## 📝 Catatan Tambahan Pemindaian
- Untuk melakukan simulasi pemindaian, pastikan webcam perangkat aktif atau gunakan fitur **Input Manual Code** di halaman Scanner Admin dengan mengetikkan kode pesanan (`ORD-XXXXX`) yang tertera pada tiket Gmail atau halaman Guest Ticket.
