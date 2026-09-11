// =====================================================================
// src/repositories/PaymentRepository.ts
// Single Source of Truth Repository for public.payments
// =====================================================================

import { supabase } from '../utils/supabaseClient';

export interface PaymentItem {
  id: string;
  studentId: string;
  registrationNumber: string;
  studentName: string;
  gender?: 'Laki-laki' | 'Perempuan';
  paymentType: 'form' | 'bam' | 'tuition' | 'other';
  amount: number;
  status: 'unpaid' | 'pending' | 'verified' | 'rejected';
  paymentMethod?: string;
  bankName?: string;
  accountNumber?: string;
  senderName?: string;
  proofUrl?: string;
  paymentDate?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export function mapRowToPayment(row: any): PaymentItem {
  return {
    id: row.id,
    studentId: row.student_id,
    registrationNumber: row.registration_number,
    studentName: row.student_name,
    gender: row.student?.gender || row.gender || undefined,
    paymentType: row.payment_type,
    amount: Number(row.amount || 0),
    status: row.status,
    paymentMethod: row.payment_method || undefined,
    bankName: row.bank_name || undefined,
    accountNumber: row.account_number || undefined,
    senderName: row.sender_name || undefined,
    proofUrl: row.proof_url || undefined,
    paymentDate: row.payment_date || undefined,
    verifiedBy: row.verified_by || undefined,
    verifiedAt: row.verified_at || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at,
  };
}

export const PaymentRepository = {
  /**
   * Mengambil daftar pembayaran langsung dari database Supabase.
   * Admin dapat melihat semua, siswa hanya miliknya sendiri.
   * Mendukung filter berdasarkan studentId atau paymentType ('form' | 'bam' | 'tuition' | 'other').
   */
  async list(
    filter?: string | { studentId?: string; paymentType?: 'form' | 'bam' | 'tuition' | 'other' }
  ): Promise<{ data: PaymentItem[]; error: Error | null }> {
    try {
      let query = supabase
        .from('payments')
        .select('*, student:students(gender)')
        .order('created_at', { ascending: false });

      let studentIdFilter: string | undefined;
      let paymentTypeFilter: string | undefined;

      if (typeof filter === 'string') {
        if (['form', 'bam', 'tuition', 'other'].includes(filter.toLowerCase())) {
          paymentTypeFilter = filter.toLowerCase();
        } else {
          studentIdFilter = filter;
        }
      } else if (typeof filter === 'object' && filter !== null) {
        studentIdFilter = filter.studentId;
        paymentTypeFilter = filter.paymentType;
      }

      if (studentIdFilter) {
        query = query.eq('student_id', studentIdFilter);
      }
      if (paymentTypeFilter) {
        query = query.eq('payment_type', paymentTypeFilter);
      }

      const { data, error } = await query;
      if (error) {
        // Fallback without relation join if relation alias is not configured
        let fallbackQuery = supabase.from('payments').select('*').order('created_at', { ascending: false });
        if (studentIdFilter) {
          fallbackQuery = fallbackQuery.eq('student_id', studentIdFilter);
        }
        if (paymentTypeFilter) {
          fallbackQuery = fallbackQuery.eq('payment_type', paymentTypeFilter);
        }
        const { data: fallbackData, error: fallbackError } = await fallbackQuery;
        if (fallbackError) {
          return { data: [], error: new Error(fallbackError.message) };
        }
        return { data: (fallbackData || []).map(mapRowToPayment), error: null };
      }

      return { data: (data || []).map(mapRowToPayment), error: null };
    } catch (err: any) {
      return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Mengirim pembayaran baru (INSERT) ke tabel public.payments
   */
  async create(payment: Partial<PaymentItem>): Promise<{ data: PaymentItem | null; error: Error | null }> {
    try {
      const row: Record<string, any> = {
        student_id: payment.studentId,
        registration_number: payment.registrationNumber,
        student_name: payment.studentName,
        payment_type: payment.paymentType,
        amount: payment.amount,
        status: payment.status || 'pending',
        payment_method: payment.paymentMethod || 'manual_transfer',
        bank_name: payment.bankName,
        account_number: payment.accountNumber,
        sender_name: payment.senderName,
        proof_url: payment.proofUrl,
        payment_date: payment.paymentDate || new Date().toISOString(),
        notes: payment.notes,
        created_at: new Date().toISOString(),
      };

      if (payment.id) {
        row.id = payment.id;
      }
      if (payment.status === 'verified') {
        row.verified_at = payment.verifiedAt || new Date().toISOString();
        row.verified_by = payment.verifiedBy || 'Admin Panitia';
      }

      const { data, error } = await supabase.from('payments').insert(row).select().single();
      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      // Sync student status if needed
      if (payment.studentId && payment.status === 'verified') {
        if (payment.paymentType === 'form') {
          await supabase.from('students').update({
            form_payment_status: 'verified',
          }).eq('id', payment.studentId);
        } else if (payment.paymentType === 'bam') {
          await supabase.from('students').update({
            initial_payment_status: 'verified',
          }).eq('id', payment.studentId);
        }
      }

      return { data: mapRowToPayment(data), error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Verifikasi pembayaran secara aman menggunakan RPC Supabase
   */
  async verifyThroughSecureFunction(
    paymentId: string,
    status: 'verified' | 'rejected' | 'pending',
    notes?: string
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      // 1. Coba panggil RPC rpc_verify_payment
      const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_verify_payment', {
        p_payment_id: paymentId,
        p_status: status,
        p_notes: notes || null,
      });

      if (!rpcError) {
        return { success: true, error: null };
      }

      // 2. Fallback direct update jika RPC belum ter-apply di staging
      const { error: updateErr } = await supabase
        .from('payments')
        .update({
          status,
          notes,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (updateErr) {
        return { success: false, error: new Error(updateErr.message) };
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Memperbarui record pembayaran
   */
  async update(id: string, updates: Partial<PaymentItem>): Promise<{ data: PaymentItem | null; error: Error | null }> {
    try {
      const payload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.amount !== undefined) payload.amount = updates.amount;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.paymentMethod !== undefined) payload.payment_method = updates.paymentMethod;
      if (updates.bankName !== undefined) payload.bank_name = updates.bankName;
      if (updates.accountNumber !== undefined) payload.account_number = updates.accountNumber;
      if (updates.senderName !== undefined) payload.sender_name = updates.senderName;
      if (updates.proofUrl !== undefined) payload.proof_url = updates.proofUrl;
      if (updates.paymentDate !== undefined) {
        payload.payment_date = updates.paymentDate && updates.paymentDate.trim() ? updates.paymentDate.trim() : null;
      }
      if (updates.verifiedBy !== undefined) payload.verified_by = updates.verifiedBy;
      if (updates.verifiedAt !== undefined) {
        payload.verified_at = updates.verifiedAt && updates.verifiedAt.trim() ? updates.verifiedAt.trim() : null;
      }
      if (updates.notes !== undefined) payload.notes = updates.notes;

      const { data, error } = await supabase
        .from('payments')
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }
      if (!data) {
        return { data: null, error: new Error('Pembayaran tidak ditemukan atau sudah dihapus.') };
      }

      // Sync student status if status changed
      if (updates.status && data.student_id) {
        if (data.payment_type === 'form') {
          await supabase.from('students').update({
            form_payment_status: updates.status,
          }).eq('id', data.student_id);
        } else if (data.payment_type === 'bam') {
          await supabase.from('students').update({
            initial_payment_status: updates.status,
          }).eq('id', data.student_id);
        }
      }

      return { data: mapRowToPayment(data), error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Menghapus record pembayaran dan memperbarui status siswa jika diperlukan
   */
  async remove(id: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      // Dapatkan data pembayaran terlebih dahulu untuk mengupdate status siswa
      const { data: existing } = await supabase.from('payments').select('*').eq('id', id).maybeSingle();

      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      if (existing && existing.student_id) {
        if (existing.payment_type === 'form') {
          await supabase.from('students').update({
            form_payment_status: 'unpaid',
          }).eq('id', existing.student_id);
        } else if (existing.payment_type === 'bam') {
          await supabase.from('students').update({
            initial_payment_status: 'unpaid',
          }).eq('id', existing.student_id);
        }
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },
};
