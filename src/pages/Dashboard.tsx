// ga-frontend/src/pages/Dashboard.tsx

export default function Dashboard() {
  return (
    // z-30 ve bg-slate-50 vererek şimdilik arkadaki haritayı tamamen örtüyoruz
    <div className="absolute inset-0 z-30 bg-slate-50 p-6 overflow-y-auto w-full h-full">
      
      {/* BAŞLIK */}
      <div className="mb-6 flex items-center gap-2">
        <h1 className="text-xl font-bold text-brand-navy">Dashboard - Süreç Takip Raporu</h1>
        <span className="text-slate-400 cursor-pointer hover:text-slate-600" title="Bilgi">ℹ️</span>
      </div>

      {/* ÜST SATIR GRAFİKLERİ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* 1. İş Emirleri Statüleri (Yatay Bar) */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-sm font-bold text-slate-600 mb-6">İş Emirleri Statüleri</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-24 text-right text-xs text-slate-500 font-medium">Acil</span>
              <div className="flex-1 h-6 bg-slate-100 rounded">
                <div className="h-6 bg-emerald-500 rounded" style={{ width: '40%' }}></div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 text-right text-xs text-slate-500 font-medium">Cevap Verilmedi</span>
              <div className="flex-1 h-6 bg-slate-100 rounded"></div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 text-right text-xs text-slate-500 font-medium">Düşük</span>
              <div className="flex-1 h-6 bg-slate-100 rounded"></div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 text-right text-xs text-slate-500 font-medium">Orta</span>
              <div className="flex-1 h-6 bg-slate-100 rounded">
                <div className="h-6 bg-emerald-500 rounded" style={{ width: '85%' }}></div>
              </div>
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-2 pl-28 pr-4">
            <span>0</span>
            <span>2,000</span>
            <span>4,000</span>
            <span>6,000</span>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-1">Count</p>
        </div>

        {/* 2. İş Kategorileri (Donut Grafiği Görünümü) */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col justify-between">
          <h2 className="text-sm font-bold text-slate-600 mb-2">İş Kategorileri</h2>
          <div className="flex items-center justify-between flex-1">
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-400"></span><span className="text-slate-600">AG Bakım</span><span className="font-bold ml-2">75.91%</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-600"></span><span className="text-slate-600">Arıza Bildiri...</span><span className="font-bold ml-2">22.70%</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-400"></span><span className="text-slate-600">Other</span><span className="font-bold ml-2">1.39%</span></div>
            </div>
            <div className="relative w-32 h-32 rounded-full border-16 border-blue-400 border-t-blue-600 border-l-slate-400 flex items-center justify-center">
              <div className="text-center">
                <p className="text-lg font-bold text-slate-700">10,276</p>
                <p className="text-[10px] text-slate-400 font-bold">TOTAL</p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Günlük Tamamlanan İşler (Mock Çizgi Grafik) */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-sm font-bold text-slate-600 mb-4">Günlük Tamamlanan İşler</h2>
          <div className="h-32 flex items-end justify-between gap-1 border-b border-l border-slate-200 pl-2 pb-1 relative">
            {/* Y Ekseni Etiketleri */}
            <div className="absolute -left-5 top-0 bottom-0 flex flex-col justify-between text-[10px] text-slate-400">
              <span>120</span><span>100</span><span>80</span><span>60</span><span>40</span><span>20</span><span>0</span>
            </div>
            {/* Rastgele dikey çubuklarla dalgalanma efekti */}
            {[40, 20, 60, 30, 80, 20, 40, 50, 30, 20, 90, 40, 60, 30, 80, 100, 40, 60, 30, 80, 40, 20, 60].map((h, i) => (
              <div key={i} className="w-2 bg-rose-500 rounded-t-sm opacity-80" style={{ height: `${h}%` }}></div>
            ))}
          </div>
          <p className="text-right text-[10px] text-slate-500 mt-2">January 1, 2026</p>
          <p className="text-center text-[10px] text-slate-400 mt-1">Güncellenme Tarihi</p>
        </div>
      </div>

      {/* ALT SATIR GRAFİKLERİ */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* 4. İş Tamamlama Tipleri (Dikey Bar) */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 lg:col-span-1">
          <h2 className="text-sm font-bold text-slate-600 mb-4">İş Tamamlama Tipleri</h2>
          <div className="h-40 flex items-end justify-around border-b border-l border-slate-200 pl-2 pb-1 relative">
             <div className="absolute -left-8 top-0 bottom-0 flex flex-col justify-between text-[10px] text-slate-400">
              <span>10,000</span><span>8,000</span><span>6,000</span><span>4,000</span><span>2,000</span><span>0</span>
            </div>
            <div className="w-8 bg-amber-400 rounded-t h-[2%] relative group"><span className="absolute -bottom-5 text-[9px] text-slate-500 -ml-2">Atanmamış</span></div>
            <div className="w-8 bg-amber-400 rounded-t h-[5%] relative group"><span className="absolute -bottom-5 text-[9px] text-slate-500 -ml-1">Atanmış</span></div>
            <div className="w-8 bg-amber-400 rounded-t h-[1%] relative group"><span className="absolute -bottom-5 text-[9px] text-slate-500 ml-1">Eksik</span></div>
            <div className="w-8 bg-amber-400 rounded-t h-[15%] relative group"><span className="absolute -bottom-5 text-[9px] text-slate-500 -ml-2 whitespace-nowrap">İptal Edildi</span></div>
            <div className="w-8 bg-amber-400 rounded-t h-[90%] relative group"><span className="absolute -bottom-5 text-[9px] text-slate-500 -ml-3 whitespace-nowrap">Tamamlandı</span></div>
          </div>
        </div>

        {/* 5. İş Önceliklerine Göre... (Çizgi Grafik Mockup) */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 lg:col-span-1">
          <h2 className="text-sm font-bold text-slate-600 mb-4 truncate">İş Önceliklerine Göre Ortalama İş Ta...</h2>
          <div className="h-40 border-b border-l border-slate-200 relative flex items-center justify-center text-rose-500 overflow-hidden">
             {/* Basit bir SVG ile çizgi grafik taklidi */}
             <svg viewBox="0 0 100 100" className="w-full h-full preserve-3d" preserveAspectRatio="none">
                <polyline points="0,90 20,85 40,50 60,10 80,70 100,40" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2"/>
                <circle cx="20" cy="85" r="2" fill="white" stroke="currentColor" strokeWidth="1"/>
                <circle cx="40" cy="50" r="2" fill="white" stroke="currentColor" strokeWidth="1"/>
                <circle cx="60" cy="10" r="2" fill="white" stroke="currentColor" strokeWidth="1"/>
                <circle cx="80" cy="70" r="2" fill="white" stroke="currentColor" strokeWidth="1"/>
                <circle cx="100" cy="40" r="2" fill="white" stroke="currentColor" strokeWidth="1"/>
             </svg>
          </div>
        </div>

        {/* 6. Haftalık Oluşturulan İşler (Yatay Bar) */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 lg:col-span-1">
          <h2 className="text-sm font-bold text-slate-600 mb-4">Haftalık Oluşturulan İşler</h2>
          <div className="flex">
            <div className="w-24 text-[9px] text-slate-500 flex flex-col justify-between text-right pr-2 space-y-1">
              <span>January 5, 2025</span><span>January 12, 2025</span><span>January 19, 2025</span>
              <span>January 26, 2025</span><span>February 2, 2025</span><span>February 9, 2025</span>
              <span>February 16, 2025</span><span>February 23, 2025</span><span>Other (68)</span>
            </div>
            <div className="flex-1 border-l border-slate-200 flex flex-col justify-between pb-1">
              <div className="h-2"></div><div className="h-2"></div><div className="h-2 bg-purple-500 w-[2%]"></div>
              <div className="h-2 bg-purple-500 w-[1%]"></div><div className="h-2"></div><div className="h-2"></div>
              <div className="h-2 bg-purple-500 w-[3%]"></div><div className="h-2 bg-purple-500 w-[5%]"></div>
              <div className="h-3 bg-purple-500 w-[90%] mt-1"></div>
            </div>
          </div>
        </div>

        {/* 7. KPI Kartları */}
        <div className="grid grid-rows-2 gap-4 lg:col-span-1">
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col items-center justify-center">
            <p className="text-5xl font-bold text-brand-navy">14</p>
            <p className="text-xs text-slate-500 font-medium mt-2">Aktif Kullanıcı Sayısı</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col items-center justify-center">
            <p className="text-5xl font-bold text-brand-navy">1</p>
            <p className="text-xs text-slate-500 font-medium mt-2">Pasif Kullanıcı Sayısı</p>
          </div>
        </div>

      </div>
    </div>
  );
}