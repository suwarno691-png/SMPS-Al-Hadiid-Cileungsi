# =====================================================================
# DOKUMEN MIGRASI DATA (DATA-MIGRATION.md)
# SPMB SMP AL-HADIID CILEUNGSI (TRANSISI V1 KE V2)
# =====================================================================

## 1. Latar Belakang & Identifikasi Arsitektur Lama (Legacy)

Pada implementasi sebelumnya (v1), sistem SPMB menggunakan arsitektur ganda yang rentan:
1. **`spmb_app_state` (Dokumen JSON key-value)**:
   - Data siswa disimpan dalam row dengan key `'students'`.
   - Data akun pengguna disimpan dalam row dengan key `'users_db'` atau `'users'`.
   - Data pembayaran tersimpan dalam array `'form_payments'` dan `'bam_payments'`.
2. **`localStorage`**:
   - Berfungsi sebagai cache agresif yang meng-overwrite state dan melakukan auto-restore data ketika database kosong.
3. **`public.students` (Relasional)**:
   - Di-update bersamaan melalui upsert array penuh (`syncStudentsToSupabase`), menyebabkan konflik rekonsiliasi data dan penghidupan kembali rekaman yang telah dihapus.

---

## 2. Strategi Sumber Data Tunggal (Single Source of Truth) di V2

| Entitas | Sumber Data Tunggal (V2) | Kebijakan Terhadap `spmb_app_state` | Kebijakan `localStorage` |
| :--- | :--- | :--- | :--- |
| **Identitas Akun** | `public.users` & `auth.users` | **DIHAPUS**. Tidak ada key `users` / `users_db`. | HANYA menyimpan token session SDK Supabase. |
| **Pendaftaran Siswa** | `public.students` | **DIHAPUS**. Key `students` dilarang oleh CHECK constraint. | Cache tampilan sementara (read-only), tidak boleh di-push. |
| **Pembayaran** | `public.payments` | **DIHAPUS**. Key `payments`, `form_payments`, `bam_payments` dilarang. | Draft formulir lokal saat offline (transient). |
| **Ujian (CBT)** | `public.soal`, `public.ujian`, `public.jawaban_peserta`, `public.hasil_ujian` | **DIHAPUS**. | Tidak ada penyimpanan jawaban CBT di localStorage. |
| **Konfigurasi Sekolah** | `public.spmb_app_state` (`school_info`) | **DIPERBOLEHKAN** (Non-transaksional). | UI fallback jika offline. |
| **Konfigurasi Web** | `public.spmb_app_state` (`website_config`) | **DIPERBOLEHKAN** (Non-transaksional). | UI fallback jika offline. |
| **Kuota Kelas** | `public.spmb_app_state` (`class_quotas`) | **DIPERBOLEHKAN** (Non-transaksional). | UI fallback jika offline. |

---

## 3. Prosedur Dry-Run Ekstraksi Data Legacy dari `spmb_app_state`

Sebelum menghapus key transaksional dari `spmb_app_state`, jalankan skrip `supabase/data_migration_dry_run.sql` pada database Supabase Staging. Skrip tersebut melakukan:
1. Menghitung jumlah data siswa yang tersimpan di `spmb_app_state` (key `'students'`).
2. Memeriksa siswa mana yang berada di `spmb_app_state` tetapi **BELUM ADA** di tabel relasional `public.students`.
3. Memeriksa akun di `users_db` yang belum ada di `public.users`.
4. Menyediakan perintah pemindahan (INSERT ... ON CONFLICT DO NOTHING) dari JSON payload ke tabel relasional target.

---

## 4. Eksekusi Migrasi Data ke Tabel Relasional

Setelah hasil dry-run diverifikasi:
```sql
-- 1. Pindahkan data profil siswa dari spmb_app_state ke public.users
INSERT INTO public.users (id, name, email, phone, role, registration_number, status, created_at, updated_at)
SELECT 
    elem->>'id' AS id,
    COALESCE(elem->>'fullName', 'Calon Murid') AS name,
    LOWER(COALESCE(elem->>'userEmail', elem->>'id' || '@alhadiid.sch.id')) AS email,
    COALESCE(elem->>'phone', '081234567890') AS phone,
    'student' AS role,
    elem->>'registrationNumber' AS registration_number,
    'active' AS status,
    COALESCE((elem->>'createdAt')::timestamptz, NOW()) AS created_at,
    NOW() AS updated_at
FROM public.spmb_app_state,
     jsonb_array_elements(payload) AS elem
WHERE key = 'students'
ON CONFLICT (id) DO NOTHING;

-- 2. Pindahkan data pendaftaran ke public.students
INSERT INTO public.students (
    id, registration_number, status, user_email, full_name, phone,
    form_payment_amount, form_payment_status, form_payment_proof_url,
    nik, birth_place, birth_date, gender, religion, address,
    previous_school_name, father_name, father_phone, mother_name, mother_phone,
    created_at, updated_at
)
SELECT 
    elem->>'id',
    elem->>'registrationNumber',
    COALESCE(elem->>'status', 'draft'),
    LOWER(COALESCE(elem->>'userEmail', elem->>'id' || '@alhadiid.sch.id')),
    COALESCE(elem->>'fullName', 'Calon Murid'),
    COALESCE(elem->>'phone', '081234567890'),
    COALESCE((elem->>'formPaymentAmount')::numeric, 200000),
    COALESCE(elem->>'formPaymentStatus', 'unpaid'),
    elem->>'formPaymentProofUrl',
    elem->>'nik',
    elem->>'birthPlace',
    elem->>'birthDate',
    COALESCE(elem->>'gender', 'Laki-laki'),
    COALESCE(elem->>'religion', 'Islam'),
    elem->>'address',
    elem->>'previousSchoolName',
    elem->>'fatherName',
    elem->>'fatherPhone',
    elem->>'motherName',
    elem->>'motherPhone',
    COALESCE((elem->>'createdAt')::timestamptz, NOW()),
    NOW()
FROM public.spmb_app_state,
     jsonb_array_elements(payload) AS elem
WHERE key = 'students'
ON CONFLICT (id) DO UPDATE SET
    registration_number = EXCLUDED.registration_number,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

-- 3. Hapus key transaksional lama dari spmb_app_state
DELETE FROM public.spmb_app_state 
WHERE key IN ('students', 'users', 'users_db', 'payments', 'form_payments', 'bam_payments');
```

---

## 5. Validasi Pasca Migrasi

Jalankan skrip `supabase/verify_migration.sql` untuk memastikan:
- Seluruh data siswa tersimpan murni di `public.students`.
- Constraint `chk_non_transactional_keys` aktif di `public.spmb_app_state`.
- Aplikasi frontend menggunakan `StudentRepository` dan `UserProfileRepository` secara eksklusif.
