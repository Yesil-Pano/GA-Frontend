// src/pages/Timesheet.tsx
import { useState, useEffect } from 'react';
import api from '../services/api';

// --- GÜÇLÜ TİP SÖZLEŞMELERİ (INTERFACE) ---
interface CalendarWorkOrder {
  id: string;
  title: string;
  customerName: string;
  priority: string;
  status: string;
  startDate: string;
  endDate: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
}

interface BackendWorkOrderForCalendar {
  id: string;
  title: string;
  customerName: string;
  priority?: string;
  status?: string;
  startDate?: string;
  plannedDate?: string;
  endDate?: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
}

interface PersonnelLookup {
  id: string;
  fullName: string;
}

interface LookupData {
  personnel: PersonnelLookup[];
  types: string[];
  categories: string[];
}

export default function Timesheet() {
  // Zaman ve Görünüm Kontrolleri
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<'Month' | 'Week' | 'Day'>('Month');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('Tümü');

  // Canlı Veri Havuzları
  const [orders, setOrders] = useState<CalendarWorkOrder[]>([]);
  const [lookups, setLookups] = useState<LookupData>({ personnel: [], types: [], categories: [] });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form Çekmecesi Kontrolleri
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    title: '', customerName: '', description: '', mobileDescription: '', address: '',
    priority: 'Orta', workType: 'Arıza', workCategory: 'Arıza Bildirimi',
    startDate: '', endDate: '', lat: 39.92, lng: 32.85,
    operationUserId: '', openedByUserId: '', assignedToUserId: '',
    isPeriodic: false, recurrenceInterval: 'Haftalik',
  });

  // BİRLEŞİK CANLI MOTOR
  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const [ordersRes, lookupsRes] = await Promise.all([
          api.get('/workorders'),
          api.get('/workorders/lookups')
        ]);

        if (isMounted) {
          const rawOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
          const typedOrders = rawOrders.map((w: BackendWorkOrderForCalendar) => ({
            id: w.id,
            title: w.title,
            customerName: w.customerName,
            priority: w.priority || 'Orta',
            status: w.status || 'Bekliyor',
            startDate: w.startDate || w.plannedDate || '',
            endDate: w.endDate || '',
            assignedToUserId: w.assignedToUserId,
            assignedToUserName: w.assignedToUserName
          }));

          setOrders(typedOrders);

          const backendData = lookupsRes.data || {};
          const mappedPersonnel = backendData.teams
            ? backendData.teams.map((t: { id: string; name: string }) => ({ id: t.id, fullName: t.name }))
            : (backendData.personnel ?? []);

          const normalizedLookups: LookupData = {
            personnel: mappedPersonnel,
            types: backendData.types ?? ['Arıza', 'Bakım', 'Kurulum', 'Keşif', 'Saha Operasyonu'],
            categories: backendData.categories ?? ['Arıza Bildirimi', 'Periyodik Bakım', 'Devreye Alma', 'Altyapı İncelemesi'],
          };
          setLookups(normalizedLookups);

          if (mappedPersonnel.length > 0) {
            setFormData(prev => ({
              ...prev,
              operationUserId: mappedPersonnel[0].id,
              openedByUserId: mappedPersonnel[0].id,
              assignedToUserId: mappedPersonnel[0].id,
            }));
          }
        }
      } catch (error) {
        console.error("Takvim verileri yüklenemedi:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  // SÜZGEÇTEN GEÇEN İŞ EMİRLERİ
  const filteredOrders = orders.filter(o => {
    if (selectedTeamId === 'Tümü') return true;
    return o.assignedToUserId === selectedTeamId;
  });

  // ZAMAN MATEMATİĞİ MOTORU
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const dayNames = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (view === 'Month') newDate.setMonth(newDate.getMonth() - 1);
    else if (view === 'Week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'Month') newDate.setMonth(newDate.getMonth() + 1);
    else if (view === 'Week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const generateMonthDays = () => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const matrixCells = [];

    for (let i = startOffset; i > 0; i--) {
      matrixCells.push({
        date: new Date(year, month - 1, daysInPrevMonth - i + 1),
        isCurrentMonth: false
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      matrixCells.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    const remainingGridSize = 42 - matrixCells.length;
    for (let i = 1; i <= remainingGridSize; i++) {
      matrixCells.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return matrixCells;
  };

  const generateWeekDays = () => {
    const currentDay = currentDate.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(currentDate);
    monday.setDate(currentDate.getDate() + distanceToMonday);

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      weekDays.push(nextDay);
    }
    return weekDays;
  };

  const getDayOrderStats = (date: Date) => {
    const dateStr = date.toDateString();
    const dayOrders = filteredOrders.filter(o => new Date(o.startDate).toDateString() === dateStr);
    
    return {
      orta: dayOrders.filter(o => o.priority === 'Orta').length,
      dusuk: dayOrders.filter(o => o.priority === 'Düşük').length,
      acil: dayOrders.filter(o => o.priority === 'Acil').length,
      total: dayOrders.length
    };
  };

  const getViewTimeBoundaries = () => {
    if (view === 'Month') {
      return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0, 23, 59) };
    } else if (view === 'Week') {
      const week = generateWeekDays();
      return { start: week[0], end: new Date(week[6].setHours(23, 59)) };
    } else {
      const start = new Date(currentDate); start.setHours(0,0,0,0);
      const end = new Date(currentDate); end.setHours(23,59,59,999);
      return { start, end };
    }
  };

  const boundaries = getViewTimeBoundaries();
  const timeBoundedOrders = filteredOrders.filter(o => {
    const oDate = new Date(o.startDate);
    return oDate >= boundaries.start && oDate <= boundaries.end;
  });

  const kpiOrta = timeBoundedOrders.filter(o => o.priority === 'Orta').length;
  const kpiDusuk = timeBoundedOrders.filter(o => o.priority === 'Düşük').length;
  const kpiAcil = timeBoundedOrders.filter(o => o.priority === 'Acil').length;
  const kpiTumi = timeBoundedOrders.length;

  const handleDayClick = (date: Date) => {
    const localYear = date.getFullYear();
    const localMonth = String(date.getMonth() + 1).padStart(2, '0');
    const localDay = String(date.getDate()).padStart(2, '0');
    const formattedDate = `${localYear}-${localMonth}-${localDay}T09:00`;

    setFormData(prev => ({
      ...prev,
      startDate: formattedDate,
      endDate: `${localYear}-${localMonth}-${localDay}T18:00`
    }));
    setIsDrawerOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.post('/workorders', {
        title: formData.title, customerName: formData.customerName, description: formData.description,
        mobileDescription: formData.mobileDescription, address: formData.address, priority: formData.priority,
        type: formData.workType, category: formData.workCategory,
        startDate: new Date(formData.startDate).toISOString(), endDate: new Date(formData.endDate).toISOString(),
        latitude: Number(formData.lat), longitude: Number(formData.lng),
        operationUserId: formData.operationUserId || null, openedByUserId: formData.openedByUserId || null,
        assignedToUserId: formData.assignedToUserId || null,
        isPeriodic: formData.isPeriodic,
        recurrenceInterval: formData.isPeriodic ? formData.recurrenceInterval : 'None',
      });
      setIsDrawerOpen(false);
      setFormData((prev) => ({ ...prev, isPeriodic: false, recurrenceInterval: 'Haftalik' }));
      
      const response = await api.get('/workorders');
      const rawOrders = Array.isArray(response.data) ? response.data : [];
      const refreshedOrders = rawOrders.map((w: BackendWorkOrderForCalendar) => ({
        id: w.id, title: w.title, customerName: w.customerName, priority: w.priority || 'Orta', status: w.status || 'Bekliyor',
        startDate: w.startDate || w.plannedDate || '', endDate: w.endDate || '', assignedToUserId: w.assignedToUserId, assignedToUserName: w.assignedToUserName
      }));
      setOrders(refreshedOrders);
    } catch (error) {
      console.error(error);
      alert("İş emri takvim üzerinden planlanamadı.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🚀 REVIZYON: Linter uyarısına sebep olan isLoading değişkeni burada şık bir spinner ekranına bağlandı!
  if (isLoading) {
    return (
      <div className="absolute inset-0 z-20 bg-slate-50 flex flex-col items-center justify-center space-y-3">
        <svg className="animate-spin h-8 w-7 text-brand-orange" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-xs font-bold text-slate-400 tracking-wide animate-pulse">Zaman Çizelgesi Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 bg-slate-50 p-6 overflow-y-auto w-full h-full pointer-events-auto flex flex-col font-sans select-none">
      
      {/* ÜST KOKPİT */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4 shrink-0 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-50 border rounded-lg text-slate-500 shadow-inner">🔍</div>
          <select 
            value={selectedTeamId} 
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="border border-slate-300 rounded-lg p-2.5 bg-white text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-orange min-w-50"
          >
            <option value="Tümü">Tüm Ekipleri Göster</option>
            {lookups.personnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={handleToday} className="px-5 py-2 border border-blue-500 text-blue-500 hover:bg-blue-50 text-xs font-bold rounded-lg transition shadow-sm">Bugün</button>
          <div className="flex items-center gap-2">
            <button onClick={handlePrev} className="p-2 border rounded-lg bg-white hover:bg-slate-50 font-bold text-xs shadow-sm">‹</button>
            <h2 className="text-base font-extrabold text-brand-navy min-w-35 text-center uppercase tracking-wide">
              {view === 'Month' ? `${monthNames[month]} ${year}` : view === 'Week' ? `${monthNames[month]} ${year}` : currentDate.toLocaleDateString('tr-TR')}
            </h2>
            <button onClick={handleNext} className="p-2 border rounded-lg bg-white hover:bg-slate-50 font-bold text-xs shadow-sm">›</button>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border shadow-inner text-xs font-bold text-slate-600">
          {(['Month', 'Week', 'Day'] as const).map((v) => (
            <button 
              key={v} onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg transition-all ${view === v ? 'bg-white text-brand-navy shadow-md' : 'hover:text-brand-navy'}`}
            >
              {v === 'Month' ? 'Ay' : v === 'Week' ? 'Hafta' : 'Gün'}
            </button>
          ))}
        </div>
      </div>

      {/* SAYAÇ SIRA ALANI */}
      <div className="flex gap-4 text-xs font-extrabold mb-4 shrink-0 px-2 flex-wrap">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-3.5 bg-lime-500 rounded"></span><span className="text-slate-500">Orta -</span><span className="text-slate-800">{kpiOrta}</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-3.5 bg-emerald-500 rounded"></span><span className="text-slate-500">Düşük -</span><span className="text-slate-800">{kpiDusuk}</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-3.5 bg-rose-500 rounded"></span><span className="text-slate-500">Acil -</span><span className="text-slate-800">{kpiAcil}</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-3.5 bg-blue-500 rounded"></span><span className="text-slate-500">Tümü -</span><span className="text-slate-800">{kpiTumi}</span></div>
      </div>

      {/* ANA TAKVİM GRID ALANI */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col overflow-hidden min-h-125">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center py-3 text-xs font-extrabold text-brand-navy shrink-0">
          {dayNames.map(d => <div key={d}>{d}</div>)}
        </div>

        {view === 'Month' && (
          <div className="flex-1 grid grid-cols-7 grid-rows-6 divide-x divide-y divide-slate-100 bg-slate-100/30">
            {generateMonthDays().map((cell, index) => {
              const stats = getDayOrderStats(cell.date);
              const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;
              const isToday = cell.date.toDateString() === new Date().toDateString();

              return (
                <div 
                  key={index} onClick={() => handleDayClick(cell.date)}
                  className={`bg-white p-2 flex flex-col justify-between transition-all hover:bg-blue-50/50 cursor-pointer ${
                    !cell.isCurrentMonth ? 'opacity-30 pointer-events-none bg-slate-50/50' : ''
                  } ${isWeekend && cell.isCurrentMonth ? 'bg-rose-50/30' : ''}`}
                >
                  <span className={`text-xs font-extrabold h-6 w-6 flex items-center justify-center rounded-full self-start ${
                    isToday ? 'bg-emerald-600 text-white shadow' : 'text-slate-700'
                  }`}>
                    {cell.date.getDate()}
                  </span>

                  <div className="space-y-1 mt-1 text-[10px] font-bold">
                    {stats.orta > 0 && <div className="bg-lime-50 text-lime-800 border border-lime-200 rounded px-1.5 py-0.5 flex justify-between"><span>Orta</span><span>{stats.orta}</span></div>}
                    {stats.dusuk > 0 && <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded px-1.5 py-0.5 flex justify-between"><span>Düşük</span><span>{stats.dusuk}</span></div>}
                    {stats.acil > 0 && <div className="bg-rose-50 text-rose-800 border border-rose-200 rounded px-1.5 py-0.5 flex justify-between"><span>Acil</span><span>{stats.acil}</span></div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === 'Week' && (
          <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100 h-full">
            {generateWeekDays().map((day, idx) => {
              const stats = getDayOrderStats(day);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isToday = day.toDateString() === new Date().toDateString();

              return (
                <div 
                  key={idx} onClick={() => handleDayClick(day)}
                  className={`p-4 flex flex-col justify-between bg-white hover:bg-blue-50/30 cursor-pointer ${isWeekend ? 'bg-rose-50/30' : ''}`}
                >
                  <div className="text-center border-b pb-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{dayNames[idx].slice(0,3)}</p>
                    <p className={`text-base font-extrabold mt-1 h-8 w-8 inline-flex items-center justify-center rounded-full ${isToday ? 'bg-emerald-600 text-white' : 'text-slate-800'}`}>{day.getDate()}</p>
                  </div>
                  <div className="space-y-2 flex-1 pt-4 text-xs font-bold">
                    {stats.orta > 0 && <div className="bg-lime-50 text-lime-800 p-2 rounded-lg border border-lime-100 flex justify-between"><span>🟡 Orta Öncelik</span><span>{stats.orta} İş</span></div>}
                    {stats.dusuk > 0 && <div className="bg-emerald-50 text-emerald-800 p-2 rounded-lg border border-emerald-100 flex justify-between"><span>🟢 Düşük Öncelik</span><span>{stats.dusuk} İş</span></div>}
                    {stats.acil > 0 && <div className="bg-rose-50 text-rose-800 p-2 rounded-lg border border-rose-100 flex justify-between"><span>🔴 Acil Öncelik</span><span>{stats.acil} İş</span></div>}
                    {stats.total === 0 && <p className="text-center text-slate-300 text-[11px] font-medium pt-12">Planlı İş Yok</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === 'Day' && (
          <div className="flex-1 p-6 bg-slate-50/50 flex flex-col justify-center items-center">
            <div className="bg-white p-6 rounded-2xl border shadow-sm w-full max-w-md space-y-4">
              <div className="text-center border-b pb-3">
                <h3 className="text-lg font-extrabold text-brand-navy">{currentDate.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Günlük Operasyon Detayı</p>
              </div>
              {(() => {
                const stats = getDayOrderStats(currentDate);
                return (
                  <div className="space-y-2 font-bold text-xs">
                    <div className="flex justify-between items-center p-3 bg-lime-50 border border-lime-100 rounded-xl text-lime-900"><span>🟡 Orta Seviye Aktif Görevler</span><span>{stats.orta} Adet</span></div>
                    <div className="flex justify-between items-center p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-900"><span>🟢 Düşük Seviye Takip İşleri</span><span>{stats.dusuk} Adet</span></div>
                    <div className="flex justify-between items-center p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-900"><span>🔴 Acil Kapatılması Gerekenler</span><span>{stats.acil} Adet</span></div>
                    <div className="pt-3 border-t flex justify-between text-sm font-extrabold text-brand-navy"><span>📋 Toplam Sevk Edilen İş</span><span>{stats.total} Görev</span></div>
                    <button type="button" onClick={() => handleDayClick(currentDate)} className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition text-center shadow shadow-blue-200">+ Bu Güne Yeni İş Emri Planla</button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* SAĞDAN KAYAN İŞ EMİR PLANLAMA ÇEKMECESİ */}
      <div className={`fixed top-20 right-0 bottom-0 bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.15)] border-l border-slate-200 transition-transform duration-300 z-40 flex flex-col ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: '450px' }}>
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2"><span className="text-blue-600 font-bold">Takvim Planlama</span><span className="text-slate-400">›</span><span className="font-bold text-brand-navy text-sm">Hızlı İş Ekle</span></div>
          <button type="button" onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl px-2">×</button>
        </div>
        
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-sm pb-12">
          <div><label className="block text-xs font-bold text-slate-700 mb-1">İş Tipi</label><select className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50" value={formData.workType} onChange={e => setFormData({...formData, workType: e.target.value})}>{lookups.types.map((t, idx) => <option key={idx}>{t}</option>)}</select></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">İş Kategorisi</label><select className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50" value={formData.workCategory} onChange={e => setFormData({...formData, workCategory: e.target.value})}>{lookups.categories.map((c, idx) => <option key={idx}>{c}</option>)}</select></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">İş Öncelik Tipi</label><select className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}><option>Düşük</option><option>Orta</option><option>Acil</option></select></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">Başlık / İş Özeti</label><input required className="w-full border border-slate-300 rounded-lg p-2.5" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">Müşteri / Pano Adı</label><input required className="w-full border border-slate-300 rounded-lg p-2.5" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} /></div>
          
          <div className="flex gap-4">
            <div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">Planlanan Başlangıç (Kilitli)</label><input type="datetime-local" readOnly className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-100 text-slate-500 font-bold cursor-not-allowed outline-none" value={formData.startDate} /></div>
            <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Planlanan Bitiş</label><input type="datetime-local" className="w-full border border-slate-300 rounded-lg p-2.5" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} /></div>
          </div>
          <div className="flex gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Enlem (Lat)</label><input type="number" step="any" required className="w-full border border-slate-300 rounded-lg p-2 bg-white" value={formData.lat} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})} /></div>
            <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Boylam (Lng)</label><input type="number" step="any" required className="w-full border border-slate-300 rounded-lg p-2 bg-white" value={formData.lng} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value)})} /></div>
          </div>
          <div><label className="block text-xs font-bold text-slate-600 mb-1">Genel Açıklama</label><textarea className="w-full border border-slate-300 rounded-lg p-2.5" rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-600 mb-1">Mühendis Açıklaması</label><textarea className="w-full border border-slate-300 rounded-lg p-2.5" rows={2} value={formData.mobileDescription} onChange={e => setFormData({...formData, mobileDescription: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-600 mb-1">Tam Açık Adres</label><textarea required className="w-full border border-slate-300 rounded-lg p-2.5" rows={2} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>

          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 space-y-3">
            <label className="flex items-center gap-2 font-bold text-emerald-800 text-xs cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                checked={formData.isPeriodic}
                onChange={e => setFormData({ ...formData, isPeriodic: e.target.checked })}
              />
              <span>Bu Bir Periyodik İş Emridir (Otomatik Tekrarlansın)</span>
            </label>
            {formData.isPeriodic && (
              <div>
                <label className="block text-[11px] font-bold text-emerald-700 mb-1">Tekrarlanma Döngüsü Sıklığı</label>
                <select
                  className="w-full border border-emerald-200 rounded-lg p-2 bg-white text-xs font-semibold text-slate-700"
                  value={formData.recurrenceInterval}
                  onChange={e => setFormData({ ...formData, recurrenceInterval: e.target.value })}
                >
                  <option value="Haftalik">Her Hafta Otomatik Açılsın</option>
                  <option value="Aylik">Her Ay Otomatik Açılsın</option>
                  <option value="Yillik">Her Yıl Otomatik Açılsın</option>
                </select>
                <p className="text-[10px] text-emerald-700/80 mt-1 font-medium">
                  Periyodik kayıt Planning sayfasında listelenir. Sonraki plan tarihinde sistem otomatik olarak yeni iş emri üretir.
                </p>
              </div>
            )}
          </div>
          
          <div className="space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Operasyon Atamaları</h4>
            <div><label className="block text-[11px] font-bold text-slate-600 mb-1">Operasyon Sorumlusu</label><select className="w-full border border-slate-300 rounded-lg p-2 bg-white" value={formData.operationUserId} onChange={e => setFormData({...formData, operationUserId: e.target.value})}>{lookups.personnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></div>
            <div><label className="block text-[11px] font-bold text-slate-600 mb-1">İş Açan Yetkili</label><select className="w-full border border-slate-300 rounded-lg p-2 bg-white" value={formData.openedByUserId} onChange={e => setFormData({...formData, openedByUserId: e.target.value})}>{lookups.personnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></div>
            <div><label className="block text-[11px] font-bold text-slate-600 mb-1">İş Atanan Sahacı</label><select className="w-full border border-slate-300 rounded-lg p-2 bg-white" value={formData.assignedToUserId} onChange={e => setFormData({...formData, assignedToUserId: e.target.value})}>{lookups.personnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></div>
          </div>
          <div className="flex gap-3 pt-4 border-t">
            <button type="button" onClick={() => setIsDrawerOpen(false)} className="flex-1 border border-slate-300 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-50 transition">İptal</button>
            <button type="submit" disabled={isSubmitting} className={`flex-1 flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl shadow-md transition ${isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Planlanıyor...</span>
                </>
              ) : (
                <span>✓ İş Emrini Planla</span>
              )}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}