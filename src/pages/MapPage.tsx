// src/pages/MapPage.tsx
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../services/api';

interface StationData {
  id: string;
  name: string;
  statusType: string;
  powerType: string;
  personnelName: string;
  personnelPhone: string;
  edas: string;
  address: string;
  pointType: string;
  city: string;
  generalFilePath: string;
  ygTescilBelgesiPath: string;
  ygSozlesmesiPath: string;
  sabitFotograflarPath: string;
  yillikBakimFormuPath: string;
  ygIsletmeBelgesiPath: string;
  position: [number, number];
}

const EDAS_LIST = ["VANGÖLÜ", "ULUDAĞ", "TIRAKYA", "TOROSLAR", "SAKARYA", "OSMANGAZİ", "MERAM", "KCTAŞ", "GDZ", "FIRAT", "DİCLE", "ÇORUH", "ÇAMLIBEL", "BOĞAZİÇİ", "BAŞKENT", "AYEDAŞ", "AKEDAŞ", "AKDENİZ", "ADM", "ARAS"];
const CITIES = ["Adana","Adıyaman","Afyonkarahisar","Ağrı","Amasya","Ankara","Antalya","Artvin","Aydın","Balıkesir","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Isparta","Mersin","İstanbul","İzmir","Kars","Kastamonu","Kayseri","Kırklareli","Kırşehir","Kocaeli","Konya","Kütahya","Malatya","Manisa","Kahramanmaraş","Mardin","Muğla","Muş","Nevşehir","Niğde","Ordu","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas","Tekirdağ","Tokat","Trabzon","Tunceli","Şanlıurfa","Uşak","Van","Yozgat","Zonguldak","Aksaray","Bayburt","Karaman","Kırıkkale","Batman","Şırnak","Bartın","Ardahan","Iğdır","Yalova","Karabük","Kilis","Osmaniye","Düzce"];

