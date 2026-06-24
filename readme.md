# IZUWAN Automobile Website

Website multi-page untuk Izuwan Automobile, lengkap dengan inventory, kalkulator kelayakan, breakdown OTR, profil syarikat, contact dan admin panel.

## Halaman

- `index.html` — Home / muka depan
- `inventory.html` — Senarai stok dan gambar
- `select-programme.html` — Custom sourcing daripada auction Jepun
- `calculator.html` — Kalkulator kelayakan dan ansuran
- `otr.html` — Breakdown harga OTR dan downpayment
- `about.html` — Our Profile / Our Story
- `contact.html` — WhatsApp dan senarai sales advisor
- `admin.html` — Pengurusan inventory dan tetapan

## Jalankan

Buka `index.html` terus dalam browser, atau jalankan server QA yang disertakan:

```powershell
powershell -ExecutionPolicy Bypass -File .\dev-server.ps1
```

Kemudian buka `http://localhost:4173`.

## Nota formula

- DSR maksimum = gaji bersih × had DSR
- Bajet ansuran = DSR maksimum − komitmen bulanan
- Pinjaman menggunakan anggaran kadar faedah flat hire purchase
- Semua hasil ialah anggaran awal, bukan jaminan kelulusan bank
- Quotation PDF boleh dijana terus daripada breakdown OTR tanpa database

## Admin panel

Admin panel tersedia di:

```text
/admin.html
```

### Sambungkan Supabase

1. Create project baru di Supabase.
2. Buka **SQL Editor** dan jalankan seluruh kandungan `supabase-schema.sql`.
3. Buka **Authentication > Users** dan create seorang admin user.
4. Copy UUID user tersebut, kemudian jalankan:

```sql
insert into public.admin_users (user_id)
values ('PASTE-USER-UUID-HERE');
```

5. Buka **Project Settings > API** dan copy Project URL serta publishable/anon key.
6. Isi kedua-duanya dalam `config.js`:

```js
window.IASB_CONFIG = {
  supabaseUrl: "https://PROJECT.supabase.co",
  supabaseAnonKey: "PUBLISHABLE-KEY"
};
```

7. Upload semula seluruh folder ke Netlify.
8. Login di `/admin.html`, kemudian tekan **Import stok asal** sekali.

Admin boleh urus inventory, harga, status, lokasi, caj OTR, logo, promotion banner dan senarai salesman.

## Maklumat syarikat

- Japan Reconditioned Car Specialist sejak 2011
- Syarikat 100% Bumiputera
- Main HQ: Izuwan Automobile Sdn. Bhd., Taman Wahyu
- Alamat: Lot 65419, Jln Kuching, Mukim Batu, 51200 Kuala Lumpur
- Waktu operasi: 9:00 AM – 7:00 PM
