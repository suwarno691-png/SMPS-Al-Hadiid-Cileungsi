// =====================================================================
// src/repositories/StudentRepository.ts
// Single Source of Truth Repository for public.students
// =====================================================================

import { supabase } from '../utils/supabaseClient';
import { StudentData, AdmissionStatus } from '../types';

export function mapRowToStudent(row: any): StudentData {
  return {
    id: row.id,
    registrationNumber: row.registration_number,
    status: (row.status || 'draft') as AdmissionStatus,
    userEmail: row.user_email || '',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at,
    version: row.version ?? 1,
    isFormVerified: !!row.is_form_verified,

    fullName: row.full_name || '',
    phone: row.phone || '',

    // Form Payment
    formPaymentAmount: Number(row.form_payment_amount ?? 200000),
    formPaymentStatus: row.form_payment_status || 'unpaid',
    formPaymentProofUrl: row.form_payment_proof_url || undefined,
    formPaymentDate: row.form_payment_date || undefined,
    formPaymentNotes: row.form_payment_notes || undefined,

    // Biodata
    nik: row.nik || '',
    nisn: row.nisn || undefined,
    birthPlace: row.birth_place || '',
    birthDate: row.birth_date || '',
    gender: row.gender || 'Laki-laki',
    religion: row.religion || 'Islam',
    childOrder: row.child_order || undefined,
    totalSiblings: row.total_siblings || undefined,
    address: row.address || '',
    village: row.village || undefined,
    subdistrict: row.subdistrict || '',
    city: row.city || '',
    province: row.province || '',
    postalCode: row.postal_code || undefined,

    // School Origin
    previousSchoolName: row.previous_school_name || '',
    previousSchoolNpsn: row.previous_school_npsn || undefined,
    previousSchoolAddress: row.previous_school_address || undefined,

    // Parents
    fatherName: row.father_name || '',
    fatherBirthPlace: row.father_birth_place || undefined,
    fatherBirthDate: row.father_birth_date || undefined,
    fatherJob: row.father_job || undefined,
    fatherEducation: row.father_education || '',
    fatherPhone: row.father_phone || '',

    motherName: row.mother_name || '',
    motherBirthPlace: row.mother_birth_place || undefined,
    motherBirthDate: row.mother_birth_date || undefined,
    motherJob: row.mother_job || '',
    motherEducation: row.mother_education || undefined,
    motherPhone: row.mother_phone || '',

    guardianName: row.guardian_name || undefined,
    guardianRelation: row.guardian_relation || undefined,
    guardianPhone: row.guardian_phone || undefined,

    // Uploaded Documents
    photoUrl: row.photo_url || undefined,
    kkUrl: row.kk_url || undefined,
    birthCertUrl: row.birth_cert_url || undefined,
    reportCardUrl: row.report_card_url || undefined,
    kipUrl: row.kip_url || undefined,
    certificateUrl: row.certificate_url || undefined,

    // Test Information
    isTestActive: !!row.is_test_active,
    testSubmitted: !!row.test_submitted,
    testAnswers: typeof row.test_answers === 'object' ? row.test_answers : {},
    testScheduleDate: row.test_schedule_date || undefined,
    testLocation: row.test_location || undefined,
    diagnosticScore: row.diagnostic_score !== null ? Number(row.diagnostic_score) : undefined,
    generalScore: row.general_score !== null ? Number(row.general_score) : undefined,
    religiousScore: row.religious_score !== null ? Number(row.religious_score) : undefined,
    finalScore: row.final_score !== null ? Number(row.final_score) : undefined,
    testNotes: row.test_notes || undefined,

    // Initial Payment / BAM
    initialPaymentAmount: Number(row.initial_payment_amount ?? 0),
    initialPaymentStatus: row.initial_payment_status || 'unpaid',
    initialPaymentProofUrl: row.initial_payment_proof_url || undefined,
    initialPaymentDate: row.initial_payment_date || undefined,
    initialPaymentNotes: row.initial_payment_notes || undefined,

    // Placement
    assignedClassId: row.assigned_class_id || undefined,
    assignedClassName: row.assigned_class_name || undefined,
    assignedHomeroomTeacher: row.assigned_homeroom_teacher || undefined,
    firstDayDate: row.first_day_date || undefined,
    mplsInfo: row.mpls_info || undefined,
  };
}

