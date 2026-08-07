// ga-frontend/src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../services/api';
import { formatTurkeyDateTime } from '../utils/dateTime';
import PageLoading from '../components/PageLoading';

interface DashboardStats {
  totalCount: number;
  acilCount: number;
  ortaCount: number;
  dusukCount: number;
  bekliyorCount: number;
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

type BarItem = {
  key: string;
  label: string;
  value: number;
  color: string;
  title?: string;
};

function VerticalBarChart({
  items,
  emptyMessage = 'Veri bulunamadı',
  showLabels = false,
}: {
  items: BarItem[];
  emptyMessage?: string;
  showLabels?: boolean;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const hasData = items.some((i) => i.value > 0);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-[100px] flex items-end gap-1 sm:gap-1.5 border-b border-l border-slate-200 pl-2 pb-1 overflow-x-auto overflow-y-hidden">
        {!hasData ? (
          <p className="m-auto text-xs font-medium text-slate-400 px-2 text-center">{emptyMessage}</p>
        ) : (
          items.map((item) => {
            const pct = (item.value / max) * 100;
            return (
              <div
                key={item.key}
                className="group flex h-full min-w-[10px] max-w-[20px] flex-1 flex-col items-center justify-end"
                title={item.title ?? `${item.label}: ${item.value}`}
              >
                <span className="mb-1 hidden text-[9px] font-bold text-slate-500 group-hover:block">
                  {item.value}
                </span>
                <div
                  className={`w-full max-w-[14px] rounded-t-sm transition-all ${item.color}`}
                  style={{ height: `${Math.max(item.value > 0 ? 8 : 3, pct)}%`, maxHeight: '100%' }}
                />
              </div>
            );
          })
        )}
      </div>
      {showLabels && hasData && (
        <div className="mt-1 flex gap-1 overflow-x-hidden px-1">
          {items.map((item, index) => (
            <span
              key={item.key}
              className="min-w-[10px] max-w-[20px] flex-1 truncate text-center text-[8px] font-semibold text-slate-400"
              title={item.label}
            >
              {(index % 2 === 0 || items.length <= 7) ? item.label : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function HorizontalBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-right text-xs font-bold text-slate-500">{label}</span>
      <div className="h-6 min-w-0 flex-1 overflow-hidden rounded bg-slate-100">
        <div className={`h-full rounded transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-bold text-slate-500">{value}</span>
    </div>
  );
}

export default function Dashboard() {
  const { partnerKey } = useOutletContext<{ partnerKey?: string }>();
  const [stats, setStats] = useState<DashboardStats>({
    totalCount: 0, acilCount: 0, ortaCount: 0, dusukCount: 0,
    bekliyorCount: 0, devamEdiyorCount: 0, tamamlandiCount: 0, iptalEdildiCount: 0, activeUsers: 0,
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
    return <PageLoading className="absolute inset-0 z-30 min-h-0 h-full" />;
  }

  const arizaPct = stats.totalCount > 0 ? ((stats.acilCount / stats.totalCount) * 100).toFixed(1) : '0.0';
  const bakimPct = stats.totalCount > 0 ? ((stats.ortaCount / stats.totalCount) * 100).toFixed(1) : '0.0';
  const digerPct = stats.totalCount > 0 ? ((stats.dusukCount / stats.totalCount) * 100).toFixed(1) : '0.0';

  const monthlyCreatedItems: BarItem[] = monthlyActivity.map((d) => ({
    key: `day-${d.day}`,
    label: String(d.day),
    value: d.created,
    color: 'bg-rose-500 opacity-90',
    title: `${d.day}. gün — Açılan: ${d.created}, Tamamlanan: ${d.completed} (%${d.completionPct})`,
  }));

  const monthlyCompletedItems: BarItem[] = monthlyActivity.map((d) => ({
    key: `done-${d.day}`,
    label: String(d.day),
    value: d.completed,
    color: 'bg-emerald-500 opacity-90',
    title: `${d.day}. gün — Tamamlanan: ${d.completed}`,
  }));

  const dailyFaultItems: BarItem[] = dailyFaults.map((d) => ({
    key: d.date,
    label: d.label,
    value: d.count,
    color: 'bg-orange-500 opacity-90',
    title: `${d.label}: ${d.count} arıza`,
  }));

  const poolItems: BarItem[] = [
    { key: 'devam', label: 'Devam Eden', value: stats.devamEdiyorCount, color: 'bg-blue-400' },
    { key: 'tamam', label: 'Tamamlanan', value: stats.tamamlandiCount, color: 'bg-emerald-500' },
    { key: 'iptal', label: 'İptal Edilen', value: stats.iptalEdildiCount, color: 'bg-rose-500' },
  ];

  const cardClass = 'bg-white p-4 md:p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col min-h-0 h-full overflow-hidden';

  return (
    <div className="absolute inset-0 z-30 bg-slate-50 p-4 md:p-6 flex flex-col h-full min-h-0 overflow-hidden">
      <div className="mb-4 shrink-0 flex items-center gap-2">
        <h1 className="text-xl font-bold text-brand-navy">Dashboard - Süreç Takip Raporu</h1>
        {generatedAt && (
          <span className="text-[10px] text-slate-400 font-semibold ml-auto">
            Güncelleme: {formatTurkeyDateTime(generatedAt)}
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 grid grid-rows-2 gap-4 md:gap-6">
        {/* Üst sıra */}
        <div className="min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className={cardClass}>
            <h2 className="text-sm font-bold text-slate-600 mb-4 shrink-0">İş Emirleri Statüleri</h2>
            <div className="flex-1 min-h-0 flex flex-col justify-center space-y-4 overflow-hidden">
              <HorizontalBar label="Acil" value={stats.acilCount} total={stats.totalCount} color="bg-red-500" />
              <HorizontalBar label="Bekliyor" value={stats.bekliyorCount} total={stats.totalCount} color="bg-amber-500" />
              <HorizontalBar label="Devam Ediyor" value={stats.devamEdiyorCount} total={stats.totalCount} color="bg-blue-500" />
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-3 font-bold shrink-0">Canlı Dağılım Ölçeği</p>
          </div>

          <div className={cardClass}>
            <h2 className="text-sm font-bold text-slate-600 mb-2 shrink-0">İş Kategorileri Oranları</h2>
            <div className="flex-1 min-h-0 flex items-center justify-between gap-4 overflow-hidden">
              <div className="space-y-2 text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-slate-600 font-medium">AG/YG Bakım</span>
                  <span className="font-bold ml-2">%{bakimPct}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                  <span className="text-slate-600 font-medium">Saha Arıza</span>
                  <span className="font-bold ml-2">%{arizaPct}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0" />
                  <span className="text-slate-600 font-medium">Diğer Süzme</span>
                  <span className="font-bold ml-2">%{digerPct}</span>
                </div>
              </div>
              <div
                className="relative shrink-0 w-28 h-28 md:w-36 md:h-36 rounded-full flex items-center justify-center shadow-inner"
                style={{
                  background: `conic-gradient(#ef4444 0 ${arizaPct}%, #60a5fa ${arizaPct}% ${Number(arizaPct) + Number(bakimPct)}%, #94a3b8 ${Number(arizaPct) + Number(bakimPct)}% 100%)`,
                }}
              >
                <div className="absolute inset-3 md:inset-4 bg-white rounded-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xl md:text-2xl font-extrabold text-slate-700">{stats.totalCount}</p>
                    <p className="text-[10px] text-slate-400 font-bold tracking-wider">TOPLAM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
              <h2 className="text-sm font-bold text-slate-600">Aylık Aktivite Dalgalanması</h2>
              <div className="flex items-center gap-3 text-[9px] font-bold text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500" /> Açılan</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Tamamlanan</span>
              </div>
            </div>
            <div className="flex-1 min-h-0 grid grid-rows-2 gap-2">
              <VerticalBarChart
                items={monthlyCreatedItems}
                emptyMessage="Bu ay açılan iş emri yok"
                showLabels
              />
              <VerticalBarChart
                items={monthlyCompletedItems}
                emptyMessage="Bu ay tamamlanan iş emri yok"
              />
            </div>
          </div>
        </div>

        {/* Alt sıra — ekranın alt yarısını doldurur */}
        <div className="min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
          <div className={`${cardClass} lg:col-span-2`}>
            <h2 className="text-sm font-bold text-slate-600 mb-3 shrink-0">İş Tamamlama Havuz Sayıları</h2>
            <VerticalBarChart items={poolItems} />
            <div className="mt-2 flex flex-wrap justify-center gap-4 text-[10px] font-bold text-slate-500 shrink-0">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400" /> Devam Eden</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Tamamlanan</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> İptal Edilen</span>
            </div>
          </div>

          <div className={`${cardClass} lg:col-span-1`}>
            <h2 className="text-sm font-bold text-slate-600 mb-3 shrink-0 truncate">Günlük Açılan Arıza (Son 14 Gün)</h2>
            <VerticalBarChart
              items={dailyFaultItems}
              emptyMessage="Son 14 günde arıza kaydı yok"
              showLabels
            />
          </div>

          <div className="grid grid-rows-2 gap-4 min-h-0 lg:col-span-1">
            <div className={`${cardClass} items-center justify-center text-center`}>
              <p className="text-4xl md:text-5xl font-extrabold text-brand-navy">{stats.activeUsers}</p>
              <p className="text-[11px] text-slate-500 font-bold mt-2">Aktif Saha Ekip Sayısı</p>
            </div>
            <div className={`${cardClass} items-center justify-center text-center`}>
              <p className="text-4xl md:text-5xl font-extrabold text-emerald-600">{stats.completedToday}</p>
              <p className="text-[11px] text-slate-500 font-bold mt-2">Bugün Tamamlanan</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
