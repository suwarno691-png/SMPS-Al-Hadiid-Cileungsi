import React, { useState, useEffect } from 'react';
import {
  Database, RefreshCw, ArrowDownToLine, ArrowUpFromLine, CheckCircle2,
  AlertCircle, Clock, ShieldCheck, Sparkles, Server, HardDrive, HelpCircle,
  CheckCircle, ArrowRight, Zap, RefreshCcw
} from 'lucide-react';
import {
  performFullSupabaseSync,
  fetchSyncComparisonStats,
  getLastSyncInfo,
  formatSyncTime,
  SyncMode,
  SyncStatsComparison,
  SyncResult
} from '../utils/supabaseSync';
import {
  testSupabaseConnection,
  SUPABASE_PROJECT_NAME,
  SUPABASE_PROJECT_ID,
  SUPABASE_URL
} from '../utils/supabaseClient';

interface SupabaseSyncTabProps {
  onRefreshAllData?: () => void;
}

export const SupabaseSyncTab: React.FC<SupabaseSyncTabProps> = ({ onRefreshAllData }) => {
  const [stats, setStats] = useState<SyncStatsComparison | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ stage: string; percent: number }>({
    stage: '',
    percent: 0,
  });
  const [lastResult, setLastResult] = useState<SyncResult | null>(() => getLastSyncInfo());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadStats = async () => {
    setLoadingStats(true);
    setErrorMessage(null);
    try {
      const data = await fetchSyncComparisonStats();
      setStats(data);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memuat perbandingan database.');
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
    setLastResult(getLastSyncInfo());
  }, []);

  const handleSync = async (mode: SyncMode) => {
    setIsSyncing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setSyncProgress({ stage: 'Menyiapkan sinkronisasi...', percent: 10 });

    try {
      const result = await performFullSupabaseSync(mode, (stage, percent) => {
        setSyncProgress({ stage, percent });
      });

      setLastResult(result);
      setSuccessMessage(result.message);
      await loadStats();

      if (onRefreshAllData) {
        onRefreshAllData();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat menyinkronkan data.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold border border-blue-500/30">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span>Pusat Sinkronisasi Database Cloud Supabase</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">
            Sinkronisasi Data Real-Time Supabase
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Selaraskan data pendaftar, akun pengguna, pembayaran formulir, pembayaran awal masuk (BAM), kuota kelas, dan jadwal ujian antara penyimpanan browser lokal dengan database cloud Supabase.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={loadStats}
            disabled={loadingStats || isSyncing}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
            <span>Periksa Status Data</span>
          </button>

          <button
            onClick={() => handleSync('smart')}
            disabled={isSyncing}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Data Sekarang'}</span>
          </button>
        </div>
      </div>

      {/* Status Alerts */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-medium flex items-start justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-sm font-bold text-emerald-950 mb-0.5">
                Sinkronisasi Berhasil Dilakukan
              </strong>
              <span>{successMessage}</span>
            </div>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs font-medium flex items-start justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-sm font-bold text-rose-950 mb-0.5">
                Kendala Sinkronisasi
              </strong>
              <span>{errorMessage}</span>
            </div>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900 font-bold text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Progress Bar during active sync */}
      {isSyncing && (
        <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl space-y-3 animate-pulse shadow-sm">
          <div className="flex justify-between items-center text-xs font-bold text-blue-900">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              {syncProgress.stage}
            </span>
            <span className="text-blue-700 font-mono text-sm">{syncProgress.percent}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${syncProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Cloud & Connection Metadata Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Status Koneksi Supabase</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold text-slate-900">
                {stats?.connectionOk ? 'Terkoneksi (Aktif)' : 'Memeriksa / Terputus'}
              </span>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  stats?.connectionOk ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              {stats?.connectionMessage || 'Koneksi ke server normal'}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Server className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-slate-500 font-medium">Identitas Cloud Supabase</div>
            <div className="text-sm font-bold text-slate-900 truncate">
              {SUPABASE_PROJECT_NAME}
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
              ID: {SUPABASE_PROJECT_ID}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Waktu Sinkron Terakhir</div>
            <div className="text-sm font-bold text-slate-900">
              {formatSyncTime(lastResult?.timestamp)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Mode: {lastResult?.mode ? (lastResult.mode === 'smart' ? 'Dua Arah' : lastResult.mode.toUpperCase()) : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Data Parity / Comparison Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-600" />
              <span>Komparasi Data: Browser Lokal vs Database Supabase</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Memastikan jumlah data pendaftar dan transaksi di aplikasi selaras dengan yang tersimpan di cloud.
            </p>
          </div>
          {loadingStats && (
            <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Memuat data pembanding...
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-xs font-semibold text-slate-600">Calon Murid</div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {stats?.local.students ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1">
              <span>Cloud:</span>
              <strong className="text-blue-600 font-bold">{stats?.cloud.students ?? 0}</strong>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-xs font-semibold text-slate-600">Akun Pengguna</div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {stats?.local.users ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1">
              <span>Cloud:</span>
              <strong className="text-blue-600 font-bold">{stats?.cloud.users ?? 0}</strong>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-xs font-semibold text-slate-600">Bayar Formulir</div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {stats?.local.formPayments ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1">
              <span>Cloud:</span>
              <strong className="text-blue-600 font-bold">{stats?.cloud.formPayments ?? 0}</strong>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-xs font-semibold text-slate-600">Bayar BAM</div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {stats?.local.bamPayments ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1">
              <span>Cloud:</span>
              <strong className="text-blue-600 font-bold">{stats?.cloud.bamPayments ?? 0}</strong>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-xs font-semibold text-slate-600">Kuota Kelas</div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {stats?.local.classQuotas ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1">
              <span>Cloud:</span>
              <strong className="text-blue-600 font-bold">{stats?.cloud.classQuotas ?? 0}</strong>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-xs font-semibold text-slate-600">Jadwal Ujian</div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {stats?.local.schedules ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1">
              <span>Cloud:</span>
              <strong className="text-blue-600 font-bold">{stats?.cloud.schedules ?? 0}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Execution Options Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Smart Sync (Primary) */}
        <div className="bg-white p-6 rounded-2xl border-2 border-blue-500 shadow-md flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
            Rekomendasi Utama
          </div>

          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Sinkronisasi Dua Arah (Smart Sync)
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Menggabungkan data lokal dan Supabase secara cerdas. Mempertahankan siswa dan pembayaran terverifikasi di kedua sisi tanpa ada data yang tertimpa atau hilang.
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100">
            <button
              onClick={() => handleSync('smart')}
              disabled={isSyncing}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Jalankan Smart Sync</span>
            </button>
          </div>
        </div>

        {/* Card 2: Pull */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ArrowDownToLine className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Tarik dari Cloud (Pull)
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Mengunduh data resmi terbaru dari server Supabase dan menggantikan cache lokal browser Anda. Cocok digunakan jika Anda berganti perangkat atau browser.
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100">
            <button
              onClick={() => handleSync('pull')}
              disabled={isSyncing}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>Tarik Data Supabase</span>
            </button>
          </div>
        </div>

        {/* Card 3: Push */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <ArrowUpFromLine className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Kirim ke Cloud (Push)
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Mengunggah seluruh data yang ada di browser saat ini (siswa pendaftar, akun pengguna, bukti transfer) ke database Supabase untuk dijadikan master data.
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100">
            <button
              onClick={() => handleSync('push')}
              disabled={isSyncing}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <ArrowUpFromLine className="w-4 h-4" />
              <span>Unggah Data ke Supabase</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