export function mapStudentToRow(s: Partial<StudentData>): Record<string, any> {
  const row: Record<string, any> = {};

  if (s.id !== undefined) row.id = s.id;
  if (s.registrationNumber !== undefined) row.registration_number = s.registrationNumber;
  if (s.status !== undefined) row.status = s.status;
  if (s.userEmail !== undefined) row.user_email = s.userEmail.toLowerCase();
  if (s.fullName !== undefined) row.full_name = s.fullName;
  if (s.phone !== undefined) row.phone = s.phone;
  if (s.isFormVerified !== undefined) row.is_form_verified = s.isFormVerified;

  if (s.formPaymentAmount !== undefined) row.form_payment_amount = s.formPaymentAmount;
  if (s.formPaymentStatus !== undefined) row.form_payment_status = s.formPaymentStatus;
  if (s.formPaymentProofUrl !== undefined) row.form_payment_proof_url = s.formPaymentProofUrl;
  if (s.formPaymentDate !== undefined) row.form_payment_date = s.formPaymentDate;
  if (s.formPaymentNotes !== undefined) row.form_payment_notes = s.formPaymentNotes;

  if (s.nik !== undefined) row.nik = s.nik;
  if (s.nisn !== undefined) row.nisn = s.nisn;
  if (s.birthPlace !== undefined) row.birth_place = s.birthPlace;
  if (s.birthDate !== undefined) row.birth_date = s.birthDate;
  if (s.gender !== undefined) row.gender = s.gender;
  if (s.religion !== undefined) row.religion = s.religion;
  if (s.childOrder !== undefined) row.child_order = s.childOrder;
  if (s.totalSiblings !== undefined) row.total_siblings = s.totalSiblings;
  if (s.address !== undefined) row.address = s.address;
  if (s.village !== undefined) row.village = s.village;
  if (s.subdistrict !== undefined) row.subdistrict = s.subdistrict;
  if (s.city !== undefined) row.city = s.city;
  if (s.province !== undefined) row.province = s.province;
  if (s.postalCode !== undefined) row.postal_code = s.postalCode;

  if (s.previousSchoolName !== undefined) row.previous_school_name = s.previousSchoolName;
  if (s.previousSchoolNpsn !== undefined) row.previous_school_npsn = s.previousSchoolNpsn;
  if (s.previousSchoolAddress !== undefined) row.previous_school_address = s.previousSchoolAddress;

  if (s.fatherName !== undefined) row.father_name = s.fatherName;
  if (s.fatherBirthPlace !== undefined) row.father_birth_place = s.fatherBirthPlace;
  if (s.fatherBirthDate !== undefined) row.father_birth_date = s.fatherBirthDate;
  if (s.fatherJob !== undefined) row.father_job = s.fatherJob;
  if (s.fatherEducation !== undefined) row.father_education = s.fatherEducation;
  if (s.fatherPhone !== undefined) row.father_phone = s.fatherPhone;

  if (s.motherName !== undefined) row.mother_name = s.motherName;
  if (s.motherBirthPlace !== undefined) row.mother_birth_place = s.motherBirthPlace;
  if (s.motherBirthDate !== undefined) row.mother_birth_date = s.motherBirthDate;
  if (s.motherJob !== undefined) row.mother_job = s.motherJob;
  if (s.motherEducation !== undefined) row.mother_education = s.motherEducation;
  if (s.motherPhone !== undefined) row.mother_phone = s.motherPhone;

  if (s.guardianName !== undefined) row.guardian_name = s.guardianName;
  if (s.guardianRelation !== undefined) row.guardian_relation = s.guardianRelation;
  if (s.guardianPhone !== undefined) row.guardian_phone = s.guardianPhone;

  if (s.photoUrl !== undefined) row.photo_url = s.photoUrl;
  if (s.kkUrl !== undefined) row.kk_url = s.kkUrl;
  if (s.birthCertUrl !== undefined) row.birth_cert_url = s.birthCertUrl;
  if (s.reportCardUrl !== undefined) row.report_card_url = s.reportCardUrl;
  if (s.kipUrl !== undefined) row.kip_url = s.kipUrl;
  if (s.certificateUrl !== undefined) row.certificate_url = s.certificateUrl;

  if (s.isTestActive !== undefined) row.is_test_active = s.isTestActive;
  if (s.testSubmitted !== undefined) row.test_submitted = s.testSubmitted;
  if (s.testAnswers !== undefined) row.test_answers = s.testAnswers;
  if (s.testScheduleDate !== undefined) row.test_schedule_date = s.testScheduleDate;
  if (s.testLocation !== undefined) row.test_location = s.testLocation;
  if (s.diagnosticScore !== undefined) row.diagnostic_score = s.diagnosticScore;
  if (s.generalScore !== undefined) row.general_score = s.generalScore;
  if (s.religiousScore !== undefined) row.religious_score = s.religiousScore;
  if (s.finalScore !== undefined) row.final_score = s.finalScore;
  if (s.testNotes !== undefined) row.test_notes = s.testNotes;

  if (s.initialPaymentAmount !== undefined) row.initial_payment_amount = s.initialPaymentAmount;
  if (s.initialPaymentStatus !== undefined) row.initial_payment_status = s.initialPaymentStatus;
  if (s.initialPaymentProofUrl !== undefined) row.initial_payment_proof_url = s.initialPaymentProofUrl;
  if (s.initialPaymentDate !== undefined) row.initial_payment_date = s.initialPaymentDate;
  if (s.initialPaymentNotes !== undefined) row.initial_payment_notes = s.initialPaymentNotes;

  if (s.assignedClassId !== undefined) row.assigned_class_id = s.assignedClassId;
  if (s.assignedClassName !== undefined) row.assigned_class_name = s.assignedClassName;
  if (s.assignedHomeroomTeacher !== undefined) row.assigned_homeroom_teacher = s.assignedHomeroomTeacher;
  if (s.firstDayDate !== undefined) row.first_day_date = s.firstDayDate;
  if (s.mplsInfo !== undefined) row.mpls_info = s.mplsInfo;

  row.updated_at = new Date().toISOString();
  return row;
}

