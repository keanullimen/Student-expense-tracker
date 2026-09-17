# Student Expense Tracker

Web app sederhana untuk track pemasukan/pengeluaran kuliah. Frontend pakai vanilla JS `fetch()` (AJAX) yang manggil Vercel Serverless Function, data disimpan di Supabase (PostgreSQL gratis).

## 1. Setup Supabase (database)

1. Buat akun gratis di https://supabase.com dan buat project baru.
2. Buka **SQL Editor**, jalankan query ini untuk bikin tabel:

```sql
create extension if not exists "pgcrypto";

create table expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric not null,
  category text default 'lainnya',
  type text check (type in ('income','expense')) not null default 'expense',
  created_at timestamp with time zone default now()
);

-- Aktifkan Row Level Security (best practice, walau kita akses via service role)
alter table expenses enable row level security;
```

3. Buka **Project Settings > API**, catat:
   - `Project URL` → jadi `SUPABASE_URL` https://hqoweyyksrduddmqhsww.supabase.co/
   - `service_role` key (bukan `anon` key!) → jadi `SUPABASE_SERVICE_ROLE_KEY`
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb3dleXlrc3JkdWRkbXFoc3d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzODE3MywiZXhwIjoyMTA1MjE0MTczfQ.4ZCdRUhKzGBhNI4gkFsjYvz4pTxtCD2Q0uXodskjm1Y
   ⚠️ **service_role key punya akses penuh ke database** — ini kenapa dia HANYA dipakai di serverless function (`api/expenses.js`), TIDAK PERNAH dikirim ke browser/frontend.

## 2. Setup password aplikasi

Tentukan password bebas sendiri, ini jadi `APP_SECRET`. Ini proteksi sederhana supaya orang lain gak bisa akses API-mu tanpa tahu password.

## 3. Deploy ke Vercel

1. Push folder ini ke repo GitHub.
2. Buka https://vercel.com → **New Project** → import repo tersebut.
3. Sebelum deploy, buka **Environment Variables**, isi 3 variable ini:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_SECRET`
4. Klik **Deploy**.
5. Setelah selesai, buka URL yang diberikan Vercel → masukkan password (`APP_SECRET`) yang tadi kamu set → mulai pakai.

## Cara kerja singkat

- `index.html` + `script.js` → frontend, pakai `fetch()` untuk AJAX request ke `/api/expenses`.
- `api/expenses.js` → serverless function (jalan di server Vercel), handle GET/POST/DELETE, konek ke Supabase pakai service role key yang tersimpan aman di environment variable.
- Setiap request ke API wajib menyertakan header `x-app-secret` yang dicocokkan dengan `APP_SECRET` di server — ini lapisan keamanan dasarnya.

## Lokal development (opsional)

```bash
npm install -g vercel
npm install
vercel dev
```

Buat file `.env.local` (contoh isi ada di `.env.example`) sebelum jalanin `vercel dev`.

## Ide pengembangan lanjut

- Tambah tab "Jadwal Belajar" (tabel baru `study_sessions` di Supabase, endpoint baru `api/study.js`)
- Tambah filter by kategori/tanggal
- Export data ke CSV
