import {
  StudentData, ClassQuota, CostBreakdown, SchoolInfo, TestSchedule,
  GasConfig, UserAccount, FormPaymentRecord, BamPaymentRecord,
  ExamQuestion, WebsiteConfig
} from '../types';
import { StudentRepository } from '../repositories/StudentRepository';
import {
  supabase, testSupabaseConnection, SUPABASE_PROJECT_NAME, SUPABASE_PROJECT_ID,
  syncStudentsToSupabase, fetchStudentsFromSupabase,
  syncUsersDbToSupabase, fetchUsersDbFromSupabase,
  syncFormPaymentsToSupabase, fetchFormPaymentsFromSupabase,
  syncBamPaymentsToSupabase, fetchBamPaymentsFromSupabase,
  syncClassQuotasToSupabase, fetchClassQuotasFromSupabase,
  syncSchoolInfoToSupabase, fetchSchoolInfoFromSupabase,
  syncCostBreakdownToSupabase, fetchCostBreakdownFromSupabase,
  syncTestSchedulesToSupabase, fetchTestSchedulesFromSupabase,
  syncQuestionBankToSupabase, fetchQuestionBankFromSupabase,
  syncGasConfigToSupabase, fetchGasConfigFromSupabase,
  syncWebsiteConfigToSupabase, fetchWebsiteConfigFromSupabase
} from './supabaseClient';
import {
  getStoredStudents, saveStudents,
  getUsersDb, saveUsersDb,
  getStoredFormPayments, saveFormPayments,
  getStoredBamPayments, saveBamPayments,
  getStoredClassQuotas, saveClassQuotas,
  getStoredSchoolInfo, saveSchoolInfo,
  getStoredCostBreakdown, saveCostBreakdown,
  getStoredTestSchedules, saveTestSchedules,
  getStoredQuestionBank, saveQuestionBank,
  getStoredGasConfig, saveGasConfig,
  getStoredWebsiteConfig, saveWebsiteConfig,
  safeGetItem, safeSetItem
} from './storage';

export type SyncMode = 'smart' | 'pull' | 'push';

export interface SyncRecordCounts {
  students: number;
  users: number;
  formPayments: number;
  bamPayments: number;
  classQuotas: number;
  schedules: number;
}

export interface SyncStatsComparison {
  local: SyncRecordCounts;
  cloud: SyncRecordCounts;
  connectionOk: boolean;
  connectionMessage: string;
}

export interface SyncResult {
  success: boolean;
  mode: SyncMode;
  timestamp: string;
  durationMs: number;
  counts: SyncRecordCounts;
  message: string;
  error?: string;
}

const LAST_SYNC_KEY = 'spmb_last_supabase_sync_result';

