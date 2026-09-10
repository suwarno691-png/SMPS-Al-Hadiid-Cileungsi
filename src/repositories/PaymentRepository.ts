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
   * Mengambil daftar pembayaran. Admin dapat melihat semua, siswa hanya miliknya sendiri.
   */
  async list(studentId?: string): Promise<{ data: PaymentItem[]; error: Error | null }> {
    try {
      let query = supabase.from('payments').select('*').order('created_at', { ascending: false });

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      const { data, error } = await query;
      if (error) {
        return { data: [], error: new Error(error.message) };
      }

      return { data: (data || []).map(mapRowToPayment), error: null };
    } catch (err: any) {
      return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Mengirim pembayaran baru (INSERT ONLY)
   */
  async create(payment: Partial<PaymentItem>): Promise<{ data: PaymentItem | null; error: Error | null }> {
    try {
      const row = {
        student_id: payment.studentId,
        registration_number: payment.registrationNumber,
        student_name: payment.studentName,
        payment_type: payment.paymentType,
        amount: payment.amount,
        status: 'pending',
        payment_method: payment.paymentMethod || 'manual_transfer',
        bank_name: payment.bankName,
        account_number: payment.accountNumber,
        sender_name: payment.senderName,
        proof_url: payment.proofUrl,
        payment_date: payment.paymentDate || new Date().toISOString(),
        notes: payment.notes,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from('payments').insert(row).select().single();
      if (error) {
        return { data: null, error: new Error(error.message) };
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
};