export const StudentRepository = {
  /**
   * Mengambil daftar siswa dari public.students.
   * Mengembalikan array kosong [] jika tidak ada data (VALID RESULT).
   */
  async list(params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: StudentData[]; count: number; error: Error | null }> {
    try {
      let query = supabase.from('students').select('*', { count: 'exact' });

      if (params?.status && params.status !== 'all') {
        query = query.eq('status', params.status);
      }
      if (params?.search) {
        query = query.or(
          `full_name.ilike.%${params.search}%,registration_number.ilike.%${params.search}%,user_email.ilike.%${params.search}%`
        );
      }

      if (params?.page && params?.limit) {
        const from = (params.page - 1) * params.limit;
        const to = from + params.limit - 1;
        query = query.range(from, to);
      } else {
        // Default order by created_at DESC
        query = query.order('created_at', { ascending: false });
      }

      const { data, count, error } = await query;
      if (error) {
        return { data: [], count: 0, error: new Error(error.message) };
      }

      const mapped = (data || []).map(mapRowToStudent);
      return { data: mapped, count: count || mapped.length, error: null };
    } catch (err: any) {
      return { data: [], count: 0, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Mengambil satu siswa berdasarkan ID
   */
  async getById(id: string): Promise<{ data: StudentData | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }
      if (!data) {
        return { data: null, error: null };
      }
      return { data: mapRowToStudent(data), error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Membuat record pendaftaran siswa baru (INSERT ONLY)
   */
  async create(payload: Partial<StudentData>): Promise<{ data: StudentData | null; error: Error | null }> {
    try {
      const row = mapStudentToRow(payload);
      if (!row.id) {
        return { data: null, error: new Error('ID siswa wajib diisi.') };
      }
      row.version = 1;
      row.created_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('students')
        .insert(row)
        .select()
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }
      return { data: mapRowToStudent(data), error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Memperbarui record siswa yang SUDAH ADA dengan Optimistic Concurrency Control.
   * Gagal jika record sudah dihapus atau versinya berkonflik.
   */
  async update(
    id: string,
    updates: Partial<StudentData>,
    expectedVersion?: number
  ): Promise<{ data: StudentData | null; error: Error | null; conflict?: boolean }> {
    try {
      const row = mapStudentToRow(updates);
      delete row.id; // Jangan ubah ID
      delete row.created_at;

      let query = supabase.from('students').update(row).eq('id', id);

      if (expectedVersion !== undefined) {
        query = query.eq('version', expectedVersion);
      }

      const { data, error } = await query.select().maybeSingle();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      // Jika data null dan kita memberikan expectedVersion, kemungkinan terjadi konkurensi atau record sudah dihapus
      if (!data) {
        return {
          data: null,
          error: new Error('Data siswa telah diperbarui oleh pengguna lain atau sudah dihapus. Silakan muat ulang data.'),
          conflict: true,
        };
      }

      return { data: mapRowToStudent(data), error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Upsert banyak record siswa sekaligus ke database Supabase
   */
  async upsertMany(students: Partial<StudentData>[]): Promise<{ count: number; error: Error | null }> {
    try {
      if (!students || students.length === 0) return { count: 0, error: null };
      const rows = students.map(s => mapStudentToRow(s)).filter(r => !!r.id);
      if (rows.length === 0) return { count: 0, error: null };

      const { data, error } = await supabase
        .from('students')
        .upsert(rows, { onConflict: 'id' })
        .select('id');

      if (error) {
        return { count: 0, error: new Error(error.message) };
      }
      return { count: data?.length || rows.length, error: null };
    } catch (err: any) {
      return { count: 0, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Menghapus record siswa (DELETE ONLY).
   */
  async remove(id: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) {
        return { success: false, error: new Error(error.message) };
      }
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },
};
