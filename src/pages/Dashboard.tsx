// ga-frontend/src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../services/api';

interface DashboardStats {
  totalCount: number;
  acilCount: number;
  ortaCount: number;
  dusukCount: number;
  devamEdiyorCount: number;
  tamamlandiCount: number;
  iptalEdildiCount: number;
  activeUsers: number;
  completedToday: number;
}

interface MonthlyDay {
  day: number;
  created: number;
  completed: number;
  completionPct: number;
}

interface DailyFault {
  date: string;
  label: string;
  count: number;
}

export default function Dashboard() {
  const { partnerKey } = useOutletContext<{ partnerKey?: string }>();
  const [stats, setStats] = useState<DashboardStats>({
    totalCount: 0, acilCount: 0, ortaCount: 0, dusukCount: 0,
    devamEdiyorCount: 0, tamamlandiCount: 0, iptalEdildiCount: 0, activeUsers: 0,
    completedToday: 0,
  });
  const [monthlyActivity, setMonthlyActivity] = useState<MonthlyDay[]>([]);
  const [dailyFaults, setDailyFaults] = useState<DailyFault[]>([]);
  const [generatedAt, setGeneratedAt] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get('/dashboard/summary', {
          params: partnerKey ? { partnerKey } : undefined,
        });
        setStats(data.stats);
        setMonthlyActivity(data.monthlyActivity ?? []);
        setDailyFaults(data.dailyFaults ?? []);
        setGeneratedAt(data.generatedAt ?? '');
      } catch (error) {
        console.error('Dashboard yüklenemedi:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboardData();
  }, [partnerKey]);

  if (isLoading) {
    return (
      <div className="absolute inset-0 z-30 bg-slate-50 flex flex-col items-center justify-center space-y-3">
        <svg className="animate-spin h-9 w-9 text-brand-orange" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-xs font-bold text-slate-400">Canlı Süreç Raporları Hesaplanıyor...</span>
      </div>
    );
  }

  const arizaPct = stats.totalCount > 0 ? ((stats.acilCount / stats.totalCount) * 100).toFixed(1) : '0.0';
  const bakimPct = stats.totalCount > 0 ? ((stats.ortaCount / stats.totalCount) * 100).toFixed(1) : '0.0';
  const digerPct = stats.totalCount > 0 ? ((stats.dusukCount / stats.totalCount) * 100).toFixed(1) : '0.0';
  const maxMonthly = Math.max(...monthlyActivity.map((d) => d.created), 1);
  const maxFaults = Math.max(...dailyFaults.map((d) => d.count), 1);

  return (
    <div className="absolute inset-0 z-30 bg-slate-50 p-6 overflow-y-auto w-full h-full">
      <div className="mb-6 flex items-center gap-2">
        <h1 className="text-xl font-bold text-brand-navy">Dashboard - Süreç Takip Raporu</h1>
        {generatedAt && (
          <span className="text-[10px] text-slate-400 font-semibold ml-auto">Güncelleme: {generatedAt}</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-sm font-bold text-slate-600 mb-6">İş Emirleri Statüleri</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-24 text-right text-xs text-slate-500 font-bold">Acil</span>
              <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                <div className="h-6 bg-red-500 transition-all duration-500" style={{ width: `${stats.totalCount > 0 ? (stats.acilCount / stats.totalCount) * 100 : 0}%` }} />
              </div>
              <span className="text-xs font-bold text-slate-500 w-6">{stats.acilCount}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 text-right text-xs text-slate-500 font-bold">Devam Ediyor</span>
              <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                <div className="h-6 bg-blue-500 transition-all duration-500" style={{ width: `${stats.totalCount > 0 ? (stats.devamEdiyorCount / stats.totalCount) * 100 : 0}%` }} />
              </div>
              <span className="text-xs font-bold text-slate-500 w-6">{stats.devamEdiyorCount}</span>
            </div>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-4 font-bold">Canlı Dağılım Ölçeği</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col justify-between">
          <h2 className="text-sm font-bold text-slate-600 mb-2">İş Kategorileri Oranları</h2>
          <div className="flex items-center justify-between flex-1">
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-400" /><span className="text-slate-600 font-medium">AG/YG Bakım</span><span className="font-bold ml-2">%{bakimPct}</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500" /><span className="text-slate-600 font-medium">Saha Arıza</span><span className="font-bold ml-2">%{arizaPct}</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-400" /><span className="text-slate-600 font-medium">Diğer Süzme</span><span className="font-bold ml-2">%{digerPct}</span></div>
            </div>
            <div className="relative w-32 h-32 rounded-full border-14 border-blue-400 border-t-red-500 border-l-slate-400 flex items-center justify-center shadow-inner">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-slate-700">{stats.totalCount}</p>
                <p className="text-[10px] text-slate-400 font-bold tracking-wider">TOPLAM</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-sm font-bold text-slate-600 mb-4">Aylık Aktivite Dalgalanması</h2>
          <div className="h-32 flex items-end justify-between gap-0.5 border-b border-l border-slate-200 pl-2 pb-1 overflow-x-auto">
            {monthlyActivity.map((d) => (
              <div
                key={d.day}
                className="group relative flex-1 min-w-1.5 max-w-2.5"
                title={`${d.day}. gün — Açılan: ${d.created}, Tamamlanan: ${d.completed} (%${d.completionPct})`}
              >
                <div
                  className="w-full bg-rose-500 rounded-t-sm opacity-85 group-hover:opacity-100 transition-all"
                  style={{ height: `${Math.max(4, (d.created / maxMonthly) * 100)}%` }}
                />
                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10 whitespace-nowrap bg-slate-800 text-white text-[9px] px-2 py-1 rounded shadow">
                  {d.day}. gün · %{d.completionPct} tamamlanma
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-600 mb-4">İş Tamamlama Havuz Sayıları</h2>
          <div className="h-40 flex items-end justify-around gap-2 border-b border-l border-slate-200 pl-2 pb-1 relative text-xs font-bold">
            <div className="flex min-w-0 flex-1 flex-col items-center">
              <div className="w-8 rounded-t bg-blue-400 transition-all" style={{ height: `${stats.devamEdiyorCount * 20 || 4}px` }} />
              <span className="mt-1 text-center text-[9px] whitespace-nowrap text-slate-500">Devam Eden</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-center">
              <div className="w-8 rounded-t bg-emerald-500 transition-all" style={{ height: `${stats.tamamlandiCount * 20 || 4}px` }} />
              <span className="mt-1 text-center text-[9px] whitespace-nowrap text-slate-500">Tamamlanan</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-center">
              <div className="w-8 rounded-t bg-rose-500 transition-all" style={{ height: `${stats.iptalEdildiCount * 20 || 4}px` }} />
              <span className="mt-1 text-center text-[9px] whitespace-nowrap text-slate-500">İptal Edilen</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 lg:col-span-1">
          <h2 className="text-sm font-bold text-slate-600 mb-4 truncate">Günlük Açılan Arıza</h2>
          <div className="h-40 flex items-end justify-between gap-1 border-b border-l border-slate-200 pl-2 pb-1">
            {dailyFaults.map((d) => (
              <div
                key={d.date}
                className="group relative flex-1 min-w-2"
                title={`${d.label}: ${d.count} arıza`}
              >
                <div
                  className="w-full bg-orange-500 rounded-t-sm opacity-85 group-hover:opacity-100"
                  style={{ height: `${Math.max(4, (d.count / maxFaults) * 100)}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-rows-2 gap-4 lg:col-span-1">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col items-center justify-center">
            <p className="text-4xl font-extrabold text-brand-navy">{stats.activeUsers}</p>
            <p className="text-[11px] text-slate-500 font-bold mt-1">Aktif Saha Ekip Sayısı</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col items-center justify-center">
            <p className="text-4xl font-extrabold text-emerald-600">{stats.completedToday}</p>
            <p className="text-[11px] text-slate-500 font-bold mt-1">Bugün Tamamlanan</p>
          </div>
        </div>
      </div>
    </div>
  );
}