export function getLastSyncInfo(): SyncResult | null {
  try {
    const raw = safeGetItem(LAST_SYNC_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveLastSyncInfo(res: SyncResult): void {
  try {
    safeSetItem(LAST_SYNC_KEY, JSON.stringify(res));
  } catch {
    // ignore
  }
}

/**
 * Mengambil perbandingan jumlah record antara database Lokal (Browser) vs Cloud Supabase
 */
export async function fetchSyncComparisonStats(): Promise<SyncStatsComparison> {
  const local: SyncRecordCounts = {
    students: getStoredStudents().length,
    users: getUsersDb().length,
    formPayments: getStoredFormPayments().length,
    bamPayments: getStoredBamPayments().length,
    classQuotas: getStoredClassQuotas().length,
    schedules: getStoredTestSchedules().length,
  };

  const cloud: SyncRecordCounts = {
    students: 0,
    users: 0,
    formPayments: 0,
    bamPayments: 0,
    classQuotas: 0,
    schedules: 0,
  };

  let connectionOk = false;
  let connectionMessage = 'Memeriksa koneksi Supabase...';

  try {
    const conn = await testSupabaseConnection();
    connectionOk = conn.ok;
    connectionMessage = conn.message;

    if (connectionOk) {
      const [
        cloudStudents,
        cloudUsers,
        cloudFormPayments,
        cloudBamPayments,
        cloudQuotas,
        cloudSchedules,
      ] = await Promise.all([
        fetchStudentsFromSupabase().catch(() => null),
        fetchUsersDbFromSupabase().catch(() => null),
        fetchFormPaymentsFromSupabase().catch(() => null),
        fetchBamPaymentsFromSupabase().catch(() => null),
        fetchClassQuotasFromSupabase().catch(() => null),
        fetchTestSchedulesFromSupabase().catch(() => null),
      ]);

      cloud.students = cloudStudents ? cloudStudents.length : 0;
      cloud.users = cloudUsers ? cloudUsers.length : 0;
      cloud.formPayments = cloudFormPayments ? cloudFormPayments.length : 0;
      cloud.bamPayments = cloudBamPayments ? cloudBamPayments.length : 0;
      cloud.classQuotas = cloudQuotas ? cloudQuotas.length : 0;
      cloud.schedules = cloudSchedules ? cloudSchedules.length : 0;
    }
  } catch (err: any) {
    connectionOk = false;
    connectionMessage = err?.message || 'Gagal terhubung ke database Supabase';
  }

  return { local, cloud, connectionOk, connectionMessage };
}

/**
 * Menjalankan proses sinkronisasi penuh dengan database Supabase
 * @param mode 'smart' (Dua arah terpadu) | 'pull' (Tarik dari Cloud) | 'push' (Kirim data lokal ke Cloud)
 */
export async function performFullSupabaseSync(
  mode: SyncMode = 'smart',
  onProgress?: (stage: string, percent: number) => void
): Promise<SyncResult> {
  const startTime = Date.now();

  try {
    onProgress?.('Memeriksa koneksi ke Supabase...', 15);
    const conn = await testSupabaseConnection();
    if (!conn.ok) {
      throw new Error(`Koneksi Supabase gagal: ${conn.message}`);
    }

    if (mode === 'push') {
      // ==========================================
      // PUSH: Upload all current local data to Supabase
      // ==========================================
      onProgress?.('Mengunggah data siswa pendaftar ke Supabase...', 30);
      const localStudents = getStoredStudents();
      await StudentRepository.upsertMany(localStudents);

      onProgress?.('Mengunggah akun pengguna ke Supabase...', 50);
      const localUsers = getUsersDb();
      const pushUserRows = localUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email.toLowerCase(),
        phone: u.phone,
        role: u.role,
        username: u.username?.toLowerCase() || null,
        registration_number: u.registrationNumber || null,
        status: u.status || 'active',
        created_at: u.createdAt || new Date().toISOString(),
      }));
      if (pushUserRows.length > 0) {
        await supabase.from('users').upsert(pushUserRows, { onConflict: 'id' });
      }

      onProgress?.('Mengunggah catatan pembayaran formulir & BAM...', 70);
      const localFormPayments = getStoredFormPayments();
      await syncFormPaymentsToSupabase(localFormPayments);

      const localBamPayments = getStoredBamPayments();
      await syncBamPaymentsToSupabase(localBamPayments);

      onProgress?.('Mengunggah kuota kelas dan info sekolah...', 85);
      await Promise.all([
        syncClassQuotasToSupabase(getStoredClassQuotas()),
        syncSchoolInfoToSupabase(getStoredSchoolInfo()),
        syncCostBreakdownToSupabase(getStoredCostBreakdown()),
        syncTestSchedulesToSupabase(getStoredTestSchedules()),
        syncQuestionBankToSupabase(getStoredQuestionBank()),
        syncGasConfigToSupabase(getStoredGasConfig()),
        syncWebsiteConfigToSupabase(getStoredWebsiteConfig()),
      ]);

      onProgress?.('Sinkronisasi selesai!', 100);

      const result: SyncResult = {
        success: true,
        mode: 'push',
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        counts: {
          students: localStudents.length,
          users: localUsers.length,
          formPayments: localFormPayments.length,
          bamPayments: localBamPayments.length,
          classQuotas: getStoredClassQuotas().length,
          schedules: getStoredTestSchedules().length,
        },
        message: `Berhasil mengunggah ${localStudents.length} siswa, ${localUsers.length} akun, dan ${localFormPayments.length + localBamPayments.length} transaksi pembayaran ke Supabase.`,
      };

      saveLastSyncInfo(result);
      return result;
    }

    if (mode === 'pull') {
      // ==========================================
      // PULL: Fetch all datasets from Supabase and overwrite local
      // ==========================================
      onProgress?.('Mengambil data dari Supabase...', 35);
      const [
        cloudStudents,
        cloudUsers,
        cloudFormPayments,
        cloudBamPayments,
        cloudQuotas,
        cloudSchoolInfo,
        cloudCosts,
        cloudSchedules,
        cloudQuestions,
        cloudGas,
        cloudWebsite,
      ] = await Promise.all([
        fetchStudentsFromSupabase(),
        fetchUsersDbFromSupabase(),
        fetchFormPaymentsFromSupabase(),
        fetchBamPaymentsFromSupabase(),
        fetchClassQuotasFromSupabase(),
        fetchSchoolInfoFromSupabase(),
        fetchCostBreakdownFromSupabase(),
        fetchTestSchedulesFromSupabase(),
        fetchQuestionBankFromSupabase(),
        fetchGasConfigFromSupabase(),
        fetchWebsiteConfigFromSupabase(),
      ]);

      onProgress?.('Memperbarui penyimpanan lokal...', 75);
      if (cloudStudents !== null && Array.isArray(cloudStudents)) saveStudents(cloudStudents);
      if (cloudUsers !== null && Array.isArray(cloudUsers)) saveUsersDb(cloudUsers);
      if (cloudFormPayments !== null && Array.isArray(cloudFormPayments)) saveFormPayments(cloudFormPayments);
      if (cloudBamPayments !== null && Array.isArray(cloudBamPayments)) saveBamPayments(cloudBamPayments);
      if (cloudQuotas !== null && Array.isArray(cloudQuotas)) saveClassQuotas(cloudQuotas);
      if (cloudSchoolInfo) saveSchoolInfo(cloudSchoolInfo);
      if (cloudCosts !== null && Array.isArray(cloudCosts)) saveCostBreakdown(cloudCosts);
      if (cloudSchedules !== null && Array.isArray(cloudSchedules)) saveTestSchedules(cloudSchedules);
      if (cloudQuestions !== null && Array.isArray(cloudQuestions)) saveQuestionBank(cloudQuestions);
      if (cloudGas) saveGasConfig(cloudGas);
      if (cloudWebsite) saveWebsiteConfig(cloudWebsite);

      onProgress?.('Sinkronisasi selesai!', 100);

      const result: SyncResult = {
        success: true,
        mode: 'pull',
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        counts: {
          students: cloudStudents?.length || getStoredStudents().length,
          users: cloudUsers?.length || getUsersDb().length,
          formPayments: cloudFormPayments?.length || getStoredFormPayments().length,
          bamPayments: cloudBamPayments?.length || getStoredBamPayments().length,
          classQuotas: cloudQuotas?.length || getStoredClassQuotas().length,
          schedules: cloudSchedules?.length || getStoredTestSchedules().length,
        },
        message: `Berhasil mengunduh data terbaru dari Supabase ke perangkat lokal.`,
      };

      saveLastSyncInfo(result);
      return result;
    }

    // ==========================================
    // SMART (Bidirectional Merge & Synchronize)
    // ==========================================
    onProgress?.('Mengambil data pembanding dari Supabase...', 25);
    const [
      cloudStudents,
      cloudUsers,
      cloudFormPayments,
      cloudBamPayments,
      cloudQuotas,
      cloudSchoolInfo,
      cloudCosts,
      cloudSchedules,
      cloudQuestions,
      cloudGas,
      cloudWebsite,
    ] = await Promise.all([
      fetchStudentsFromSupabase(),
      fetchUsersDbFromSupabase(),
      fetchFormPaymentsFromSupabase(),
      fetchBamPaymentsFromSupabase(),
      fetchClassQuotasFromSupabase(),
      fetchSchoolInfoFromSupabase(),
      fetchCostBreakdownFromSupabase(),
      fetchTestSchedulesFromSupabase(),
      fetchQuestionBankFromSupabase(),
      fetchGasConfigFromSupabase(),
      fetchWebsiteConfigFromSupabase(),
    ]);

    onProgress?.('Memadukan data lokal dan cloud...', 55);

    // 1. Merge Students
    const localStudents = getStoredStudents();
    const mergedStudentsMap = new Map<string, StudentData>();

    // Put cloud students first
    if (cloudStudents && Array.isArray(cloudStudents)) {
      cloudStudents.forEach(s => {
        if (s.id) mergedStudentsMap.set(s.id, s);
      });
    }

    // Overlay local students (local edits take precedence if newer or matching)
    localStudents.forEach(s => {
      const existing = mergedStudentsMap.get(s.id);
      if (!existing) {
        mergedStudentsMap.set(s.id, s);
      } else {
        // Merge fields cleanly
        mergedStudentsMap.set(s.id, {
          ...existing,
          ...s,
          // Preserve verification/scores if set anywhere
          isFormVerified: s.isFormVerified || existing.isFormVerified,
          formPaymentStatus: s.formPaymentStatus !== 'unpaid' ? s.formPaymentStatus : existing.formPaymentStatus,
          initialPaymentStatus: s.initialPaymentStatus !== 'unpaid' ? s.initialPaymentStatus : existing.initialPaymentStatus,
          status: s.status !== 'draft' ? s.status : existing.status,
        });
      }
    });

    const finalStudents = Array.from(mergedStudentsMap.values());

    // 2. Merge Users
    const localUsers = getUsersDb();
    const mergedUsersMap = new Map<string, UserAccount>();

    if (cloudUsers && Array.isArray(cloudUsers)) {
      cloudUsers.forEach(u => {
        if (u.id) mergedUsersMap.set(u.id, u);
      });
    }

    localUsers.forEach(u => {
      const existing = mergedUsersMap.get(u.id);
      if (!existing) {
        mergedUsersMap.set(u.id, u);
      } else {
        mergedUsersMap.set(u.id, {
          ...existing,
          ...u,
          status: u.status || existing.status,
        });
      }
    });

    // Ensure core system admin & kepsek accounts remain active
    const finalUsers = Array.from(mergedUsersMap.values());

    // 3. Merge Payments
    const localFormPayments = getStoredFormPayments();
    const mergedFormPayMap = new Map<string, FormPaymentRecord>();
    if (cloudFormPayments) cloudFormPayments.forEach(p => mergedFormPayMap.set(p.id, p));
    localFormPayments.forEach(p => mergedFormPayMap.set(p.id, { ...(mergedFormPayMap.get(p.id) || {}), ...p }));
    const finalFormPayments = Array.from(mergedFormPayMap.values());

    const localBamPayments = getStoredBamPayments();
    const mergedBamPayMap = new Map<string, BamPaymentRecord>();
    if (cloudBamPayments) cloudBamPayments.forEach(p => mergedBamPayMap.set(p.id, p));
    localBamPayments.forEach(p => mergedBamPayMap.set(p.id, { ...(mergedBamPayMap.get(p.id) || {}), ...p }));
    const finalBamPayments = Array.from(mergedBamPayMap.values());

    // 4. Save merged state to Local Storage
    onProgress?.('Menyimpan hasil sinkronisasi ke penyimpanan lokal...', 75);
    saveStudents(finalStudents);
    saveUsersDb(finalUsers);
    saveFormPayments(finalFormPayments);
    saveBamPayments(finalBamPayments);

    if (cloudQuotas !== null && Array.isArray(cloudQuotas)) saveClassQuotas(cloudQuotas);
    if (cloudSchoolInfo) saveSchoolInfo(cloudSchoolInfo);
    if (cloudCosts !== null && Array.isArray(cloudCosts)) saveCostBreakdown(cloudCosts);
    if (cloudSchedules !== null && Array.isArray(cloudSchedules)) saveTestSchedules(cloudSchedules);
    if (cloudQuestions !== null && Array.isArray(cloudQuestions)) saveQuestionBank(cloudQuestions);
    if (cloudGas) saveGasConfig(cloudGas);
    if (cloudWebsite) saveWebsiteConfig(cloudWebsite);

    // 5. Upload merged state back to Supabase to guarantee 100% parity
    onProgress?.('Memperbarui database Supabase dengan data gabungan...', 88);
    await StudentRepository.upsertMany(finalStudents);

    const mergedUserRows = finalUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email.toLowerCase(),
      phone: u.phone,
      role: u.role,
      username: u.username?.toLowerCase() || null,
      registration_number: u.registrationNumber || null,
      status: u.status || 'active',
      created_at: u.createdAt || new Date().toISOString(),
    }));
    if (mergedUserRows.length > 0) {
      await supabase.from('users').upsert(mergedUserRows, { onConflict: 'id' });
    }

    await Promise.all([
      syncFormPaymentsToSupabase(finalFormPayments),
      syncBamPaymentsToSupabase(finalBamPayments),
    ]);

    onProgress?.('Sinkronisasi selesai!', 100);

    const result: SyncResult = {
      success: true,
      mode: 'smart',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      counts: {
        students: finalStudents.length,
        users: finalUsers.length,
        formPayments: finalFormPayments.length,
        bamPayments: finalBamPayments.length,
        classQuotas: getStoredClassQuotas().length,
        schedules: getStoredTestSchedules().length,
      },
      message: `Sinkronisasi dua arah berhasil diselesaikan! ${finalStudents.length} siswa, ${finalUsers.length} akun, dan ${finalFormPayments.length + finalBamPayments.length} transaksi selaras antara Lokal dan Supabase.`,
    };

    saveLastSyncInfo(result);
    return result;
  } catch (err: any) {
    console.error('performFullSupabaseSync error:', err);
    const failedResult: SyncResult = {
      success: false,
      mode,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      counts: {
        students: getStoredStudents().length,
        users: getUsersDb().length,
        formPayments: getStoredFormPayments().length,
        bamPayments: getStoredBamPayments().length,
        classQuotas: getStoredClassQuotas().length,
        schedules: getStoredTestSchedules().length,
      },
      message: 'Gagal melakukan sinkronisasi dengan Supabase.',
      error: err?.message || String(err),
    };
    saveLastSyncInfo(failedResult);
    throw err;
  }
}

/**
 * Format tanggal sinkronisasi yang ramah dibaca
 */
export function formatSyncTime(isoString?: string | null): string {
  if (!isoString) return 'Belum pernah sinkron';
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit yang lalu`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} jam yang lalu`;

    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Belum pernah sinkron';
  }
}
