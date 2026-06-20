// src/pages/Planning.tsx
import { useState, useEffect } from 'react';
import api from '../services/api';


interface PeriodicOrder {
  id: string;
  customerName: string;
  title: string;
  workType: string;
  recurrenceInterval: string;
  priority: string;
  isPeriodic?: boolean; // 💡 TypeScript'in filtreleme sırasında hata vermemesi için ekledik
}

export default function Planning() {
  const [periodicJobs, setPeriodicJobs] = useState<PeriodicOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
  const fetchPeriodics = async () => {
    try {
      const response = await api.get('/workorders');
      
      // 💡 ÇÖZÜM: any yerine güçlü tipleme olan "PeriodicOrder" karşılığını verdik
      const filtered = response.data.filter((o: PeriodicOrder) => o.isPeriodic === true || o.recurrenceInterval !== 'None');
      setPeriodicJobs(filtered);
    } catch (error) {
      console.error("Periyodik planlar çekilemedi:", error);
    } finally {
      setIsLoading(false);
    }
  };
  fetchPeriodics();
}, []);

  return (
    <div className="absolute inset-0 z-20 bg-slate-50 p-6 overflow-y-auto w-full h-full pointer-events-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-brand-navy">🗓️ Periyodik İş Planlama ve Şablon Otomasyonu</h1>
        <p className="text-xs text-slate-400 mt-1 font-semibold">Sistem tarafından otomatik tetiklenecek saha iş döngüleri takvimi</p>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        {isLoading ? (
          <p className="text-xs font-bold text-slate-400">Döngüler yükleniyor...</p>
        ) : periodicJobs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm font-medium">📭 Sistemde henüz tanımlı aktif bir periyodik iş emri döngüsü bulunmuyor.</p>
            <p className="text-xs text-slate-400 mt-1">İş emri ekleme panelinden yeni bir periyodik döngü başlatabilirsiniz.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-brand-navy uppercase tracking-wider border-b pb-2 text-slate-500">Aktif Tekrarlanan Görev Listesi</h3>
            {periodicJobs.map((job) => (
              <div key={job.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center hover:border-brand-orange transition">
                <div className="space-y-1">
                  <h4 className="font-bold text-brand-navy text-sm">📍 {job.customerName}</h4>
                  <p className="text-slate-500 text-xs font-medium">{job.title} | Tip: <span className="font-bold text-slate-700">{job.workType}</span></p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full uppercase tracking-wide">
                    🔄 {job.recurrenceInterval || 'Haftalik'}
                  </span>
                  <span className="text-[10px] bg-white border font-bold px-2 py-0.5 rounded shadow-sm text-slate-600">{job.priority}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}