import {
  StudentData, ClassQuota, CostBreakdown, SchoolInfo, TestSchedule,
  GasConfig, UserAccount, FormPaymentRecord, BamPaymentRecord,
  ExamQuestion, WebsiteConfig
} from '../types';
import { StudentRepository } from '../repositories/StudentRepository';
import { UserProfileRepository } from '../repositories/UserProfileRepository';
import { PaymentRepository } from '../repositories/PaymentRepository';
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

    // =========================================================================
    // PULL ONLY: Refetch datasets strictly from Supabase Server (SSOT)
    // Dilarang melakukan merge atau push data lokal ke database server!
    // =========================================================================
    onProgress?.('Mengambil data terbaru dari server Supabase...', 35);

    const [
      studentsRes,
      usersRes,
      paymentsRes,
      cloudQuotas,
      cloudSchoolInfo,
      cloudCosts,
      cloudSchedules,
      cloudQuestions,
      cloudGas,
      cloudWebsite,
    ] = await Promise.all([
      StudentRepository.list(),
      UserProfileRepository.listForAdmin(),
      PaymentRepository.list(),
      fetchClassQuotasFromSupabase(),
      fetchSchoolInfoFromSupabase(),
      fetchCostBreakdownFromSupabase(),
      fetchTestSchedulesFromSupabase(),
      fetchQuestionBankFromSupabase(),
      fetchGasConfigFromSupabase(),
      fetchWebsiteConfigFromSupabase(),
    ]);

    onProgress?.('Memperbarui cache lokal dari database server...', 75);

    const cloudStudents = studentsRes.data;
    const cloudUsers = usersRes.data;
    const cloudPayments = paymentsRes.data;

    // Filter form payments and bam payments from cloud payments
    const cloudFormPayments: FormPaymentRecord[] = cloudPayments
      .filter(p => p.paymentType === 'form')
      .map(p => ({
        id: p.id,
        transactionNumber: p.id.replace('pay_', 'TRX-FORM-').toUpperCase(),
        paymentDate: p.paymentDate || p.createdAt.split('T')[0],
        studentId: p.studentId,
        studentName: p.studentName,
        registrationNumber: p.registrationNumber,
        gender: 'Laki-laki',
        amount: p.amount,
        category: 'Internal',
        notes: p.notes,
        proofUrl: p.proofUrl,
        createdAt: p.createdAt,
      }));

    const cloudBamPayments: BamPaymentRecord[] = cloudPayments
      .filter(p => p.paymentType === 'bam')
      .map(p => ({
        id: p.id,
        transactionNumber: p.id.replace('pay_', 'TRX-BAM-').toUpperCase(),
        paymentDate: p.paymentDate || p.createdAt.split('T')[0],
        studentId: p.studentId,
        studentName: p.studentName,
        registrationNumber: p.registrationNumber,
        gender: 'Laki-laki',
        totalBamCost: 6625000,
        amountPaid: p.amount,
        installmentType: 'Lunas' as const,
        totalPaidToDate: p.amount,
        remainingBalance: Math.max(0, 6625000 - p.amount),
        notes: p.notes,
        proofUrl: p.proofUrl,
        createdAt: p.createdAt,
      }));

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
        students: cloudStudents.length,
        users: cloudUsers.length,
        formPayments: cloudFormPayments.length,
        bamPayments: cloudBamPayments.length,
        classQuotas: cloudQuotas?.length || getStoredClassQuotas().length,
        schedules: cloudSchedules?.length || getStoredTestSchedules().length,
      },
      message: `Berhasil mengunduh & merefresh data terbaru dari server Supabase: ${cloudStudents.length} siswa, ${cloudUsers.length} akun, ${cloudPayments.length} transaksi pembayaran.`,
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
