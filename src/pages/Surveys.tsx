// ga-frontend/src/pages/Surveys.tsx
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../services/api';

interface SurveyData {
  id: string;
  title: string;
  subTitle: string;
  status: string;
  description: string;
  createdAt: string;
  latitude?: number;
  longitude?: number;
  Latitude?: number;
  Longitude?: number;
  [key: string]: string | number | boolean | undefined;
}

interface SurveyQuestion {
  id: number;
  key: string;
  text: string;
}

const SURVEY_QUESTIONS: SurveyQuestion[] = [
  { id: 1, key: 'Q1_MeterSerialRead', text: '1. Sayaç seri numarası kayıt altına alınarak sayaç değerleri okundu mu?' },
  { id: 2, key: 'Q2_PanelCleaning', text: '2. Pano enerjisi kesilerek pano temizliği yapıldı mı?' },
  { id: 3, key: 'Q3_FireExtinguisherPressure', text: '3. Yangın söndürme sistemi basıncı normal mi?' },
  { id: 4, key: 'Q4_MaintenanceFormSigned', text: '4. Bakım kontrol imza formu imzalandı mı?' },
  { id: 5, key: 'Q5_FanWorkingAndSufficient', text: '5. Fan çalışıyor mu? Panoyu soğutmak için yeterli mi?' },
  { id: 6, key: 'Q6_HasCoolingFan', text: '6. Panoda soğutucu fan var mı?' },
  { id: 7, key: 'Q7_SwitchgearScrewsChecked', text: '7. Pano içinde bulunan şalt ürünlerin vidalarının sıkılıkları kontrol edildi mi?' },
  { id: 8, key: 'Q8_PanelDoorLockable', text: '8. Pano kapılarının kilitlenebilirliği uygun mu?' },
  { id: 9, key: 'Q9_HasPanelFrameDamage', text: '9. Pano saç ve kaide çerçevesinde hasar veya arıza var mı?' },
  { id: 10, key: 'Q10_GroundingSystemAppropriate', text: '10. Panonun bütün aksamlarının toprak ile tertibatı uygun bir şekilde yapılmış mı?' },
  { id: 11, key: 'Q11_HasEquipotentialBusbar', text: '11. Panoda eşpotansiyel bara var mı?' },
  { id: 12, key: 'Q12_HasInternalLightingAndSocket', text: '12. Pano iç aydınlatma ve prizleri var mı?' },
  { id: 13, key: 'Q13_HasWarningLabelsAndInsulatedMat', text: '13. Pano iç-dış kapaklarında uyarı levhaları ve pano önünde izole halı var mı?' },
  { id: 14, key: 'Q14_FirePreventionSolutionCleaned', text: '14. Yangın önleyici solüsyon temizliği yapıldı mı?(6 Ayda 1)' },
  { id: 15, key: 'Q15_IsOccupationalHealthCompliant', text: '15. Pano iş sağlığı ve güvenliğine uygun mu?' },
  { id: 16, key: 'Q16_AreShuntReactorsActive', text: '16. Şönt reaktörleri devrede mi?' },
  { id: 17, key: 'Q17_AreCapacitorCurrentsNominal', text: '17. Kondansatör akımları nominal değerde mi?' },
  { id: 18, key: 'Q18_HasBlownCapacitor', text: '18. Şişmiş veya patlamış kondansatör var mı?' },
  { id: 19, key: 'Q19_HasDefectiveContactor', text: '19. Arızalı kontaktör var mı?' },
  { id: 20, key: 'Q20_AreCableCrossSectionsAppropriate', text: '20. Pano içerisindeki kablo kesitleri uygun seçilmiş mi? Kablolar sağlıklı mı?' },
  { id: 21, key: 'Q21_IsThermalCameraImagingDone', text: '21. Pano bütün aksamları için termal kamera görüntülemesi yapıldı mı?' },
  { id: 22, key: 'Q22_IsModemGprsOnline', text: '22. Modem haberleşme ışığı (gprs) online mı?' },
  { id: 23, key: 'Q23_IsRelayPowerFactorOne', text: '23. Röle güç faktörü 3 faz içinde 1 mi?' },
  { id: 24, key: 'Q24_HasRelayScreenWarning', text: '24. Röle ekranı uyarı mesajı vermiş mi?' },
  { id: 25, key: 'Q25_AreReactiveValuesBelowPenaltyLimit', text: '25. Reaktif değerleri ceza sınırının altında mı?' },
  { id: 26, key: 'Q26_AreOsosModemInfosRecorded', text: '26. Osos için kullanılan modem bilgileri kayıt altına alındı mı?' },
  { id: 27, key: 'Q27_HasActiveOsosInMeter', text: '27. Sayaçta osos var mı? Aktif mi?' },
  { id: 28, key: 'Q28_AreKakrAndToroidValuesAppropriate', text: '28. KAKR ve Toroid değerleri panoya uygun seçilmiş mi ve bağlantıları doğru yapılmış mı?' }
];

