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
   ```

## Struktur Endpoint

| Method | Endpoint | Auth |
|---|---|---|
| POST | `/api/orders` | Tidak |
| GET | `/api/orders/availability` | Tidak |
| GET | `/api/track/:token` | Tidak |
| GET | `/api/track?resi=`, `?phone=`, atau `?identifier=` (identifier: persis sama atau diawali; opsional: `page`, `pageSize`; default `1`, `20`, maksimal `100`) | Tidak |
| POST | `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout` | Tidak |
| GET | `/api/auth/me`, `/api/admin/me` | Admin |
| GET, POST | `/api/admin/batches` | Admin |
| PATCH | `/api/admin/batches/:id/close`, `/api/admin/batches/:id/open` | Admin |
| GET, POST | `/api/admin/orders` | Admin |
| GET | `/api/admin/orders/:id` | Admin |
| PATCH | `/api/admin/orders/:id/status`, `/api/admin/orders/bulk-status` | Admin |
| PATCH | `/api/admin/orders/:id/payment-status`, `/api/admin/orders/bulk-payment-status` | Admin |
| POST | `/api/admin/orders/:id/correct-status`, `/api/admin/orders/:id/proof-images` | Admin |
| PUT | `/api/admin/orders/:id/resi-image` | Admin |
| DELETE | `/api/admin/orders/:id/proof-images/:imageId` | Admin |
| GET | `/api/admin/customers`, `/api/admin/customers/:id` | Admin |
| PATCH, DELETE | `/api/admin/customers/:id` | Admin |

## Contoh Body untuk Postman

Ganti `{{baseUrl}}` dengan alamat server, misalnya `http://localhost:4000`. Untuk endpoint admin, login dulu lewat `/api/auth/login`; Postman perlu menyimpan dan mengirim cookie `access_token` (dan `refresh_token` untuk refresh).

### Membuat order publik — `POST /api/orders`

Pilih **Body → form-data**:

| Key | Type | Contoh |
|---|---|---|
| `identifier` | Text | `adhya0160` (username WA + 4 digit / X / IG) |
| `resiThailand` | Text | `TH123456789` |
| `items` | Text | `[{"name":"Sepatu","qty":1,"note":"Warna hitam"}]` |
| `image` | File | Pilih foto bukti resi (JPG, PNG, atau WebP, maksimal 5 MB) |

### Login admin — `POST /api/auth/login`

Pilih **Body → raw → JSON**:

```json
{
  "email": "admin@example.com",
  "password": "password-admin"
}
```

### Refresh sesi dan logout

- `POST /api/auth/refresh`: tidak perlu body; kirim cookie `refresh_token`.
- `POST /api/auth/logout`: tidak perlu body; kirim cookie sesi jika ingin menghapusnya di client.

### Membuat batch — `POST /api/admin/batches`

Pilih **Body → raw → JSON**:

```json
{
  "name": "Batch November 2026",
  "startDate": "2026-11-01T00:00:00.000Z",
  "endDate": "2026-11-30T23:59:59.000Z",
  "quota": 100
}
```

`endDate` dan `quota` boleh dihilangkan atau bernilai `null`.

### Membuat order manual — `POST /api/admin/orders`

Pilih **Body → raw → JSON**:

```json
{
  "name": "Budi Santoso",
  "identifier": "adhya0160",
  "phone": "081234567890",
  "resiThailand": "TH123456789",
  "items": [
    {
      "name": "Sepatu",
      "qty": 1,
      "note": "Warna hitam"
    }
  ],
  "batchId": "UUID_BATCH"
}
```

`name`, `identifier`, dan `phone` opsional, tapi minimal salah satu dari `identifier` atau `phone` wajib diisi.

`batchId` opsional; jika tidak dikirim, order masuk ke batch yang sedang aktif.

### Mengubah status order — `PATCH /api/admin/orders/:id/status`

```json
{
  "status": "ARRIVED_THAILAND"
}
```

Nilai status yang digunakan sistem: `WAITING`, `ARRIVED_THAILAND`, `ARRIVED_INDONESIA`, `SORTING`, `PACKING_QUEUE`, `PACKING`, `READY_TO_SHIP`, `SHIPPED`, `COMPLETED`, `ISSUE`, `CANCELLED`.

### Mengubah status beberapa order — `PATCH /api/admin/orders/bulk-status`

```json
{
  "orderIds": ["UUID_ORDER_1", "UUID_ORDER_2"],
  "status": "ARRIVED_THAILAND"
}
```

### Mengubah status pembayaran — `PATCH /api/admin/orders/:id/payment-status`

```json
{
  "paymentStatus": "lunas"
}
```

Nilai `paymentStatus`: `unpaid`, `dp`, atau `lunas`.

### Mengubah status pembayaran beberapa order — `PATCH /api/admin/orders/bulk-payment-status`

```json
{
  "orderIds": ["UUID_ORDER_1", "UUID_ORDER_2"],
  "paymentStatus": "lunas"
}
```

### Mengunggah foto bukti order — `POST /api/admin/orders/:id/proof-images`

Pilih **Body → form-data**, tambahkan `image` bertipe **File**, lalu pilih file JPG, PNG, atau WebP (maksimal 5 MB).

### Mengganti foto resi — `PUT /api/admin/orders/:id/resi-image`

Pilih **Body → form-data**, tambahkan `image` bertipe **File**, lalu pilih file JPG, PNG, atau WebP (maksimal 5 MB).

### Endpoint tanpa body

Kirim tanpa body untuk endpoint berikut:

- `PATCH /api/admin/batches/:id/close`
- `PATCH /api/admin/batches/:id/open`
- `POST /api/admin/orders/:id/correct-status`
- `DELETE /api/admin/orders/:id/proof-images/:imageId`
- `DELETE /api/admin/customers/:id`

### Mengubah data customer — `PATCH /api/admin/customers/:id`

```json
{
  "name": "Budi Santoso",
  "identifier": "adhya0160",
  "phone": "081234567890",
  "address": "Jl. Contoh No. 1"
}
```

Semua field dikirim lengkap: field yang kosong atau tidak dikirim akan dikosongkan. Minimal `identifier` atau `phone` harus terisi.

