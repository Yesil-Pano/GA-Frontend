// src/pages/MapPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { trIncludes } from '../utils/trSearch';

interface StationData {
  id: string;
  name: string;
  statusType: string;
  powerType?: string;
  personnelName?: string;
  personnelPhone?: string;
  edas?: string;
  address?: string;
  pointType?: string;
  city: string;
  district?: string | null;
  ownerCompany?: string | null;
  tenantId?: string;
  generalFilePath?: string;
  ygTescilBelgesiPath?: string;
  ygSozlesmesiPath?: string;
  sabitFotograflarPath?: string;
  yillikBakimFormuPath?: string;
  ygIsletmeBelgesiPath?: string;
  position: [number, number];
}

interface PersonnelLookup {
  id: string;
  fullName: string;
}

const EDAS_LIST = ["VANGÖLÜ", "ULUDAĞ", "TIRAKYA", "TOROSLAR", "SAKARYA", "OSMANGAZİ", "MERAM", "KCTAŞ", "GDZ", "FIRAT", "DİCLE", "ÇORUH", "ÇAMLIBEL", "BOĞAZİÇİ", "BAŞKENT", "AYEDAŞ", "AKEDAŞ", "AKDENİZ", "ADM", "ARAS"];
const CITIES = ["Adana","Adıyaman","Afyonkarahisar","Ağrı","Amasya","Ankara","Antalya","Artvin","Aydın","Balıkesir","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Isparta","Mersin","İstanbul","İzmir","Kars","Kastamonu","Kayseri","Kırklareli","Kırşehir","Kocaeli","Konya","Kütahya","Malatya","Manisa","Kahramanmaraş","Mardin","Muğla","Muş","Nevşehir","Niğde","Ordu","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas","Tekirdağ","Tokat","Trabzon","Tunceli","Şanlıurfa","Uşak","Van","Yozgat","Zonguldak","Aksaray","Bayburt","Karaman","Kırıkkale","Batman","Şırnak","Bartın","Ardahan","Iğdır","Yalova","Karabük","Kilis","Osmaniye","Düzce"];