export default function Surveys() {
  const [searchTerm, setSearchTerm] = useState('');
  const [surveys, setSurveys] = useState<SurveyData[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setSearchSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [formQuestions, setFormQuestions] = useState<Record<string, boolean | null>>({});
  const [description, setDescription] = useState('');
  const [geoPosition, setGeoPosition] = useState({ lat: 39.92, lng: 32.85 });

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyData | null>(null);

  const { setFocusedMarkerPosition } = useOutletContext<{ setFocusedMarkerPosition: (pos: [number, number] | null) => void }>();

  const fetchSurveys = async () => {
    try {
      const response = await api.get('/surveys');
      setSurveys(response.data);
    } catch (error) {
      console.error("Anketler çekilemedi:", error);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/surveys');
        if (isMounted) setSurveys(response.data);
      } catch (error) {
        console.error(error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadInitialData();
    return () => { isMounted = false; };
  }, []);

  const handleOpenForm = () => {
    const emptyState: Record<string, boolean | null> = {};
    SURVEY_QUESTIONS.forEach(q => { emptyState[q.key] = null; });
    setFormQuestions(emptyState);
    setDescription('');
    setIsFormOpen(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeoPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn("GPS pasif, IP yedek planı devrede...", error);
          fetch('https://ipapi.co/json/')
            .then(res => res.json())
            .then(data => {
              if (data.latitude && data.longitude) {
                setGeoPosition({ lat: data.latitude, lng: data.longitude });
              }
            })
            .catch(err => console.error("IP servisleri engellendi:", err));
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  const handleRadioChange = (key: string, value: boolean) => {
    setFormQuestions(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const unanswered = SURVEY_QUESTIONS.filter(q => formQuestions[q.key] === null || formQuestions[q.key] === undefined);
    if (unanswered.length > 0) {
      alert(`Lütfen formu kaydetmeden önce tüm soruları cevaplayınız! \nEksik Soru Sayısı: ${unanswered.length}`);
      return;
    }

    setSearchSubmitting(true);
    try {
      await api.post('/surveys', {
        ...formQuestions,
        Description: description,
        latitude: geoPosition.lat,
        longitude: geoPosition.lng,
        Latitude: geoPosition.lat,
        Longitude: geoPosition.lng
      });
      setIsFormOpen(false);
      fetchSurveys();
    } catch (error) {
      console.error("Anket kaydedilemedi:", error);
    } finally {
      setSearchSubmitting(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Bu anket formunu silmek istediğinize emin misiniz şefim?")) return;
    try {
      await api.delete(`/surveys/${id}`);
      fetchSurveys();
    } catch (error) {
      console.error(error);
    }
  };

  const filteredSurveys = surveys.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col p-4 bg-white relative overflow-hidden">
      
      {/* ÜST PANEL */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
          <input 
            type="text" placeholder="Anket Ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-orange outline-none shadow-inner" 
          />
        </div>
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
            <input type="checkbox" className="rounded border-slate-300 text-brand-orange" />
            <span>Tümünü Seç</span>
          </label>
          <button type="button" onClick={handleOpenForm} className="px-3 py-1.5 bg-white border border-blue-500 text-blue-500 rounded-lg text-xs font-bold hover:bg-blue-50 transition shadow-sm">
            + Anket Ekle
          </button>
        </div>
        <div className="text-center text-[11px] font-bold text-slate-400 tracking-wide">
          Toplam Anket Sayısı : {filteredSurveys.length}
        </div>
      </div>

      {/* ANKET KARTLARI AKIŞI */}
      <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar pb-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center pt-16 space-y-2">
            <svg className="animate-spin h-6 w-6 text-brand-orange" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-[11px] font-bold text-slate-400 animate-pulse">Formlar Yükleniyor...</span>
          </div>
        ) : filteredSurveys.length === 0 ? (
          <p className="text-xs text-slate-400 text-center pt-10 font-medium">Kayıtlı anket formu bulunmuyor.</p>
        ) : (
          filteredSurveys.map((survey) => {
            const lat = survey.latitude ?? survey.Latitude;
            const lng = survey.longitude ?? survey.Longitude;
            
            return (
              <div 
                key={survey.id} 
                onClick={() => lat && lng && setFocusedMarkerPosition([Number(lat), Number(lng)])}
                className="bg-white rounded-xl p-3 border border-slate-200 border-l-[5px] border-l-lime-500 shadow-sm hover:shadow-md transition cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-2.5">
                    <input type="checkbox" className="mt-1 rounded border-slate-300 text-brand-orange" onClick={e => e.stopPropagation()} />
                    <div>
                      <h4 className="font-bold text-brand-navy text-sm group-hover:text-brand-orange transition-colors">{survey.status}</h4>
                      <p className="text-[11px] text-slate-400 font-bold mt-0.5">{survey.title}</p>
                      <span className="text-[10px] text-slate-400 block mt-1 font-medium">Tarih: {new Date(survey.createdAt).toLocaleDateString('tr-TR')}</span>
                    </div>
                  </div>
                  <span className="text-base bg-orange-50 p-1 rounded-lg border border-orange-100">📋</span>
                </div>
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100 text-xs font-bold pl-6">
                  <button type="button" onClick={(e) => handleDelete(survey.id, e)} className="text-rose-500 hover:underline">Sil</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedSurvey(survey); setIsDetailModalOpen(true); }} className="text-blue-500 bg-blue-50 px-3 py-1 rounded-md hover:bg-blue-100 transition">Detay</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Anket ekleme — merkez modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span className="text-blue-600">Trugo/Yeşil Pano Anket Formu</span>
                <span className="text-slate-400">›</span>
                <span className="text-brand-navy">Anket Ekle</span>
              </div>
              <button type="button" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-xl px-1">×</button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar text-xs">
          <div className="text-center bg-slate-50 p-3 rounded-xl border border-slate-100 shrink-0">
            <h2 className="font-extrabold text-brand-navy text-sm">Periyodik Bakım Servis Formu</h2>
            <p className="text-slate-500 text-[11px] font-semibold mt-0.5">Alçak Gerilim Periyodik Kontrol Bakım</p>
            <p className="text-[10px] text-emerald-600 font-bold mt-1">🌍 Canlı Konum (GPS/IP): {geoPosition.lat.toFixed(4)}, {geoPosition.lng.toFixed(4)}</p>
          </div>

          {SURVEY_QUESTIONS.map((q) => (
            <div key={q.id} className="space-y-2 border-b border-slate-100 pb-3">
              <label className="font-bold text-slate-700 leading-relaxed flex items-center gap-1.5">
                <span>{q.text}</span>
                <span className="text-slate-400 cursor-help font-normal text-[10px]" title="Bilgi">ℹ️</span>
              </label>
              <div className="flex gap-6 pl-2 font-semibold">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-brand-navy">
                  <input 
                    type="radio" 
                    name={q.key} 
                    checked={formQuestions[q.key] === true} 
                    onChange={() => handleRadioChange(q.key, true)}
                    className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500" 
                  />
                  <span>EVET</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-brand-navy">
                  <input 
                    type="radio" 
                    name={q.key} 
                    checked={formQuestions[q.key] === false} 
                    onChange={() => handleRadioChange(q.key, false)}
                    className="w-4 h-4 text-rose-600 border-slate-300 focus:ring-rose-500" 
                  />
                  <span>HAYIR</span>
                </label>
              </div>
            </div>
          ))}

          <div>
            <label className="font-bold text-slate-700 flex items-center gap-1 mb-1.5">
              <span>29. Açıklama (Opsiyonel)</span>
              <span className="text-slate-400 cursor-help font-normal text-[10px]" title="Bilgi">ℹ️</span>
            </label>
            <textarea 
              placeholder="Ekstra saha notu veya açıklama giriniz..." 
              rows={3} value={description} onChange={e => setDescription(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-brand-orange outline-none font-medium resize-none shadow-inner"
            />
          </div>

          <div className="flex justify-end gap-3 items-center pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50">İptal</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-md disabled:opacity-50">{isSubmitting ? '...' : '✓ Kaydet'}</button>
          </div>
            </form>
          </div>
        </div>
      )}

      {/* READ-ONLY DETAY MODALI */}
      {isDetailModalOpen && selectedSurvey && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fadeIn">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <h2 className="text-base font-bold text-brand-navy">📋 Rapor Kartı: {selectedSurvey.status}</h2>
              <button type="button" onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl">×</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs">
              
              {(() => {
                const modalLat = selectedSurvey.latitude ?? selectedSurvey.Latitude;
                const modalLng = selectedSurvey.longitude ?? selectedSurvey.Longitude;
                
                const hasValidLocation = modalLat !== undefined && modalLat !== null && Number(modalLat) !== 0;
                
                return (
                  <div className="bg-blue-50 text-blue-800 p-3 rounded-lg font-bold text-xs text-center border border-blue-100">
                    {selectedSurvey.title} - {selectedSurvey.subTitle} <br/>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Konum Kaydı: {hasValidLocation ? `${Number(modalLat).toFixed(4)}, ${Number(modalLng).toFixed(4)}` : 'Konum Tespit Edilemedi (Eski Kayıt)'}
                    </span>
                  </div>
                );
              })()}

              <div className="space-y-2.5 divide-y divide-slate-100">
                {SURVEY_QUESTIONS.map(q => {
                  // 🚀 REVIZYON VE EN KRİTİK FİX: .NET'ten gelen camelCase "q1_..." ile frontend'deki PascalCase "Q1_..." harf eşleşme köprüsü kuruldu!
                  const camelCaseKey = q.key.charAt(0).toLowerCase() + q.key.slice(1);
                  const surveyAnswer = selectedSurvey[q.key] ?? selectedSurvey[camelCaseKey];

                  return (
                    <div key={q.id} className="flex justify-between items-center py-2.5 font-medium">
                      <span className="text-slate-700 pr-4 leading-relaxed max-w-[80%]">{q.text}</span>
                      <span className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase shadow-sm shrink-0 ${
                        surveyAnswer === true ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {surveyAnswer === true ? '✓ EVET' : '❌ HAYIR'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mt-4">
                <label className="block font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-1">Saha Notları / Açıklama</label>
                <p className="text-slate-700 font-medium whitespace-pre-wrap">{selectedSurvey.description || 'Ekstra bir saha notu belirtilmemiştir.'}</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
              <button type="button" onClick={() => setIsDetailModalOpen(false)} className="bg-slate-700 text-white font-bold px-5 py-2 rounded-xl hover:bg-slate-800 transition">Kapat</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}