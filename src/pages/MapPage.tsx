// src/pages/MapPage.tsx
import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import api from '../services/api';
import { trIncludes } from '../utils/trSearch';
import { getPartnerByKey, getPartnerColor, resolvePartnerKey } from '../utils/partners';

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

interface MapPageOutletContext {
  setFocusedMarkerPosition: (pos: [number, number] | null) => void;
  refreshMapData?: () => Promise<void>;
  partnerKey?: string;
  mapStations?: StationData[];
  isMapStationsLoading?: boolean;
}

const EDAS_LIST = ["VANGÖLÜ", "ULUDAĞ", "TIRAKYA", "TOROSLAR", "SAKARYA", "OSMANGAZİ", "MERAM", "KCTAŞ", "GDZ", "FIRAT", "DİCLE", "ÇORUH", "ÇAMLIBEL", "BOĞAZİÇİ", "BAŞKENT", "AYEDAŞ", "AKEDAŞ", "AKDENİZ", "ADM", "ARAS"];
const CITIES = ["Adana","Adıyaman","Afyonkarahisar","Ağrı","Amasya","Ankara","Antalya","Artvin","Aydın","Balıkesir","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Isparta","Mersin","İstanbul","İzmir","Kars","Kastamonu","Kayseri","Kırklareli","Kırşehir","Kocaeli","Konya","Kütahya","Malatya","Manisa","Kahramanmaraş","Mardin","Muğla","Muş","Nevşehir","Niğde","Ordu","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas","Tekirdağ","Tokat","Trabzon","Tunceli","Şanlıurfa","Uşak","Van","Yozgat","Zonguldak","Aksaray","Bayburt","Karaman","Kırıkkale","Batman","Şırnak","Bartın","Ardahan","Iğdır","Yalova","Karabük","Kilis","Osmaniye","Düzce"];

const todayLocal = (h: number, m = 0) => {
  const n = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(h)}:${pad(m)}`;
};

const StationListCard = memo(function StationListCard({
  station,
  partnerKey,
  selected,
  onFocus,
  onToggleSelect,
  onOpenDetail,
}: {
  station: StationData;
  partnerKey?: string;
  selected: boolean;
  onFocus: (position: [number, number]) => void;
  onToggleSelect: (id: string) => void;
  onOpenDetail: (station: StationData) => void;
}) {
  const pk = resolvePartnerKey({
    tenantId: station.tenantId,
    ownerCompany: station.ownerCompany,
    name: station.name,
  });
  const partner = pk ? getPartnerByKey(pk) : null;
  const accent = partnerKey === 'all' ? getPartnerColor(pk) : undefined;

  return (
    <div
      onClick={() => station.position && onFocus([...station.position] as [number, number])}
      className={`bg-white rounded-xl shadow-md border p-4 cursor-pointer hover:shadow-lg transition group flex gap-3 mb-3 ${selected ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-slate-200 border-l-[6px]'}`}
      style={selected ? undefined : { borderLeftColor: accent || '#3B82F6' }}
    >
      <input
        type="checkbox"
        className="mt-1 accent-emerald-600 shrink-0"
        checked={selected}
        onChange={(e) => { e.stopPropagation(); onToggleSelect(station.id); }}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-brand-navy text-base group-hover:text-brand-orange transition-colors truncate">📍 {station.name}</h3>
          {partnerKey === 'all' && partner && partner.key !== 'all' && (
            <span
              className="shrink-0 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md text-white"
              style={{ backgroundColor: partner.color }}
            >
              {partner.name}
            </span>
          )}
        </div>
        <div className="space-y-1 text-xs text-slate-600 font-medium">
          <div><span className="font-bold text-slate-400">İl:</span> {station.city}{station.district ? ` / ${station.district}` : ''} | <span className="font-bold text-slate-400">Güç:</span> {station.powerType}</div>
          <div><span className="font-bold text-slate-400">Durum:</span> <span className="text-emerald-600 font-bold">{station.statusType}</span></div>
        </div>
        <div className="flex justify-end mt-3 pt-2 border-t border-slate-100">
          <button
            onClick={(e) => { e.stopPropagation(); onOpenDetail(station); }}
            className="text-xs text-blue-600 bg-blue-50 px-4 py-1.5 rounded-lg hover:bg-blue-100 transition font-bold"
          >
            🔎 Detayları Gör
          </button>
        </div>
      </div>
    </div>
  );
});