const todayLocal = (h: number, m = 0) => {
  const n = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(h)}:${pad(m)}`;
};

export default function MapPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [stations, setStations] = useState<StationData[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelLookup[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null);

  const [formData, setFormData] = useState({
    name: '', statusType: 'Alt Yapı Tamamlandı', powerType: 'AC', personnelName: '', personnelPhone: '',
    edas: EDAS_LIST[0], address: '', pointType: 'YG Abonelik', city: 'Ankara', lat: 39.92, lng: 32.85
  });

  const [bulkForm, setBulkForm] = useState({
    title: '{nokta} iş emri',
    description: '',
    mobileDescription: '',
    address: '',
    priority: 'Orta',
    type: 'Arıza',
    category: 'Arıza Bildirimi',
    startDate: todayLocal(9),
    endDate: todayLocal(18),
    operationUserId: '',
    openedByUserId: '',
    assignedToUserId: '',
    isPeriodic: false,
    recurrenceInterval: 'Haftalik',
  });

  const { setFocusedMarkerPosition, refreshMapData, partnerKey } = useOutletContext<{
    setFocusedMarkerPosition: (pos: [number, number] | null) => void;
    refreshMapData?: () => Promise<void>;
    partnerKey?: string;
  }>();

  const fetchStations = async () => {
    const response = await api.get('/stations');
    setStations(response.data);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const [stationsRes, lookupsRes] = await Promise.all([
          api.get('/stations'),
          api.get('/workorders/lookups'),
        ]);
        if (!mounted) return;
        setStations(stationsRes.data);
        const backendData = lookupsRes.data || {};
        const mapped = backendData.teams
          ? backendData.teams.map((t: { id: string; name: string }) => ({ id: t.id, fullName: t.name }))
          : (backendData.personnel ?? []);
        setPersonnel(mapped);
        if (mapped.length > 0) {
          setBulkForm((prev) => ({
            ...prev,
            operationUserId: mapped[0].id,
            openedByUserId: mapped[0].id,
            assignedToUserId: mapped[0].id,
          }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [partnerKey]);

  const filteredStations = useMemo(
    () =>
      stations.filter(
        (s) =>
          trIncludes(s.name, searchTerm) ||
          trIncludes(s.city, searchTerm) ||
          trIncludes(s.district, searchTerm) ||
          trIncludes(s.address, searchTerm),
      ),
    [stations, searchTerm],
  );

  const allFilteredSelected =
    filteredStations.length > 0 && filteredStations.every((s) => selectedIds.includes(s.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredStations.map((s) => s.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const ids = filteredStations.map((s) => s.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.post('/stations', {
        ...formData, latitude: Number(formData.lat), longitude: Number(formData.lng)
      });
      setIsFormOpen(false);
      await fetchStations();
      await refreshMapData?.();
    } catch (error) {
      console.error(error);
      alert('Nokta eklenemedi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkForm.assignedToUserId) {
      alert('Sahacı ataması zorunludur.');
      return;
    }
    if (selectedIds.length === 0) {
      alert('En az bir nokta seçin.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { data } = await api.post('/workorders/bulk', {
        stationIds: selectedIds,
        title: bulkForm.title,
        description: bulkForm.description,
        mobileDescription: bulkForm.mobileDescription,
        address: bulkForm.address,
        priority: bulkForm.priority,
        type: bulkForm.type,
        category: bulkForm.category,
        startDate: new Date(bulkForm.startDate).toISOString(),
        endDate: new Date(bulkForm.endDate).toISOString(),
        operationUserId: bulkForm.operationUserId || null,
        openedByUserId: bulkForm.openedByUserId || null,
        assignedToUserId: bulkForm.assignedToUserId,
        isPeriodic: bulkForm.isPeriodic,
        recurrenceInterval: bulkForm.isPeriodic ? bulkForm.recurrenceInterval : 'None',
      });
      setIsBulkOpen(false);
      setSelectedIds([]);
      alert(data.message || 'İş emirleri oluşturuldu.');
      navigate('/work-orders');
    } catch (error) {
      console.error(error);
      alert('Toplu iş emri oluşturulamadı.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 bg-white relative overflow-hidden">
      <div className="mb-4 space-y-3">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
          <input
            type="text"
            placeholder="Nokta / il / ilçe ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-orange outline-none shadow-inner"
          />
        </div>
        <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-slate-100">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
            <input type="checkbox" className="accent-brand-orange" checked={allFilteredSelected} onChange={toggleSelectAllFiltered} />
            Filtrelenenleri seç ({filteredStations.length})
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => {
                setBulkForm((p) => ({ ...p, startDate: todayLocal(9), endDate: todayLocal(18) }));
                setIsBulkOpen(true);
              }}
              className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-40"
            >
              Toplu İş Emri ({selectedIds.length})
            </button>
            <button type="button" onClick={() => setIsFormOpen(true)} className="px-3 py-2 bg-white border border-blue-500 text-blue-500 rounded-lg text-xs font-bold hover:bg-blue-50">
              + Nokta Ekle
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar pb-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center pt-20 space-y-3">
            <svg className="animate-spin h-8 w-7 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-xs font-bold text-slate-400 tracking-wide animate-pulse">Saha Noktaları Yükleniyor...</span>
          </div>
        ) : filteredStations.length === 0 ? (
          <p className="text-sm text-slate-400 text-center mt-10">Kayıtlı saha noktası bulunmuyor.</p>
        ) : (
          filteredStations.map((station) => (
            <div
              key={station.id}
              onClick={() => station.position && setFocusedMarkerPosition([...station.position])}
              className={`bg-white rounded-xl shadow-md border p-4 cursor-pointer hover:shadow-lg transition group flex gap-3 ${selectedIds.includes(station.id) ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-slate-200 border-l-[6px] border-l-blue-500'}`}
            >
              <input
                type="checkbox"
                className="mt-1 accent-emerald-600 shrink-0"
                checked={selectedIds.includes(station.id)}
                onChange={(e) => { e.stopPropagation(); toggleSelect(station.id); }}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-brand-navy text-base group-hover:text-brand-orange transition-colors mb-2 truncate">📍 {station.name}</h3>
                <div className="space-y-1 text-xs text-slate-600 font-medium">
                  <div><span className="font-bold text-slate-400">İl:</span> {station.city}{station.district ? ` / ${station.district}` : ''} | <span className="font-bold text-slate-400">Güç:</span> {station.powerType}</div>
                  <div><span className="font-bold text-slate-400">Durum:</span> <span className="text-emerald-600 font-bold">{station.statusType}</span></div>
                </div>
                <div className="flex justify-end mt-3 pt-2 border-t border-slate-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedStation(station); setIsDetailModalOpen(true); }}
                    className="text-xs text-blue-600 bg-blue-50 px-4 py-1.5 rounded-lg hover:bg-blue-100 transition font-bold"
                  >
                    🔎 Detayları Gör
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Nokta ekleme */}
      <div className={`fixed top-20 right-0 bottom-0 bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.15)] border-l border-slate-200 transition-transform duration-300 z-40 flex flex-col ${isFormOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: '450px' }}>
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50 shadow-sm shrink-0">
          <span className="font-bold text-brand-navy text-sm">Yeni Nokta</span>
          <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl px-2">×</button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-sm pb-12">
          <div><label className="block text-xs font-bold text-slate-700 mb-1">İstasyon Adı</label><input required className="w-full border rounded-lg p-2.5" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">Durum Tipi</label><select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.statusType} onChange={e => setFormData({...formData, statusType: e.target.value})}><option>Alt Yapı Tamamlandı</option><option>Enerji Bekliyor</option><option>Yayınlandı</option></select></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">Güç Tipi</label><select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.powerType} onChange={e => setFormData({...formData, powerType: e.target.value})}><option>ACDC</option><option>AC</option><option>DC</option></select></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">İlgili Personel</label><input required className="w-full border rounded-lg p-2.5" value={formData.personnelName} onChange={e => setFormData({...formData, personnelName: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">Personel Tel</label><input required className="w-full border rounded-lg p-2.5" value={formData.personnelPhone} onChange={e => setFormData({...formData, personnelPhone: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">EDAŞ</label><select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.edas} onChange={e => setFormData({...formData, edas: e.target.value})}>{EDAS_LIST.map((e, i) => <option key={i}>{e}</option>)}</select></div>
          <div className="flex gap-4"><div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Lat</label><input type="number" step="any" required className="w-full border rounded-lg p-2" value={formData.lat} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})} /></div><div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Lng</label><input type="number" step="any" required className="w-full border rounded-lg p-2" value={formData.lng} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value)})} /></div></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">Adres</label><textarea required rows={2} className="w-full border rounded-lg p-2.5" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">Nokta Tipi</label><select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.pointType} onChange={e => setFormData({...formData, pointType: e.target.value})}><option>YG Abonelik</option><option>AG Abonelik</option><option>Süzme Sayaç</option></select></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">İl</label><select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})}>{CITIES.map((c, i) => <option key={i}>{c}</option>)}</select></div>
          <div className="flex justify-end gap-6 pt-4 border-t">
            <button type="button" onClick={() => setIsFormOpen(false)} className="text-rose-500 font-bold">İptal</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-lg">{isSubmitting ? '...' : '✓ Kaydet'}</button>
          </div>
        </form>
      </div>

      {/* Toplu iş emri */}
      <div className={`fixed top-20 right-0 bottom-0 bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.15)] border-l border-slate-200 transition-transform duration-300 z-40 flex flex-col ${isBulkOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: '450px' }}>
        <div className="flex justify-between items-center p-4 border-b bg-emerald-50 shrink-0">
          <div>
            <p className="font-bold text-brand-navy text-sm">Toplu İş Emri</p>
            <p className="text-[11px] text-emerald-700 font-semibold">{selectedIds.length} nokta seçili</p>
          </div>
          <button onClick={() => setIsBulkOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl px-2">×</button>
        </div>
        <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto p-5 space-y-3 text-sm pb-12">
          <p className="text-[11px] text-slate-500">Başlıkta <code className="bg-slate-100 px-1 rounded">{'{nokta}'}</code> kullanırsanız her noktanın adı yazılır.</p>
          <div><label className="block text-xs font-bold mb-1">Başlık şablonu</label><input required className="w-full border rounded-lg p-2.5" value={bulkForm.title} onChange={(e) => setBulkForm({ ...bulkForm, title: e.target.value })} /></div>
          <div><label className="block text-xs font-bold mb-1">İş Tipi</label><input className="w-full border rounded-lg p-2.5" value={bulkForm.type} onChange={(e) => setBulkForm({ ...bulkForm, type: e.target.value })} /></div>
          <div><label className="block text-xs font-bold mb-1">Kategori</label><input className="w-full border rounded-lg p-2.5" value={bulkForm.category} onChange={(e) => setBulkForm({ ...bulkForm, category: e.target.value })} /></div>
          <div><label className="block text-xs font-bold mb-1">Öncelik</label><select className="w-full border rounded-lg p-2.5" value={bulkForm.priority} onChange={(e) => setBulkForm({ ...bulkForm, priority: e.target.value })}><option>Düşük</option><option>Orta</option><option>Acil</option></select></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className="block text-xs font-bold mb-1">Başlangıç</label><input type="datetime-local" required className="w-full border rounded-lg p-2" value={bulkForm.startDate} onChange={(e) => setBulkForm({ ...bulkForm, startDate: e.target.value })} /></div>
            <div className="flex-1"><label className="block text-xs font-bold mb-1">Bitiş</label><input type="datetime-local" required className="w-full border rounded-lg p-2" value={bulkForm.endDate} onChange={(e) => setBulkForm({ ...bulkForm, endDate: e.target.value })} /></div>
          </div>
          <div><label className="block text-xs font-bold mb-1">Genel Açıklama</label><textarea rows={2} className="w-full border rounded-lg p-2.5" value={bulkForm.description} onChange={(e) => setBulkForm({ ...bulkForm, description: e.target.value })} /></div>
          <div><label className="block text-xs font-bold mb-1">Mühendis Açıklaması</label><textarea rows={2} className="w-full border rounded-lg p-2.5" value={bulkForm.mobileDescription} onChange={(e) => setBulkForm({ ...bulkForm, mobileDescription: e.target.value })} /></div>
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 space-y-2">
            <label className="flex items-center gap-2 font-bold text-emerald-800 text-xs">
              <input type="checkbox" checked={bulkForm.isPeriodic} onChange={(e) => setBulkForm({ ...bulkForm, isPeriodic: e.target.checked })} />
              Bu Bir Periyodik İş Emridir (Otomatik Tekrarlansın)
            </label>
            {bulkForm.isPeriodic && (
              <select className="w-full border rounded-lg p-2 text-xs" value={bulkForm.recurrenceInterval} onChange={(e) => setBulkForm({ ...bulkForm, recurrenceInterval: e.target.value })}>
                <option value="Haftalik">Her Hafta</option>
                <option value="Aylik">Her Ay</option>
                <option value="Yillik">Her Yıl</option>
              </select>
            )}
          </div>
          <div><label className="block text-xs font-bold mb-1">Operasyon Sorumlusu</label><select required className="w-full border rounded-lg p-2.5" value={bulkForm.operationUserId} onChange={(e) => setBulkForm({ ...bulkForm, operationUserId: e.target.value })}>{personnel.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></div>
          <div><label className="block text-xs font-bold mb-1">İş Açan</label><select className="w-full border rounded-lg p-2.5" value={bulkForm.openedByUserId} onChange={(e) => setBulkForm({ ...bulkForm, openedByUserId: e.target.value })}>{personnel.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></div>
          <div><label className="block text-xs font-bold mb-1">İş Atanan Sahacı *</label><select required className="w-full border rounded-lg p-2.5" value={bulkForm.assignedToUserId} onChange={(e) => setBulkForm({ ...bulkForm, assignedToUserId: e.target.value })}>{personnel.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></div>
          <div className="flex gap-3 pt-3 border-t">
            <button type="button" onClick={() => setIsBulkOpen(false)} className="flex-1 border rounded-xl py-3 font-bold">İptal</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 bg-emerald-600 text-white rounded-xl py-3 font-bold disabled:opacity-50">
              {isSubmitting ? 'Oluşturuluyor...' : `${selectedIds.length} İş Emri Aç`}
            </button>
          </div>
        </form>
      </div>

      {isDetailModalOpen && selectedStation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-50">
              <h2 className="text-base font-bold text-brand-navy">📍 İstasyon Detay</h2>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-4 text-xs">
              <div className="col-span-2 bg-blue-50 text-blue-800 px-4 py-2 rounded-lg font-bold text-sm">{selectedStation.name}</div>
              <div><label className="block font-bold text-slate-400 mb-1">İl</label><input disabled className="w-full bg-slate-50 border rounded-lg p-2.5" value={selectedStation.city} /></div>
              <div><label className="block font-bold text-slate-400 mb-1">Durum</label><input disabled className="w-full bg-slate-50 border rounded-lg p-2.5 text-emerald-600 font-bold" value={selectedStation.statusType} /></div>
              <div className="col-span-2"><label className="block font-bold text-slate-400 mb-1">Adres</label><textarea disabled rows={2} className="w-full bg-slate-50 border rounded-lg p-2.5" value={selectedStation.address} /></div>
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end">
              <button onClick={() => setIsDetailModalOpen(false)} className="bg-slate-700 text-white font-bold px-6 py-2 rounded-xl">Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
