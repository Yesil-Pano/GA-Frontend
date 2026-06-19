// src/pages/Teams.tsx
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../services/api';

interface TeamMemberData {
  id: string;
  name: string;
  project: string;
  plate: string;
  phone: string;
  teamLeader: string;
  position: [number, number];
}

interface AssignedWorkOrder {
  id: string;
  title: string;
  customerName: string;
  priority: string;
  status: string;
  type: string;
  plannedDate: string;
  assignedToUserId: string | null;
}

const PROJECT_LIST = [
  "Trugo Şarj İstasyonları",
  "Unilever Algida",
  "Astor",
  "Yeşil Pano Projesi"
];

export default function Teams() {
  const [searchTerm, setSearchTerm] = useState('');
  const [teams, setTeams] = useState<TeamMemberData[]>([]);
  const [allWorkOrders, setAllWorkOrders] = useState<AssignedWorkOrder[]>([]); 
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🌀 EKİPLER İÇİN CANLI LOADING STATE
  const [isLoading, setIsLoading] = useState(true);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamMemberData | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'jobs'>('details');

  const [formData, setFormData] = useState({
    name: '', phone: '', teamLeader: '', project: PROJECT_LIST[0], plate: ''
  });

  const { setFocusedMarkerPosition } = useOutletContext<{ setFocusedMarkerPosition: (pos: [number, number] | null) => void }>();

  const fetchTeamsData = async () => {
    try {
      const [teamsRes, ordersRes] = await Promise.all([
        api.get('/teams'),
        api.get('/workorders')
      ]);
      return { teams: teamsRes.data, orders: ordersRes.data };
    } catch (error) {
      console.error("Veriler yüklenirken hata oluştu:", error);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      setIsLoading(true); // Spinner'ı döndür
      const data = await fetchTeamsData();
      if (isMounted && data) {
        setTeams(data.teams);
        setAllWorkOrders(data.orders);
      }
      if (isMounted) setIsLoading(false); // Veri akışı bitince kapat
    };
    loadInitialData();
    return () => { isMounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.post('/teams', formData);
      setIsFormOpen(false);
      setFormData({ name: '', phone: '', teamLeader: '', project: PROJECT_LIST[0], plate: '' });
      
      const data = await fetchTeamsData();
      if (data) {
        setTeams(data.teams);
        setAllWorkOrders(data.orders);
      }
    } catch (error) {
      console.error("Kayıt hatası:", error);
      alert("Ekip eklenemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    team.plate.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const assignedJobs = allWorkOrders.filter(order => order.assignedToUserId === selectedTeam?.id);

  return (
    <div className="h-full flex flex-col p-4 bg-white relative overflow-hidden">
      
      {/* ÜST ARAMA PANELİ */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
          <input 
            type="text" placeholder="Arama" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-orange outline-none shadow-inner" 
          />
        </div>
        
        <div className="flex justify-end items-center pb-3 border-b border-slate-100">
          <button onClick={() => setIsFormOpen(true)} className="px-4 py-2 bg-white border border-blue-500 text-blue-500 rounded-lg text-sm font-bold hover:bg-blue-50 transition">
            + Ekip Ekle
          </button>
        </div>
        
        <div className="text-center text-xs text-slate-500 font-bold tracking-wide">
          Toplam Ekip Sayısı : {filteredTeams.length}
        </div>
      </div>

      {/* EKİP KARTLARI LİSTESİ */}
      <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar pb-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center pt-20 space-y-3">
            <svg className="animate-spin h-8 w-7 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-xs font-bold text-slate-400 tracking-wide animate-pulse">Ekipler Yükleniyor...</span>
          </div>
        ) : filteredTeams.length === 0 ? (
          <p className="text-sm text-slate-400 text-center mt-10">Kayıtlı ekip bulunmuyor.</p>
        ) : (
          filteredTeams.map((team) => (
            <div 
              key={team.id}
              onClick={() => team.position && setFocusedMarkerPosition([...team.position])}
              className="bg-white rounded-xl shadow-md border border-slate-200 border-l-[6px] border-l-[#B4D334] p-4 cursor-pointer hover:shadow-lg transition relative group"
            >
              <div className="flex justify-between items-start mb-2">
                <label className="flex items-center gap-3 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-orange" />
                  <span className="font-bold text-brand-navy text-base group-hover:text-brand-orange transition-colors">{team.name}</span>
                </label>
                <span className="text-xl">📇</span>
              </div>

              <div className="space-y-1 text-xs text-slate-700 font-medium pl-7">
                <div className="flex"><span className="w-28 text-slate-400 font-bold">Proje:</span><span className="truncate flex-1 font-bold text-slate-600" title={team.project}>{team.project}</span></div>
                <div className="flex"><span className="w-28 text-slate-400 font-bold">Araç Plakası:</span><span className="flex-1 font-bold text-slate-600">{team.plate || 'Atanmamış'}</span></div>
                <div className="flex"><span className="w-28 text-slate-400 font-bold">Telefon Numarası:</span><span className="flex-1 font-bold text-slate-600">{team.phone}</span></div>
              </div>

              <div className="flex justify-end mt-3 pt-2 border-t border-slate-100 pl-7">
                <button 
                  onClick={(e) => {
                    e.stopPropagation(); 
                    setSelectedTeam(team);
                    setActiveTab('details'); 
                    setIsDetailModalOpen(true);
                  }}
                  className="text-xs text-blue-600 bg-blue-50 px-4 py-1.5 rounded-lg hover:bg-blue-100 transition font-bold shadow-sm"
                >
                  🔎 Detay
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* SAĞDAN AÇILAN GELİŞMİŞ FORM PANELİ */}
      <div className={`fixed top-20 right-0 bottom-0 bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.15)] border-l border-slate-200 transition-transform duration-300 z-40 flex flex-col ${isFormOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: '450px' }}>
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2"><span className="text-blue-600 font-bold text-sm">Ekip Formu</span><span className="text-slate-400">›</span><span className="font-bold text-brand-navy text-sm">Ekip Ekle</span></div>
          <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl px-2">×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-sm pb-10">
          <div><label className="block text-xs font-bold text-slate-700 mb-1">Ad Soyad</label><input required placeholder="Ad Soyad" className="w-full border rounded-lg p-2.5" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">Telefon Numarası</label><input required placeholder="0" className="w-full border rounded-lg p-2.5" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Ekip Lideri (Opsiyonel)</label>
            <select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.teamLeader} onChange={e => setFormData({...formData, teamLeader: e.target.value})}>
              <option value="">Seçiniz (Atanmamış)</option>
              {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Proje</label>
            <select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.project} onChange={e => setFormData({...formData, project: e.target.value})}>
              {PROJECT_LIST.map((p, idx) => <option key={idx} value={p}>{p}</option>)}
            </select>
          </div>

          <div><label className="block text-xs font-bold text-slate-700 mb-1">Araç Plakası (Opsiyonel)</label><input placeholder="Araç Plakası" className="w-full border rounded-lg p-2.5" value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value})} /></div>

          <div className="flex justify-end gap-6 items-center pt-6 border-t mt-6">
            <button type="button" onClick={() => setIsFormOpen(false)} className="text-rose-500 font-bold hover:underline">İptal</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-md transition">{isSubmitting ? '...' : '✓ Kaydet'}</button>
          </div>
        </form>
      </div>

      {/* 🚀 2 SEKMELİ MERKEZ DETAY MODALI */}
      {isDetailModalOpen && selectedTeam && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fadeIn">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-bold text-brand-navy">👤 Ekip Personel Detay Kartı</h2>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl transition-colors">×</button>
            </div>

            <div className="flex border-b border-slate-200 bg-slate-100/50 px-6 pt-2">
              <button onClick={() => setActiveTab('details')} className={`px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px ${activeTab === 'details' ? 'border-brand-orange text-brand-orange bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Ekip Bilgileri</button>
              <button onClick={() => setActiveTab('jobs')} className={`px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-1.5 ${activeTab === 'jobs' ? 'border-brand-orange text-brand-orange bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Atanmış İşler <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'jobs' ? 'bg-orange-100 text-brand-orange' : 'bg-slate-200 text-slate-600'}`}>{assignedJobs.length}</span></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar text-xs">
              {activeTab === 'details' && (
                <div className="space-y-4">
                  <div className="bg-emerald-50 text-emerald-800 px-4 py-2 rounded-lg font-bold text-sm mb-2">👷 Personel: {selectedTeam.name}</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Telefon Numarası</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-lg p-2.5 cursor-not-allowed" value={selectedTeam.phone} /></div>
                    <div><label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Ekip Lideri</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-lg p-2.5 cursor-not-allowed" value={selectedTeam.teamLeader || 'Atanmamış'} /></div>
                    <div className="col-span-2"><label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Bağlı Olduğu Projeler</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-lg p-2.5 cursor-not-allowed" value={selectedTeam.project} /></div>
                    <div><label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Araç Plakası</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-lg p-2.5 cursor-not-allowed" value={selectedTeam.plate || 'Plaka Belirtilmemiş'} /></div>
                    <div><label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Kayıtlı Konum (Lat, Lng)</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-500 font-mono rounded-lg p-2.5 cursor-not-allowed" value={`${selectedTeam.position[0]}, ${selectedTeam.position[1]}`} /></div>
                  </div>
                </div>
              )}

              {activeTab === 'jobs' && (
                <div className="space-y-3">
                  {assignedJobs.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 font-medium">📭 Bu ekip üyesine henüz atanmış bir iş emri bulunmuyor.</div>
                  ) : (
                    assignedJobs.map((job) => (
                      <div key={job.id} className="border border-slate-200 bg-slate-50 rounded-xl p-3 flex justify-between items-center hover:border-brand-orange transition shadow-sm">
                        <div className="space-y-1">
                          <h4 className="font-bold text-brand-navy text-sm">{job.customerName}</h4>
                          <p className="text-slate-500 text-[11px] font-medium">Özet: {job.title} | Tip: <span className="font-bold">{job.type}</span></p>
                          <p className="text-slate-400 text-[10px]">Planlanan Tarih: {job.plannedDate}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${job.priority === 'Acil' ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-orange-100 text-brand-orange'}`}>{job.priority}</span>
                          <span className="text-[10px] text-slate-400 font-semibold bg-white border border-slate-200 rounded px-1.5 py-0.5">{job.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button onClick={() => setIsDetailModalOpen(false)} className="bg-slate-700 text-white font-bold px-6 py-2 rounded-xl hover:bg-slate-800 transition shadow">Kapat</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}