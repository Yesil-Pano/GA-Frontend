// src/pages/Reports.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

interface PersonnelOption {
  id: string;
  name: string;
}

interface CityOption {
  id: string;
  name: string;
}

interface DistrictOption {
  id: string;
  name: string;
  cityId: string;
}

interface ReportRow {
  id: string;
  title: string;
  customerName: string;
  category: string;
  type: string;
  priority: string;
  status: string;
  description: string;
  mobileDescription: string;
  address: string;
  startDate: string;
  endDate: string;
  openedByUserName: string;
  assignedToUserName: string;
  cityName?: string | null;
  districtName?: string | null;
  assignmentLabel: string;
}

const WORK_CATEGORIES = [
  'Arıza Bildirimi',
  'YG İşletme Sorumluluğu Talebi',
  'YG Bakım',
  'AG Bakım',
  'Kapasitif Ceza',
  'QR, Etiket ve Görsel Kontrol',
  'Duba, Stopper ve Çevre Kontrol',
];

const PRIORITIES = ['Düşük', 'Orta', 'Acil'];

const COMPLETION_TYPES = [
  'Tamamlandı',
  'İptal Edildi',
  'Bekliyor',
  'Devam Ediyor',
  'Atanmamış',
  'Atanmış',
];

const emptyFilters = {
  category: '',
  priority: '',
  completionType: '',
  openedByUserId: '',
  assignedToUserId: '',
  cityId: '',
  districtId: '',
  startFrom: '',
  startTo: '',
  search: '',
};

