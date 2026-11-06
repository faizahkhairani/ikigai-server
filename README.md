## Struktur Folder

```
src/
  routes/         # Peta URL -> controller. TIDAK ada business logic di sini.
  controllers/     # Jembatan HTTP: baca req, panggil service, kirim res.
  services/        # Semua business logic + satu-satunya yang manggil Prisma.
  middleware/       # requireAdminAuth (verify JWT)
  lib/              # Setup client eksternal (Prisma, Supabase Storage)
  utils/            # Helper murni (normalizePhone, dll)
  index.js          # Entry point, gabungin semua route
```

## Setup

1. Install dependencies
   ```bash
   npm install
   ```

2. Copy `.env.example` jadi `.env`, isi dengan kredensial Supabase kamu:
   ```bash
   cp .env.example .env
   ```
   - `DATABASE_URL` & `DIRECT_URL` -> **Project Settings -> Database -> Connection String**
   - `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` -> **Project Settings -> API**

3. Generate Prisma client dan migration pertama:
   ```bash
   npm run prisma:migrate
   ```

4. Bikin bucket `proof-images` di **Supabase Dashboard -> Storage**.

5. Bikin akun admin pertama lewat Prisma Studio (`npm run prisma:studio`) — insert manual ke tabel `admin_users`. `passwordHash` harus di-hash dulu pakai bcrypt, jangan plain text. Kalau butuh, aku bisa buatkan script `seed.js`.

6. Jalankan server:
   ```bash
   npm run dev

## Struktur Endpoint

| Method | Endpoint | Auth 
|---|---|---|---|---|
| POST | `/api/orders` | 
| GET | `/api/track/:token` | 
| GET | `/api/track?resi=` atau `?phone=` | 
| POST | `/api/auth/login` | 
| GET | `/api/admin/batches` | 
| POST | `/api/admin/batches` |
| PATCH | `/api/admin/batches/:id/close` | 
| GET | `/api/admin/orders` | 
| POST | `/api/admin/orders` |
| PATCH | `/api/admin/orders/:id/status` | 
| PATCH | `/api/admin/orders/bulk-status` | 