export default function MapPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [personnel, setPersonnel] = useState<PersonnelLookup[]>([]);
  const [workTypes, setWorkTypes] = useState<string[]>(['Arıza', 'Bakım', 'Kurulum', 'Keşif', 'Saha Operasyonu']);
  const [workCategories, setWorkCategories] = useState<string[]>([
    'Arıza Bildirimi', 'YG İşletme Sorumluluğu Talebi', 'YG Bakım', 'AG Bakım',
    'Kapasitif Ceza', 'QR, Etiket ve Görsel Kontrol', 'Duba, Stopper ve Çevre Kontrol',
  ]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    city: 'Ankara',
    district: '',
    statusType: 'Alt Yapı Tamamlandı',
    powerType: '-',
    pointType: 'YG Abonelik',
    edas: '-',
    ownerCompany: '',
    personnelName: '-',
    personnelPhone: '-',
    address: '-',
    lat: 39.92,
    lng: 32.85,
  });

  const { setFocusedMarkerPosition, refreshMapData, partnerKey, mapStations, isMapStationsLoading } =
    useOutletContext<MapPageOutletContext>();

  const stations = useMemo(
    () => (Array.isArray(mapStations) ? mapStations : []) as StationData[],
    [mapStations],
  );
  const isLoading = Boolean(isMapStationsLoading);

  const openStationDetail = useCallback((station: StationData) => {
    setSelectedStation(station);
    setIsEditingDetail(false);
    setEditForm({
      name: station.name || '',
      city: station.city || 'Ankara',
      district: station.district || '',
      statusType: station.statusType || 'Alt Yapı Tamamlandı',
      powerType: station.powerType || '-',
      pointType: station.pointType || 'YG Abonelik',
      edas: station.edas || '-',
      ownerCompany: station.ownerCompany || '',
      personnelName: station.personnelName || '-',
      personnelPhone: station.personnelPhone || '-',
      address: station.address || '-',
      lat: station.position?.[0] ?? 39.92,
      lng: station.position?.[1] ?? 32.85,
    });
    setIsDetailModalOpen(true);
  }, []);

  const closeStationDetail = () => {
    setIsDetailModalOpen(false);
    setIsEditingDetail(false);
    setSelectedStation(null);
  };

  const handleSaveStationDetail = async () => {
    if (!selectedStation) return;
    if (!editForm.name.trim()) {
      alert('İstasyon adı zorunludur.');
      return;
    }
    setIsSavingDetail(true);
    try {
      const { data } = await api.put(`/stations/${selectedStation.id}`, {
        name: editForm.name.trim(),
        city: editForm.city,
        district: editForm.district.trim() || null,
        statusType: editForm.statusType,
        powerType: editForm.powerType,
        pointType: editForm.pointType,
        edas: editForm.edas,
        ownerCompany: editForm.ownerCompany.trim() || null,
        personnelName: editForm.personnelName,
        personnelPhone: editForm.personnelPhone,
        address: editForm.address,
        latitude: Number(editForm.lat),
        longitude: Number(editForm.lng),
      });
      const updated: StationData = {
        ...selectedStation,
        name: data.name,
        city: data.city,
        district: data.district,
        statusType: data.statusType,
        powerType: data.powerType,
        pointType: data.pointType,
        edas: data.edas,
        ownerCompany: data.ownerCompany,
        personnelName: data.personnelName,
        personnelPhone: data.personnelPhone,
        address: data.address,
        position: data.position,
      };
      setSelectedStation(updated);
      setIsEditingDetail(false);
      await refreshMapData?.();
    } catch (error) {
      console.error(error);
      alert('İstasyon güncellenemedi.');
    } finally {
      setIsSavingDetail(false);
    }
  };

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

  // Partner değişince lookups yeniden alınsın (toplu iş emri personeli güncel kalsın)
  useEffect(() => {
    setLookupsLoaded(false);
    setPersonnel([]);
  }, [partnerKey]);

  // Lookups yalnızca toplu iş emri modalı açılınca — listeyi bloklamaz
  useEffect(() => {
    if (!isBulkOpen || lookupsLoaded) return;
    let cancelled = false;
    setLookupsLoading(true);
    (async () => {
      try {
        const { data: backendData } = await api.get('/workorders/lookups');
        if (cancelled) return;
        const mapped = backendData?.teams
          ? backendData.teams.map((t: { id: string; name: string }) => ({ id: t.id, fullName: t.name }))
          : (backendData?.personnel ?? []);
        setPersonnel(mapped);
        if (Array.isArray(backendData?.types) && backendData.types.length > 0) {
          setWorkTypes(backendData.types);
        }
        if (Array.isArray(backendData?.categories) && backendData.categories.length > 0) {
          setWorkCategories(backendData.categories);
        }
        if (mapped.length > 0) {
          setBulkForm((prev) => ({
            ...prev,
            operationUserId: prev.operationUserId || mapped[0].id,
            openedByUserId: prev.openedByUserId || mapped[0].id,
            assignedToUserId: prev.assignedToUserId || mapped[0].id,
          }));
        }
        setLookupsLoaded(true);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLookupsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isBulkOpen, lookupsLoaded, partnerKey]);

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

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const allFilteredSelected =
    filteredStations.length > 0 && filteredStations.every((s) => selectedIdSet.has(s.id));

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleFocusStation = useCallback((position: [number, number]) => {
    setFocusedMarkerPosition(position);
  }, [setFocusedMarkerPosition]);

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
      <div className="mb-4 space-y-3 shrink-0">
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

      <div className="flex-1 min-h-0 pr-1">
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
          <Virtuoso
            style={{ height: '100%' }}
            data={filteredStations}
            overscan={200}
            itemContent={(_index, station) => (
              <StationListCard
                station={station}
                partnerKey={partnerKey}
                selected={selectedIdSet.has(station.id)}
                onFocus={handleFocusStation}
                onToggleSelect={toggleSelect}
                onOpenDetail={openStationDetail}
              />
            )}
          />
        )}
      </div>

      {/* Nokta ekleme — merkez modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <h2 className="text-base font-bold text-brand-navy">Yeni Nokta</h2>
              <button type="button" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl px-2">×</button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-sm">
              <div><label className="block text-xs font-bold text-slate-700 mb-1">İstasyon Adı</label><input required className="w-full border rounded-lg p-2.5" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Durum Tipi</label><select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.statusType} onChange={e => setFormData({...formData, statusType: e.target.value})}><option>Alt Yapı Tamamlandı</option><option>Enerji Bekliyor</option><option>Yayınlandı</option></select></div>
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Güç Tipi</label><select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.powerType} onChange={e => setFormData({...formData, powerType: e.target.value})}><option>ACDC</option><option>AC</option><option>DC</option></select></div>
                <div><label className="block text-xs font-bold text-slate-700 mb-1">İlgili Personel</label><input required className="w-full border rounded-lg p-2.5" value={formData.personnelName} onChange={e => setFormData({...formData, personnelName: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Personel Tel</label><input required className="w-full border rounded-lg p-2.5" value={formData.personnelPhone} onChange={e => setFormData({...formData, personnelPhone: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-700 mb-1">EDAŞ</label><select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.edas} onChange={e => setFormData({...formData, edas: e.target.value})}>{EDAS_LIST.map((e, i) => <option key={i}>{e}</option>)}</select></div>
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Nokta Tipi</label><select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.pointType} onChange={e => setFormData({...formData, pointType: e.target.value})}><option>YG Abonelik</option><option>AG Abonelik</option><option>Süzme Sayaç</option></select></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Lat</label><input type="number" step="any" required className="w-full border rounded-lg p-2" value={formData.lat} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})} /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Lng</label><input type="number" step="any" required className="w-full border rounded-lg p-2" value={formData.lng} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value)})} /></div>
              </div>
              <div><label className="block text-xs font-bold text-slate-700 mb-1">Adres</label><textarea required rows={2} className="w-full border rounded-lg p-2.5" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
              <div><label className="block text-xs font-bold text-slate-700 mb-1">İl</label><select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})}>{CITIES.map((c, i) => <option key={i}>{c}</option>)}</select></div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50">İptal</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl disabled:opacity-50">{isSubmitting ? '...' : '✓ Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toplu iş emri — merkez modal */}
      {isBulkOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-emerald-50 shrink-0">
              <div>
                <h2 className="font-bold text-brand-navy text-base">Toplu İş Emri</h2>
                <p className="text-[11px] text-emerald-700 font-semibold">{selectedIds.length} nokta seçili</p>
              </div>
              <button type="button" onClick={() => setIsBulkOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl px-2">×</button>
            </div>
            <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto p-6 space-y-3 text-sm">
              {lookupsLoading && !lookupsLoaded && (
                <p className="text-xs text-slate-500 font-semibold animate-pulse">Personel listesi yükleniyor...</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold mb-1">İş Tipi</label>
                  <select className="w-full border rounded-lg p-2.5 bg-slate-50" value={bulkForm.type} onChange={(e) => setBulkForm({ ...bulkForm, type: e.target.value })}>
                    {workTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs font-bold mb-1">İş Kategorisi</label>
                  <select className="w-full border rounded-lg p-2.5 bg-slate-50" value={bulkForm.category} onChange={(e) => setBulkForm({ ...bulkForm, category: e.target.value })}>
                    {workCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs font-bold mb-1">Öncelik</label><select className="w-full border rounded-lg p-2.5" value={bulkForm.priority} onChange={(e) => setBulkForm({ ...bulkForm, priority: e.target.value })}><option>Düşük</option><option>Orta</option><option>Acil</option></select></div>
                <div />
                <div><label className="block text-xs font-bold mb-1">Planlanan Başlangıç</label><input type="datetime-local" required className="w-full border rounded-lg p-2" value={bulkForm.startDate} onChange={(e) => setBulkForm({ ...bulkForm, startDate: e.target.value })} /></div>
                <div><label className="block text-xs font-bold mb-1">Planlanan Bitiş</label><input type="datetime-local" required className="w-full border rounded-lg p-2" value={bulkForm.endDate} onChange={(e) => setBulkForm({ ...bulkForm, endDate: e.target.value })} /></div>
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
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2">
                <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Operasyon Atamaları</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><label className="block text-xs font-bold mb-1">Operasyon Sorumlusu</label><select required className="w-full border rounded-lg p-2.5" value={bulkForm.operationUserId} onChange={(e) => setBulkForm({ ...bulkForm, operationUserId: e.target.value })} disabled={lookupsLoading && !lookupsLoaded}>{personnel.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></div>
                  <div><label className="block text-xs font-bold mb-1">İş Açan Yetkili</label><select className="w-full border rounded-lg p-2.5" value={bulkForm.openedByUserId} onChange={(e) => setBulkForm({ ...bulkForm, openedByUserId: e.target.value })} disabled={lookupsLoading && !lookupsLoaded}>{personnel.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></div>
                  <div><label className="block text-xs font-bold mb-1">İş Atanan Sahacı *</label><select required className="w-full border rounded-lg p-2.5" value={bulkForm.assignedToUserId} onChange={(e) => setBulkForm({ ...bulkForm, assignedToUserId: e.target.value })} disabled={lookupsLoading && !lookupsLoaded}>{personnel.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></div>
                </div>
              </div>
              <div className="flex gap-3 pt-3 border-t">
                <button type="button" onClick={() => setIsBulkOpen(false)} className="flex-1 border rounded-xl py-3 font-bold hover:bg-slate-50">İptal</button>
                <button type="submit" disabled={isSubmitting || (lookupsLoading && !lookupsLoaded)} className="flex-1 bg-emerald-600 text-white rounded-xl py-3 font-bold disabled:opacity-50">
                  {isSubmitting ? 'Oluşturuluyor...' : `${selectedIds.length} İş Emri Aç`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDetailModalOpen && selectedStation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-50">
              <h2 className="text-base font-bold text-brand-navy">
                📍 İstasyon Detay {isEditingDetail ? '› Düzenleme Modu' : ''}
              </h2>
              <button onClick={closeStationDetail} className="text-slate-400 hover:text-rose-600 font-bold text-2xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-x-6 gap-y-4 text-xs">
              <div className="col-span-2">
                {isEditingDetail ? (
                  <input
                    className="w-full bg-white border border-blue-300 rounded-lg px-4 py-2 font-bold text-sm text-blue-800 focus:ring-2 focus:ring-blue-400 outline-none"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                ) : (
                  <div className="bg-blue-50 text-blue-800 px-4 py-2 rounded-lg font-bold text-sm">{selectedStation.name || '—'}</div>
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">İl</label>
                {isEditingDetail ? (
                  <select className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-semibold" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}>
                    {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input disabled className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-700" value={selectedStation.city || '—'} />
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">İlçe</label>
                <input
                  disabled={!isEditingDetail}
                  className={`w-full border rounded-lg p-2.5 font-semibold ${isEditingDetail ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                  value={isEditingDetail ? editForm.district : (selectedStation.district || '—')}
                  onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                  placeholder="İlçe"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Durum</label>
                {isEditingDetail ? (
                  <select className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-bold text-emerald-700" value={editForm.statusType} onChange={(e) => setEditForm({ ...editForm, statusType: e.target.value })}>
                    <option>Alt Yapı Tamamlandı</option>
                    <option>Enerji Bekliyor</option>
                    <option>Yayınlandı</option>
                  </select>
                ) : (
                  <input disabled className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold text-emerald-600" value={selectedStation.statusType || '—'} />
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Güç Tipi</label>
                {isEditingDetail ? (
                  <select className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-semibold" value={editForm.powerType} onChange={(e) => setEditForm({ ...editForm, powerType: e.target.value })}>
                    <option value="-">-</option>
                    <option>AC</option>
                    <option>DC</option>
                    <option>ACDC</option>
                  </select>
                ) : (
                  <input disabled className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-700" value={selectedStation.powerType || '—'} />
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Nokta Tipi</label>
                {isEditingDetail ? (
                  <select className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-semibold" value={editForm.pointType} onChange={(e) => setEditForm({ ...editForm, pointType: e.target.value })}>
                    <option>KOMPANZASYON</option>
                    <option>ABONELER</option>
                    <option>YG Abonelik</option>
                    <option>AG Abonelik</option>
                    <option>Süzme Sayaç</option>
                  </select>
                ) : (
                  <input disabled className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-700" value={selectedStation.pointType || '—'} />
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">EDAŞ</label>
                {isEditingDetail ? (
                  <select className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-semibold" value={editForm.edas} onChange={(e) => setEditForm({ ...editForm, edas: e.target.value })}>
                    <option value="-">-</option>
                    {EDAS_LIST.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                ) : (
                  <input disabled className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-700" value={selectedStation.edas || '—'} />
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Sahip / Firma</label>
                <input
                  disabled={!isEditingDetail}
                  className={`w-full border rounded-lg p-2.5 font-semibold ${isEditingDetail ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                  value={isEditingDetail ? editForm.ownerCompany : (selectedStation.ownerCompany || '—')}
                  onChange={(e) => setEditForm({ ...editForm, ownerCompany: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Personel</label>
                <input
                  disabled={!isEditingDetail}
                  className={`w-full border rounded-lg p-2.5 font-semibold ${isEditingDetail ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                  value={isEditingDetail ? editForm.personnelName : (selectedStation.personnelName || '—')}
                  onChange={(e) => setEditForm({ ...editForm, personnelName: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Personel Telefon</label>
                <input
                  disabled={!isEditingDetail}
                  className={`w-full border rounded-lg p-2.5 font-semibold ${isEditingDetail ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                  value={isEditingDetail ? editForm.personnelPhone : (selectedStation.personnelPhone || '—')}
                  onChange={(e) => setEditForm({ ...editForm, personnelPhone: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Koordinat (Enlem)</label>
                <input
                  disabled={!isEditingDetail}
                  type={isEditingDetail ? 'number' : 'text'}
                  step="any"
                  className={`w-full border rounded-lg p-2.5 font-mono font-semibold ${isEditingDetail ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                  value={isEditingDetail ? editForm.lat : (selectedStation.position?.[0] != null ? String(selectedStation.position[0]) : '—')}
                  onChange={(e) => setEditForm({ ...editForm, lat: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Koordinat (Boylam)</label>
                <input
                  disabled={!isEditingDetail}
                  type={isEditingDetail ? 'number' : 'text'}
                  step="any"
                  className={`w-full border rounded-lg p-2.5 font-mono font-semibold ${isEditingDetail ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                  value={isEditingDetail ? editForm.lng : (selectedStation.position?.[1] != null ? String(selectedStation.position[1]) : '—')}
                  onChange={(e) => setEditForm({ ...editForm, lng: parseFloat(e.target.value) })}
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Adres</label>
                <textarea
                  disabled={!isEditingDetail}
                  rows={2}
                  className={`w-full border rounded-lg p-2.5 font-semibold ${isEditingDetail ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                  value={isEditingDetail ? editForm.address : (selectedStation.address?.trim() || '—')}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-between gap-3">
              <button
                type="button"
                disabled={isEditingDetail}
                className="bg-emerald-600 text-white font-bold px-5 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-40"
                onClick={() => {
                  if (!selectedStation) return;
                  setSelectedIds([selectedStation.id]);
                  setBulkForm((prev) => ({
                    ...prev,
                    title: `${selectedStation.name} iş emri`,
                    address: selectedStation.address || '',
                  }));
                  closeStationDetail();
                  setIsBulkOpen(true);
                }}
              >
                + İş Emri Aç
              </button>
              <div className="flex gap-2">
                {isEditingDetail ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingDetail(false);
                        setEditForm({
                          name: selectedStation.name || '',
                          city: selectedStation.city || 'Ankara',
                          district: selectedStation.district || '',
                          statusType: selectedStation.statusType || 'Alt Yapı Tamamlandı',
                          powerType: selectedStation.powerType || '-',
                          pointType: selectedStation.pointType || 'YG Abonelik',
                          edas: selectedStation.edas || '-',
                          ownerCompany: selectedStation.ownerCompany || '',
                          personnelName: selectedStation.personnelName || '-',
                          personnelPhone: selectedStation.personnelPhone || '-',
                          address: selectedStation.address || '-',
                          lat: selectedStation.position?.[0] ?? 39.92,
                          lng: selectedStation.position?.[1] ?? 32.85,
                        });
                      }}
                      className="bg-white border border-slate-300 text-slate-700 font-bold px-5 py-2 rounded-xl hover:bg-slate-50"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveStationDetail}
                      disabled={isSavingDetail}
                      className="bg-emerald-600 text-white font-bold px-5 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {isSavingDetail ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditingDetail(true)}
                      className="bg-blue-600 text-white font-bold px-5 py-2 rounded-xl hover:bg-blue-700"
                    >
                      ✏️ Düzenle
                    </button>
                    <button onClick={closeStationDetail} className="bg-slate-700 text-white font-bold px-6 py-2 rounded-xl">Kapat</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