export default function Reports() {
  const [filters, setFilters] = useState(emptyFilters);
  const [personnel, setPersonnel] = useState<PersonnelOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, pageSize };
    if (filters.category) params.category = filters.category;
    if (filters.priority) params.priority = filters.priority;
    if (filters.completionType) params.completionType = filters.completionType;
    if (filters.openedByUserId) params.openedByUserId = filters.openedByUserId;
    if (filters.assignedToUserId) params.assignedToUserId = filters.assignedToUserId;
    if (filters.cityId) params.cityId = filters.cityId;
    if (filters.districtId) params.districtId = filters.districtId;
    if (filters.startFrom) params.startFrom = new Date(filters.startFrom).toISOString();
    if (filters.startTo) params.startTo = new Date(filters.startTo).toISOString();
    if (filters.search.trim()) params.search = filters.search.trim();
    return params;
  }, [filters, page, pageSize]);

  useEffect(() => {
    let cancelled = false;
    const loadLookups = async () => {
      try {
        const [lookupsRes, citiesRes] = await Promise.all([
          api.get('/workorders/lookups'),
          api.get('/geo/cities'),
        ]);
        if (cancelled) return;
        const teams = lookupsRes.data?.teams || [];
        setPersonnel(teams.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
        setCities(citiesRes.data || []);
      } catch (error) {
        console.error('Rapor lookup yüklenemedi:', error);
      }
    };
    loadLookups();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadDistricts = async () => {
      if (!filters.cityId) {
        setDistricts([]);
        return;
      }
      try {
        const { data } = await api.get('/geo/districts', { params: { cityId: filters.cityId } });
        if (!cancelled) setDistricts(data || []);
      } catch (error) {
        console.error('İlçeler yüklenemedi:', error);
        if (!cancelled) setDistricts([]);
      }
    };
    loadDistricts();
    return () => { cancelled = true; };
  }, [filters.cityId]);

  const fetchReport = useCallback(async (nextPage = page) => {
    setLoading(true);
    setHasSearched(true);
    try {
      const { data } = await api.get('/reports/work-orders', {
        params: { ...queryParams, page: nextPage },
      });
      setRows(data.items || []);
      setTotal(data.total || 0);
      setPage(data.page || nextPage);
    } catch (error) {
      console.error('Rapor alınamadı:', error);
      alert('Rapor verileri alınamadı.');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, queryParams]);

  const handleFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    await fetchReport(1);
  };

  const handleClear = () => {
    setFilters(emptyFilters);
    setDistricts([]);
    setRows([]);
    setTotal(0);
    setPage(1);
    setHasSearched(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (filters.category) params.category = filters.category;
      if (filters.priority) params.priority = filters.priority;
      if (filters.completionType) params.completionType = filters.completionType;
      if (filters.openedByUserId) params.openedByUserId = filters.openedByUserId;
      if (filters.assignedToUserId) params.assignedToUserId = filters.assignedToUserId;
      if (filters.cityId) params.cityId = filters.cityId;
      if (filters.districtId) params.districtId = filters.districtId;
      if (filters.startFrom) params.startFrom = new Date(filters.startFrom).toISOString();
      if (filters.startTo) params.startTo = new Date(filters.startTo).toISOString();
      if (filters.search.trim()) params.search = filters.search.trim();

      const { data } = await api.get('/reports/work-orders/export', {
        params,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `is-emri-raporu-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Excel indirme hatası:', error);
      alert('Rapor indirilemedi.');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fieldClass =
    'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange';
  const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1';

  return (
    <div className="min-h-full space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-navy">Raporlama</h1>
        <p className="text-sm text-slate-500 mt-1 font-medium">
          İş emirlerini kategori, personel, il/ilçe ve tarih filtreleriyle listeleyin; Excel (.xlsx) indirin.
        </p>
      </div>

      <form onSubmit={handleFilter} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>İş Kategorisi</label>
            <select className={fieldClass} value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
              <option value="">Tümü</option>
              {WORK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>İş Öncelik Tipi</label>
            <select className={fieldClass} value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
              <option value="">Tümü</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>İş Tamamlama / Atama</label>
            <select className={fieldClass} value={filters.completionType} onChange={(e) => setFilters({ ...filters, completionType: e.target.value })}>
              <option value="">Tümü</option>
              {COMPLETION_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Metin Arama</label>
            <input className={fieldClass} placeholder="Nokta, açıklama, adres..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>İşi Açan</label>
            <select className={fieldClass} value={filters.openedByUserId} onChange={(e) => setFilters({ ...filters, openedByUserId: e.target.value })}>
              <option value="">Tümü</option>
              {personnel.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>İş Atanan</label>
            <select className={fieldClass} value={filters.assignedToUserId} onChange={(e) => setFilters({ ...filters, assignedToUserId: e.target.value })}>
              <option value="">Tümü</option>
              {personnel.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>İl</label>
            <select
              className={fieldClass}
              value={filters.cityId}
              onChange={(e) => setFilters({ ...filters, cityId: e.target.value, districtId: '' })}
            >
              <option value="">Tümü</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>İlçe</label>
            <select
              className={fieldClass}
              value={filters.districtId}
              onChange={(e) => setFilters({ ...filters, districtId: e.target.value })}
              disabled={!filters.cityId}
            >
              <option value="">{filters.cityId ? 'Tümü' : 'Önce il seçin'}</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
          <div>
            <label className={labelClass}>Başlangıç (From)</label>
            <input type="datetime-local" className={fieldClass} value={filters.startFrom} onChange={(e) => setFilters({ ...filters, startFrom: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Başlangıç (To)</label>
            <input type="datetime-local" className={fieldClass} value={filters.startTo} onChange={(e) => setFilters({ ...filters, startTo: e.target.value })} />
          </div>
          <div className="xl:col-span-2 flex flex-wrap gap-2 justify-end">
            <button type="button" onClick={handleClear} className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50">
              Temizle
            </button>
            <button type="button" onClick={handleExport} disabled={exporting} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-60">
              {exporting ? 'İndiriliyor...' : 'Excel İndir (.xlsx)'}
            </button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-60">
              {loading ? 'Filtreleniyor...' : 'Raporu Getir'}
            </button>
          </div>
        </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <h2 className="font-bold text-brand-navy text-sm">Sonuçlar</h2>
          <span className="text-xs font-semibold text-slate-500">
            {hasSearched ? `${total} kayıt` : 'Filtre seçip “Raporu Getir”e basın'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Nokta</th>
                <th className="px-4 py-3 font-bold">Kategori</th>
                <th className="px-4 py-3 font-bold">Öncelik</th>
                <th className="px-4 py-3 font-bold">Durum</th>
                <th className="px-4 py-3 font-bold">İl / İlçe</th>
                <th className="px-4 py-3 font-bold">Açan</th>
                <th className="px-4 py-3 font-bold">Atanan</th>
                <th className="px-4 py-3 font-bold">Başlangıç</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 font-semibold">Yükleniyor...</td></tr>
              ) : !hasSearched ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 font-semibold">Henüz sorgu çalıştırılmadı.</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 font-semibold">Kayıt bulunamadı.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-bold text-brand-navy">{row.customerName}</div>
                      <div className="text-xs text-slate-500 truncate max-w-56">{row.title}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{row.category || '—'}</td>
                    <td className={`px-4 py-3 font-bold ${row.priority === 'Acil' ? 'text-rose-600' : 'text-slate-700'}`}>{row.priority}</td>
                    <td className="px-4 py-3 font-semibold text-blue-600">{row.status}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {[row.cityName, row.districtName].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.openedByUserName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.assignedToUserName}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.startDate}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {hasSearched && total > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500 font-semibold">
              Sayfa {page} / {totalPages} · Toplam {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => fetchReport(page - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold disabled:opacity-40"
              >
                Önceki
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => fetchReport(page + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold disabled:opacity-40"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