export default function MapPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [stations, setStations] = useState<StationData[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 🌀 NOKTALAR İÇİN CANLI LOADING STATE
  const [isLoading, setIsLoading] = useState(true);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null);

  const [formData, setFormData] = useState({
    name: '', statusType: 'Alt Yapı Tamamlandı', powerType: 'AC', personnelName: '', personnelPhone: '',
    edas: EDAS_LIST[0], address: '', pointType: 'YG Abonelik', city: 'Ankara', lat: 39.92, lng: 32.85
  });

  const { setFocusedMarkerPosition } = useOutletContext<{ setFocusedMarkerPosition: (pos: [number, number] | null) => void }>();

  const fetchStations = async () => {
    try {
      const response = await api.get('/stations');
      setStations(response.data);
    } catch (error) {
      console.error("Noktalar çekilemedi:", error);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setIsLoading(true); // Veri çekimi başlarken spinner'ı açıyoruz
      try {
        const response = await api.get('/stations');
        if (isMounted) setStations(response.data);
      } catch (error) {
        console.error(error);
      } finally {
        if (isMounted) setIsLoading(false); // İşlem bittiğinde tekerlek durur
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.post('/stations', {
        ...formData, latitude: Number(formData.lat), longitude: Number(formData.lng)
      });
      setIsFormOpen(false);
      setFormData({ name: '', statusType: 'Alt Yapı Tamamlandı', powerType: 'AC', personnelName: '', personnelPhone: '', edas: EDAS_LIST[0], address: '', pointType: 'YG Abonelik', city: 'Ankara', lat: 39.92, lng: 32.85 });
      fetchStations();
    } catch (error) {
      console.error(error);
      alert("Nokta eklenemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStations = stations.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="h-full flex flex-col p-4 bg-white relative overflow-hidden">
      
      {/* ÜST ARAMA PANELİ */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
          <input 
            type="text" placeholder="Nokta Ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-orange outline-none shadow-inner" 
          />
        </div>
        <div className="flex justify-end pb-2 border-b border-slate-100">
          <button onClick={() => setIsFormOpen(true)} className="px-4 py-2 bg-white border border-blue-500 text-blue-500 rounded-lg text-sm font-bold hover:bg-blue-50 transition">
            + Nokta Ekle
          </button>
        </div>
      </div>

      {/* LİSTE ALANI (SPINNER KONTROLLERİ ENTEGRE EDİLDİ) */}
      <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar pb-4">
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
              className="bg-white rounded-xl shadow-md border border-slate-200 border-l-[6px] border-l-blue-500 p-4 cursor-pointer hover:shadow-lg transition group"
            >
              <h3 className="font-bold text-brand-navy text-base group-hover:text-brand-orange transition-colors mb-2">📍 {station.name}</h3>
              <div className="space-y-1 text-xs text-slate-600 font-medium pl-4">
                <div><span className="font-bold text-slate-400">İl:</span> {station.city} | <span className="font-bold text-slate-400">Güç:</span> {station.powerType}</div>
                <div><span className="font-bold text-slate-400">Durum:</span> <span className="text-emerald-600 font-bold">{station.statusType}</span></div>
              </div>
              <div className="flex justify-end mt-3 pt-2 border-t border-slate-100 pl-4">
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedStation(station); setIsDetailModalOpen(true); }}
                  className="text-xs text-blue-600 bg-blue-50 px-4 py-1.5 rounded-lg hover:bg-blue-100 transition font-bold"
                >
                  🔎 Detayları Gör
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 🚀 SAĞDAN KAYAN KAPSAMLI NOKTA EKLEME PANELİ */}
      <div className={`fixed top-20 right-0 bottom-0 bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.15)] border-l border-slate-200 transition-transform duration-300 z-40 flex flex-col ${isFormOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: '450px' }}>
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50 shadow-sm shrink-0">
          <div className="flex items-center gap-2"><span className="text-blue-600 font-bold text-sm">Nokta Formu</span><span className="text-slate-400">›</span><span className="font-bold text-brand-navy text-sm">Yeni Nokta</span></div>
          <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl px-2">×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-sm pb-12">
          <div><label className="block text-xs font-bold text-slate-700 mb-1">1. İstasyon Adı</label><input required className="w-full border rounded-lg p-2.5" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">2. Durum Tipi (Status Type)</label><select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.statusType} onChange={e => setFormData({...formData, statusType: e.target.value})}><option>Alt Yapı Tamamlandı</option><option>Enerji Bekliyor</option><option>Yayınlandı</option></select></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">3. İstasyon Güç Tipi</label><select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.powerType} onChange={e => setFormData({...formData, powerType: e.target.value})}><option>ACDC</option><option>AC</option><option>DC</option></select></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">4. Lokasyon İlgili Personeli</label><input required className="w-full border rounded-lg p-2.5" value={formData.personnelName} onChange={e => setFormData({...formData, personnelName: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">5. İlgili Personel Numarası</label><input required className="w-full border rounded-lg p-2.5" value={formData.personnelPhone} onChange={e => setFormData({...formData, personnelPhone: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">6. EDAŞ Dağıtım Şkicketi</label><select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.edas} onChange={e => setFormData({...formData, edas: e.target.value})}>{EDAS_LIST.map((e, i) => <option key={i}>{e}</option>)}</select></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">7. Genel Evrak Yükleyiniz</label><input type="file" className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" /></div>
          <div className="flex gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100"><div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Harita Enlem (Lat)</label><input type="number" step="any" required className="w-full border rounded-lg p-2 bg-white" value={formData.lat} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})} /></div><div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Harita Boylam (Lng)</label><input type="number" step="any" required className="w-full border rounded-lg p-2 bg-white" value={formData.lng} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value)})} /></div></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">8. Tam Açık Adres</label><textarea required rows={2} className="w-full border rounded-lg p-2.5" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">9. Nokta Tipi</label><select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.pointType} onChange={e => setFormData({...formData, pointType: e.target.value})}><option>YG Abonelik</option><option>AG Abonelik</option><option>Süzme Sayaç</option></select></div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">10. YG İşletme Sorumluluğu Tescil Belgesi</label>
            <input type="file" className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">11. YG İşletme Sorumluluğu Sözleşmesi</label>
            <input type="file" className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">12. Sabit İşletme Fotoğrafları</label>
            <input type="file" className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">13. Yıllık Bakım Formu</label>
            <input type="file" className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">14. YG İşletme Sorumluluğu Belgesi</label>
            <input type="file" className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors" />
          </div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">15. Bağlı Olduğu İl</label><select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})}>{CITIES.map((c, i) => <option key={i}>{c}</option>)}</select></div>

          <div className="flex justify-end gap-6 items-center pt-6 border-t">
            <button type="button" onClick={() => setIsFormOpen(false)} className="text-rose-500 font-bold hover:underline">İptal</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition">{isSubmitting ? '...' : '✓ Noktayı Kaydet'}</button>
          </div>
        </form>
      </div>

      {/* 🚀 EKRANIN TAM ORTASINDA PARLAYAN SEÇKİN DETAY MODALI */}
      {isDetailModalOpen && selectedStation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fadeIn">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-bold text-brand-navy">📍 İstasyon / Lokasyon Detay Kartı</h2>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl">×</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-4 custom-scrollbar text-xs">
              <div className="col-span-2 bg-blue-50 text-blue-800 px-4 py-2 rounded-lg font-bold text-sm">İstasyon Adı: {selectedStation.name}</div>
              <div><label className="block font-bold text-slate-400 mb-1 uppercase">İl</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-lg p-2.5 cursor-not-allowed" value={selectedStation.city} /></div>
              <div><label className="block font-bold text-slate-400 mb-1 uppercase">Durum Tipi</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-emerald-600 font-bold rounded-lg p-2.5 cursor-not-allowed" value={selectedStation.statusType} /></div>
              <div><label className="block font-bold text-slate-400 mb-1 uppercase">Güç Tipi</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed" value={selectedStation.powerType} /></div>
              <div><label className="block font-bold text-slate-400 mb-1 uppercase">Nokta Tipi</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed" value={selectedStation.pointType} /></div>
              <div><label className="block font-bold text-slate-400 mb-1 uppercase">İlgili Personel</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed" value={selectedStation.personnelName} /></div>
              <div><label className="block font-bold text-slate-400 mb-1 uppercase">Personel Tel</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed" value={selectedStation.personnelPhone} /></div>
              <div><label className="block font-bold text-slate-400 mb-1 uppercase">EDAŞ Bölgesi</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed" value={selectedStation.edas} /></div>
              <div><label className="block font-bold text-slate-400 mb-1 uppercase">Konum (Lat, Lng)</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-600 font-mono rounded-lg p-2.5 cursor-not-allowed" value={`${selectedStation.position[0]}, ${selectedStation.position[1]}`} /></div>
              <div className="col-span-2"><label className="block font-bold text-slate-400 mb-1 uppercase">Açık Adres</label><textarea disabled rows={2} className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed resize-none" value={selectedStation.address} /></div>
              
              <div className="col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-2 font-semibold text-[11px]">
                <div className="flex justify-between border-b pb-1"><span>📄 Genel Evrak:</span> <span className="text-blue-600">{selectedStation.generalFilePath}</span></div>
                <div className="flex justify-between border-b pb-1"><span>📄 YG Tescil Belgesi:</span> <span className="text-blue-600">{selectedStation.ygTescilBelgesiPath}</span></div>
                <div className="flex justify-between border-b pb-1"><span>📄 YG Sözleşmesi:</span> <span className="text-blue-600">{selectedStation.ygSozlesmesiPath}</span></div>
                <div className="flex justify-between border-b pb-1"><span>📸 Sabit Fotoğraflar:</span> <span className="text-blue-600">{selectedStation.sabitFotograflarPath}</span></div>
                <div className="flex justify-between"><span>📄 Yıllık Bakım Formu:</span> <span className="text-blue-600">{selectedStation.yillikBakimFormuPath}</span></div>
                <div className="flex justify-between"><span>📄 YG İşletme Belgesi:</span> <span className="text-blue-600">{selectedStation.ygIsletmeBelgesiPath}</span></div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button onClick={() => setIsDetailModalOpen(false)} className="bg-slate-700 text-white font-bold px-6 py-2 rounded-xl hover:bg-slate-800 transition">Kapat</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}