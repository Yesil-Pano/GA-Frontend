// ga-frontend/src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import api from '../services/api';

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
}
interface DashboardWorkOrder {
  priority: string;
  status: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCount: 0, acilCount: 0, ortaCount: 0, dusukCount: 0,
    bekliyorCount: 0, devamEdiyorCount: 0, tamamlandiCount: 0, iptalEdildiCount: 0, activeUsers: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
  const loadDashboardData = async () => {
    try {
      const [ordersRes, teamsRes] = await Promise.all([
        api.get('/workorders'),
        api.get('/teams')
      ]);

      // 💡 ÇÖZÜM: orders dizisinin elemanlarını 'DashboardWorkOrder' tipiyle güvenceye alıyoruz
      const orders: DashboardWorkOrder[] = ordersRes.data;
      
      const statsObj = {
        totalCount: orders.length,
        acilCount: orders.filter((o: DashboardWorkOrder) => o.priority === 'Acil').length,
        ortaCount: orders.filter((o: DashboardWorkOrder) => o.priority === 'Orta').length,
        dusukCount: orders.filter((o: DashboardWorkOrder) => o.priority === 'Düşük').length,
        bekliyorCount: orders.filter((o: DashboardWorkOrder) => o.status === 'Bekliyor').length,
        devamEdiyorCount: orders.filter((o: DashboardWorkOrder) => o.status === 'Devam Ediyor').length,
        tamamlandiCount: orders.filter((o: DashboardWorkOrder) => o.status === 'Tamamlandı').length,
        iptalEdildiCount: orders.filter((o: DashboardWorkOrder) => o.status === 'İptal Edildi').length,
        activeUsers: teamsRes.data.length
      };
      setStats(statsObj);
    } catch (error) {
      console.error("Dashboard yüklenemedi:", error);
    } finally {
      setIsLoading(false);
    }
  };
  loadDashboardData();
}, []);

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

  // Yüzdelik Donut hesaplamaları
  const arizaPct = stats.totalCount > 0 ? ((stats.acilCount / stats.totalCount) * 100).toFixed(1) : '0.0';
  const bakimPct = stats.totalCount > 0 ? ((stats.ortaCount / stats.totalCount) * 100).toFixed(1) : '0.0';
  const digerPct = stats.totalCount > 0 ? ((stats.dusukCount / stats.totalCount) * 100).toFixed(1) : '0.0';

  return (
    <div className="absolute inset-0 z-30 bg-slate-50 p-6 overflow-y-auto w-full h-full">
      <div className="mb-6 flex items-center gap-2">
        <h1 className="text-xl font-bold text-brand-navy">Dashboard - Süreç Takip Raporu</h1>
        <span className="text-slate-400 cursor-pointer text-sm">ℹ️</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 1. Statüler */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-sm font-bold text-slate-600 mb-6">İş Emirleri Statüleri</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-24 text-right text-xs text-slate-500 font-bold">Acil</span>
              <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                <div className="h-6 bg-red-500 transition-all duration-500" style={{ width: `${stats.totalCount > 0 ? (stats.acilCount/stats.totalCount)*100 : 0}%` }}></div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 text-right text-xs text-slate-500 font-bold">Bekliyor</span>
              <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                <div className="h-6 bg-amber-500 transition-all duration-500" style={{ width: `${stats.totalCount > 0 ? (stats.bekliyorCount/stats.totalCount)*100 : 0}%` }}></div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 text-right text-xs text-slate-500 font-bold">Devam Ediyor</span>
              <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                <div className="h-6 bg-blue-500 transition-all duration-500" style={{ width: `${stats.totalCount > 0 ? (stats.devamEdiyorCount/stats.totalCount)*100 : 0}%` }}></div>
              </div>
            </div>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-4 font-bold">Canlı Dağılım Ölçeği</p>
        </div>

        {/* 2. İş Kategorileri Donut */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col justify-between">
          <h2 className="text-sm font-bold text-slate-600 mb-2">İş Kategorileri Oranları</h2>
          <div className="flex items-center justify-between flex-1">
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-400"></span><span className="text-slate-600 font-medium">AG/YG Bakım</span><span className="font-bold ml-2">%{bakimPct}</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span><span className="text-slate-600 font-medium">Saha Arıza</span><span className="font-bold ml-2">%{arizaPct}</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-400"></span><span className="text-slate-600 font-medium">Diğer Süzme</span><span className="font-bold ml-2">%{digerPct}</span></div>
            </div>
            <div className="relative w-32 h-32 rounded-full border-14 border-blue-400 border-t-red-500 border-l-slate-400 flex items-center justify-center shadow-inner">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-slate-700">{stats.totalCount}</p>
                <p className="text-[10px] text-slate-400 font-bold tracking-wider">TOPLAM</p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Günlük Tamamlananlar */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-sm font-bold text-slate-600 mb-4">Aylık Aktivite Dalgalanması</h2>
          <div className="h-32 flex items-end justify-between gap-1 border-b border-l border-slate-200 pl-2 pb-1 relative">
            {[30, 45, 60, 25, 70, 85, 40, 50, 95, 30, 75, 40, 60, 80, 90, 100, 35, 55, 70, 85, 40, 20, 60].map((h, i) => (
              <div key={i} className="w-2 bg-rose-500 rounded-t-sm opacity-85 transition-all hover:opacity-100" style={{ height: `${h}%` }}></div>
            ))}
          </div>
          <p className="text-right text-[10px] text-slate-400 mt-2 font-semibold">Güncellenme: 2026-06-20</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 4. İş Tamamlama Tipleri */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-600 mb-4">İş Tamamlama Havuz Sayıları</h2>
          <div className="h-40 flex items-end justify-around border-b border-l border-slate-200 pl-2 pb-1 relative text-xs font-bold">
            <div className="flex flex-col items-center w-12"><div className="bg-amber-400 w-8 rounded-t transition-all" style={{ height: `${stats.bekliyorCount * 20 || 4}px` }}></div><span className="text-[9px] text-slate-500 mt-1">Bekleyen</span></div>
            <div className="flex flex-col items-center w-12"><div className="bg-blue-400 w-8 rounded-t transition-all" style={{ height: `${stats.devamEdiyorCount * 20 || 4}px` }}></div><span className="text-[9px] text-slate-500 mt-1">DevamEden</span></div>
            <div className="flex flex-col items-center w-12"><div className="bg-emerald-500 w-8 rounded-t transition-all" style={{ height: `${stats.tamamlandiCount * 20 || 4}px` }}></div><span className="text-[9px] text-slate-500 mt-1">Tamamlanan</span></div>
            <div className="flex flex-col items-center w-12"><div className="bg-rose-500 w-8 rounded-t transition-all" style={{ height: `${stats.iptalEdildiCount * 20 || 4}px` }}></div><span className="text-[9px] text-slate-500 mt-1">İptalEdilen</span></div>
          </div>
        </div>

        {/* 5. Geometrik Ortalama Mock */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 lg:col-span-1">
          <h2 className="text-sm font-bold text-slate-600 mb-4 truncate">Öncelik Kapatma Hız Çizgisi</h2>
          <div className="h-40 border-b border-l border-slate-200 relative flex items-center justify-center text-rose-500 overflow-hidden">
             <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                <polyline points="0,80 25,60 50,20 75,75 100,30" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3,3"/>
                <circle cx="25" cy="60" r="3" fill="white" stroke="currentColor" strokeWidth="2"/>
                <circle cx="50" cy="20" r="3" fill="white" stroke="currentColor" strokeWidth="2"/>
                <circle cx="75" cy="75" r="3" fill="white" stroke="currentColor" strokeWidth="2"/>
             </svg>
          </div>
        </div>

        {/* 6. KPI Kartı */}
        <div className="grid grid-rows-2 gap-4 lg:col-span-1">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col items-center justify-center">
            <p className="text-4xl font-extrabold text-brand-navy">{stats.activeUsers}</p>
            <p className="text-[11px] text-slate-500 font-bold mt-1">Aktif Saha Ekip Sayısı</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col items-center justify-center">
            <p className="text-4xl font-extrabold text-slate-400">1</p>
            <p className="text-[11px] text-slate-400 font-bold mt-1">Pasif Kullanıcı Sayısı</p>
          </div>
        </div>
      </div>
    </div>
  );
}