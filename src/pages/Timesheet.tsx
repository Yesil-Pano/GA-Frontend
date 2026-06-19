// ga-frontend/src/pages/Timesheet.tsx
import { useState } from 'react';

// İleride veritabanından gelecek örnek (Mock) veri yapısı
const MOCK_API_DATA: Record<string, { type: string, count: number, colorClass: string }[]> = {
  '2026-06-03': [
    { type: 'Orta', count: 132, colorClass: 'text-lime-600 border-lime-400 bg-lime-50' },
    { type: 'Acil', count: 3, colorClass: 'text-rose-600 border-rose-400 bg-rose-50' }
  ],
  '2026-06-16': [
    { type: 'Orta', count: 118, colorClass: 'text-lime-600 border-lime-400 bg-lime-50' },
    { type: 'Acil', count: 6, colorClass: 'text-rose-600 border-rose-400 bg-rose-50' }
  ],
  '2026-06-19': [
    { type: 'Orta', count: 102, colorClass: 'text-lime-600 border-lime-400 bg-lime-50' },
    { type: 'Düşük', count: 10, colorClass: 'text-emerald-600 border-emerald-400 bg-emerald-50' }
  ],
};

const TEAM_MEMBERS = ['Yasin Özdağ', 'Hasan Güney', 'Seyfullah Sever', 'Gökhan Onay', 'Eyüp Kurt', 'Soner Yalçın', 'Yılmaz Binen'];

export default function Timesheet() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // ÇÖZÜM 1: Şimdilik kullanılmadığı için 'setCurrentDate' tanımlamasını kaldırdık.
  const [currentDate] = useState(new Date(2026, 5, 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const firstDayIndex = new Date(year, month, 1).getDay();
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 

  const daysOfWeek = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  
  const calendarCells = [];
  for (let i = 0; i < startOffset; i++) {
    calendarCells.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push(i);
  }

  const formatDateKey = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        
        <div className="flex items-center gap-3 relative">
          {/* ÇÖZÜM 2: Butona 'title' ve 'aria-label' özellikleri eklendi */}
          <button 
            title="Filtreleme Seçenekleri" 
            aria-label="Filtreleme Seçenekleri"
            className="p-2 border border-blue-200 text-blue-500 rounded-lg hover:bg-blue-50 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
          </button>

          <div className="relative">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center justify-between w-64 px-4 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-sm text-slate-700 hover:border-blue-400 focus:outline-none"
            >
              Ekip Seçiniz
              <span className="text-slate-400">▼</span>
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-slate-100 border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                {TEAM_MEMBERS.map((member, idx) => (
                  <label key={idx} className="flex items-center px-4 py-2.5 cursor-pointer hover:bg-slate-200 border-b border-slate-200/50 last:border-0 transition text-sm text-slate-600">
                    <input type="checkbox" className="w-4 h-4 mr-3 rounded border-slate-400 text-blue-600 focus:ring-blue-500" />
                    {member}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button className="px-4 py-1.5 border border-blue-500 text-blue-600 font-medium rounded-lg hover:bg-blue-50 text-sm transition">Bugün</button>
          <div className="flex items-center gap-4 text-lg font-bold text-slate-800">
            {/* ÇÖZÜM 2: Oklara title ve aria-label eklendi */}
            <button title="Önceki Ay" aria-label="Önceki Ay" className="hover:text-blue-600 transition">&lt;</button>
            <span className="w-32 text-center">Haziran 2026</span>
            <button title="Sonraki Ay" aria-label="Sonraki Ay" className="hover:text-blue-600 transition">&gt;</button>
          </div>
        </div>

        <div className="flex items-center text-sm font-medium text-slate-500">
          <button className="px-3 hover:text-blue-600 transition">Gün</button>
          <button className="px-3 hover:text-blue-600 transition">Hafta</button>
          <button className="px-3 text-blue-600 border-b-2 border-blue-600 pb-1">Ay</button>
        </div>
      </div>

      <div className="flex items-center gap-6 px-6 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700 bg-slate-50/50">
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-lime-500"></span>Orta - 526</div>
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>Düşük - 10</div>
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>Acil - 36</div>
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>Tümü - 572</div>
      </div>

      <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-white">
          {daysOfWeek.map((day, idx) => (
            <div key={idx} className="py-3 text-center text-sm font-bold text-slate-600">
              {day}
            </div>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-px bg-slate-200">
          {calendarCells.map((day, idx) => {
            const isToday = day === 19; 
            const dateKey = day ? formatDateKey(day) : '';
            const dayEvents = day ? MOCK_API_DATA[dateKey] || [] : [];

            return (
              <div key={idx} className={`bg-white p-2 flex flex-col transition hover:bg-slate-50 ${isToday ? 'bg-emerald-50/60' : ''}`}>
                {day && (
                  <span className={`text-base mb-1 ${isToday ? 'font-bold text-emerald-700 text-xl' : 'text-slate-400 font-medium'}`}>
                    {day}
                  </span>
                )}
                <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1">
                  {dayEvents.map((ev, i) => (
                    <div key={i} className={`flex items-center justify-between px-2 py-0.5 border rounded-full text-[11px] font-bold ${ev.colorClass}`}>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${ev.colorClass.split(' ')[0].replace('text-', 'bg-')}`}></span>
                        {ev.type}
                      </div>
                      <span>{ev.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}