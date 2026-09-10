// =====================================================================
// src/repositories/UserProfileRepository.ts
// Single Source of Truth Repository for public.users
// =====================================================================

import { supabase } from '../utils/supabaseClient';
import { UserAccount, UserRole } from '../types';

export function mapRowToUserAccount(row: any): UserAccount {
  return {
    id: row.id,
    name: row.name || 'Pengguna',
    email: row.email || '',
    username: row.username || undefined,
    phone: row.phone || '',
    role: (row.role || 'student') as UserRole,
    registrationNumber: row.registration_number || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    status: (row.status || 'active') as 'active' | 'disabled',
    mustChangePassword: !!row.must_change_password,
    lastLogin: row.last_login || undefined,
  };
}

export const UserProfileRepository = {
  /**
   * Mengambil profil pengguna yang sedang login berdasarkan auth session saat ini
   */
  async getCurrent(): Promise<{ data: UserAccount | null; error: Error | null }> {
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData?.session?.user) {
        return { data: null, error: sessionErr ? new Error(sessionErr.message) : null };
      }

      const authUser = sessionData.session.user;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`auth_user_id.eq.${authUser.id},id.eq.${authUser.id},email.ilike.${authUser.email}`)
        .maybeSingle();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }
      if (!data) {
        return { data: null, error: null };
      }

      return { data: mapRowToUserAccount(data), error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Mengambil seluruh profil pengguna untuk manajemen panitia Admin
   */
  async listForAdmin(): Promise<{ data: UserAccount[]; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return { data: [], error: new Error(error.message) };
      }

      return { data: (data || []).map(mapRowToUserAccount), error: null };
    } catch (err: any) {
      return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Memperbarui field yang diperbolehkan pada profil pengguna
   */
  async updateAllowedFields(
    id: string,
    updates: { name?: string; phone?: string; username?: string }
  ): Promise<{ data: UserAccount | null; error: Error | null }> {
    try {
      const payload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.phone !== undefined) payload.phone = updates.phone;
      if (updates.username !== undefined) payload.username = updates.username.toLowerCase();

      const { data, error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data: mapRowToUserAccount(data), error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Menonaktifkan atau mengaktifkan pengguna (Akses Admin)
   */
  async setUserStatus(id: string, status: 'active' | 'disabled'): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        return { success: false, error: new Error(error.message) };
      }
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },
};
