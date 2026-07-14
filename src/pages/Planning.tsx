// src/pages/Planning.tsx
import { useState, useEffect } from 'react';
import api from '../services/api';

interface PeriodicOrder {
  id: string;
  customerName: string;
  title: string;
  type?: string;
  workType?: string;
  recurrenceInterval: string;
  priority: string;
  isPeriodic?: boolean;
  nextExecutionDate?: string | null;
  status?: string;
  assignedToUserName?: string;
}

const intervalLabel = (value?: string) => {
  const v = (value || '').toLowerCase();
  if (v === 'haftalik' || v === 'weekly') return 'Haftalık';
  if (v === 'aylik' || v === 'monthly') return 'Aylık';
  if (v === 'yillik' || v === 'yearly') return 'Yıllık';
  return value || 'Aylık';
};

export default function Planning() {
  const [periodicJobs, setPeriodicJobs] = useState<PeriodicOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPeriodics = async () => {
      try {
        const response = await api.get('/workorders');
        const filtered = response.data.filter(
          (o: PeriodicOrder) => o.isPeriodic === true || (o.recurrenceInterval && o.recurrenceInterval !== 'None')
        );
        setPeriodicJobs(filtered);
      } catch (error) {
        console.error('Periyodik planlar çekilemedi:', error);
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
        <p className="text-xs text-slate-400 mt-1 font-semibold">
          Periyodik işaretlenen kayıtlar şablon olarak tutulur. <code className="text-slate-500">NextExecutionDate</code> geldiğinde
          arka plan servisi (~15 dk) aynı içerikle yeni iş emri açar ve sonraki plan tarihini otomatik ileri alır.
        </p>
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
            <h3 className="text-xs font-bold text-brand-navy uppercase tracking-wider border-b pb-2 text-slate-500">
              Aktif Tekrarlanan Görev Listesi ({periodicJobs.length})
            </h3>
            {periodicJobs.map((job) => (
              <div
                key={job.id}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center hover:border-brand-orange transition gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <h4 className="font-bold text-brand-navy text-sm truncate">📍 {job.customerName}</h4>
                  <p className="text-slate-500 text-xs font-medium truncate">
                    {job.title} | Tip:{' '}
                    <span className="font-bold text-slate-700">{job.type || job.workType || '-'}</span>
                    {job.assignedToUserName ? (
                      <>
                        {' '}
                        | Atanan: <span className="font-bold text-slate-700">{job.assignedToUserName}</span>
                      </>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-semibold">
                    Sonraki otomatik açılış:{' '}
                    {job.nextExecutionDate || 'Hesaplanmadı'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full uppercase tracking-wide">
                    🔄 {intervalLabel(job.recurrenceInterval)}
                  </span>
                  <span className="text-[10px] bg-white border font-bold px-2 py-0.5 rounded shadow-sm text-slate-600">
                    {job.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
