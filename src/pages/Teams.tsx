// src/pages/Teams.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../services/api';
import { formatTurkeyDateTime } from '../utils/dateTime';

interface TeamMemberData {
  id: string;
  name: string;
  username: string; 
  email: string;    
  project: string;
  projectIds: string[]; 
  plate: string;
  phone: string;
  teamLeader: string;
  // 🚀 YENİ ALANLAR ARAYÜZE TANITILDI
  address: string;
  city: string;
  district: string;
  position: [number, number];
  hasLiveLocation?: boolean;
  locationUpdatedAt?: string | null;
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

interface ProjectLookup {
  id: string;
  name: string;
}

interface TenantLookup {
  id: string;
  name: string;
}

interface AxiosErrorResponse {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export default function Teams() {
  const [searchTerm, setSearchTerm] = useState('');
  const [teams, setTeams] = useState<TeamMemberData[]>([]);
  const [allWorkOrders, setAllWorkOrders] = useState<AssignedWorkOrder[]>([]); 
  const [projects, setProjects] = useState<ProjectLookup[]>([]);
  const [globalTenants, setGlobalTenants] = useState<TenantLookup[]>([]); 
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamMemberData | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'jobs'>('details');
  const [isEditingModal, setIsEditingModal] = useState(false); 

  // 🚀 FORM STATE'İNE YENİ ALANLAR EKLENDİ
  const [formData, setFormData] = useState({
    name: '', username: '', email: '', password: '', phone: '', teamLeader: '', plate: '', address: '', city: '', district: '', tenantId: '', lat: 39.92077, lng: 32.85411
  });
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  // 🚀 DÜZENLEME STATE'İNE YENİ ALANLAR EKLENDİ
  const [editFormData, setEditFormData] = useState({
    name: '', username: '', email: '', password: '', phone: '', teamLeader: '', plate: '', address: '', city: '', district: '', lat: 39.92077, lng: 32.85411
  });
  const [editProjectIds, setEditProjectIds] = useState<string[]>([]);

  const { setFocusedMarkerPosition, refreshMapData } = useOutletContext<{
    setFocusedMarkerPosition: (pos: [number, number] | null) => void;
    refreshMapData: () => Promise<void>;
  }>();

  const [refreshingLocations, setRefreshingLocations] = useState(false);
  const [lastLocationRefresh, setLastLocationRefresh] = useState<Date | null>(null);

  const token = localStorage.getItem('token');
  let isSuperAdmin = false;
  if (token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      isSuperAdmin = payload.email === 'admin@theobuz.com';
    } catch (e) {
      console.error(e);
    }
  }

  const reloadDataForSubmit = useCallback(async () => {
    try {
      const [teamsRes, ordersRes, lookupsRes] = await Promise.all([
        api.get('/teams'),
        api.get('/workorders'),
        api.get('/teams/lookups')
      ]);

      setTeams(teamsRes.data);
      setAllWorkOrders(ordersRes.data);
      setProjects(lookupsRes.data);

      if (isSuperAdmin) {
        const tenantsRes = await api.get('/superadmin/tenants');
        setGlobalTenants(tenantsRes.data);
      }
    } catch (error) {
      console.error("Veri yenilenirken hata:", error);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    let isMounted = true;
    const initPageData = async () => {
      setIsLoading(true);
      try {
        const [teamsRes, ordersRes, lookupsRes] = await Promise.all([
          api.get('/teams'),
          api.get('/workorders'),
          api.get('/teams/lookups')
        ]);

        let tenantList: TenantLookup[] = [];
        if (isSuperAdmin) {
          const tenantsRes = await api.get('/superadmin/tenants');
          tenantList = tenantsRes.data;
        }

        if (isMounted) {
          setTeams(teamsRes.data);
          setAllWorkOrders(ordersRes.data);
          setProjects(lookupsRes.data);
          setGlobalTenants(tenantList);
        }
      } catch (error) {
        console.error("İlk yükleme hatası:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initPageData();
    return () => { isMounted = false; };
  }, [isSuperAdmin]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.post('/teams', {
        ...formData,
        latitude: formData.lat,
        longitude: formData.lng,
        projectIds: selectedProjectIds
      });
      setIsFormOpen(false);
      setFormData({ name: '', username: '', email: '', password: '', phone: '', teamLeader: '', plate: '', address: '', city: '', district: '', tenantId: '', lat: 39.92077, lng: 32.85411 });
      setSelectedProjectIds([]);
      await reloadDataForSubmit();
    } catch (err) {
      const error = err as AxiosErrorResponse;
      console.error(error);
      alert(error.response?.data?.message || "Ekip eklenemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    setIsSubmitting(true);
    try {
      await api.put(`/teams/${selectedTeam.id}`, {
        ...editFormData,
        latitude: editFormData.lat,
        longitude: editFormData.lng,
        projectIds: editProjectIds
      });
      setIsEditingModal(false);
      setIsDetailModalOpen(false);
      await reloadDataForSubmit(); 
    } catch (err) {
      const error = err as AxiosErrorResponse;
      console.error(error);
      alert(error.response?.data?.message || "Değişiklikler kaydedilemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshLocations = async () => {
    setRefreshingLocations(true);
    try {
      await reloadDataForSubmit();
      await refreshMapData();
      setLastLocationRefresh(new Date());
    } catch (error) {
      console.error('Canlı konumlar güncellenemedi:', error);
      alert('Canlı konumlar güncellenemedi. Lütfen tekrar deneyin.');
    } finally {
      setRefreshingLocations(false);
    }
  };

  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    team.plate.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const assignedJobs = allWorkOrders.filter(order => order.assignedToUserId === selectedTeam?.id);

  return (
    <div className="h-full flex flex-col p-4 bg-white relative overflow-hidden">
      
      <div className="mb-4 space-y-3">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
          <input 
            type="text" placeholder="Arama" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-orange outline-none shadow-inner" 
          />
        </div>
        
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 gap-3">
          <div className="text-[11px] text-slate-500 font-semibold">
            {lastLocationRefresh
              ? `Son güncelleme: ${lastLocationRefresh.toLocaleTimeString('tr-TR')}`
              : 'Canlı konum için Güncelle\'ye basın'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefreshLocations}
              disabled={refreshingLocations}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {refreshingLocations ? 'Güncelleniyor...' : '📍 Güncelle'}
            </button>
            <button onClick={() => setIsFormOpen(true)} className="px-4 py-2 bg-white border border-blue-500 text-blue-500 rounded-lg text-sm font-bold hover:bg-blue-50 transition">
              + Ekip Ekle
            </button>
          </div>
        </div>
      </div>

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
                {/* 🚀 LİSTEDE İL VE İLÇE GÖSTERİMİ */}
                <div className="flex"><span className="w-28 text-slate-400 font-bold">Bölge:</span><span className="flex-1 font-bold text-slate-600">{team.city !== '-' ? `${team.city} / ${team.district}` : 'Belirtilmemiş'}</span></div>
                <div className="flex items-center">
                  <span className="w-28 text-slate-400 font-bold">Canlı Konum:</span>
                  <span className={`flex-1 font-bold ${team.hasLiveLocation ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {team.hasLiveLocation
                      ? `Aktif${team.locationUpdatedAt ? ` · ${formatTurkeyDateTime(team.locationUpdatedAt)}` : ''}`
                      : 'Mobil uygulamadan henüz gelmedi'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end mt-3 pt-2 border-t border-slate-100 pl-7">
                <button 
                  onClick={(e) => {
                    e.stopPropagation(); 
                    setSelectedTeam(team);
                    
                    setEditFormData({
                      name: team.name,
                      username: team.username,
                      email: team.email,
                      password: '', 
                      phone: team.phone,
                      teamLeader: team.teamLeader === '-' ? '' : team.teamLeader,
                      plate: team.plate === '-' ? '' : team.plate,
                      address: team.address === '-' ? '' : team.address,
                      city: team.city === '-' ? '' : team.city,
                      district: team.district === '-' ? '' : team.district,
                      lat: team.position[0] || 39.92077,
                      lng: team.position[1] || 32.85411
                    });
                    setEditProjectIds(team.projectIds || []);

                    setActiveTab('details'); 
                    setIsEditingModal(false); 
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

      {/* SAĞDAN AÇILAN EKİP EKLEME FORMU */}
      <div className={`fixed top-20 right-0 bottom-0 bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.15)] border-l border-slate-200 transition-transform duration-300 z-40 flex flex-col ${isFormOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: '450px' }}>
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2"><span className="text-blue-600 font-bold text-sm">Ekip Formu</span><span className="text-slate-400">›</span><span className="font-bold text-brand-navy text-sm">Ekip Ekle</span></div>
          <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl px-2">×</button>
        </div>
        
        <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-sm pb-10">
          {isSuperAdmin && (
            <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-200 mb-2 animate-fadeIn">
              <label className="block text-xs font-bold text-orange-800 mb-1 uppercase tracking-wider">🏢 Hedef Firma Seçiniz (Super Admin Yetkisi)</label>
              <select required className="w-full border border-orange-300 rounded-lg p-2.5 bg-white text-xs font-bold focus:ring-2 focus:ring-brand-orange outline-none" value={formData.tenantId} onChange={e => setFormData({...formData, tenantId: e.target.value})}>
                <option value="">Firma Seçiniz...</option>
                {globalTenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Ad Soyad</label><input required placeholder="Ad Soyad" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Kullanıcı Adı</label><input required placeholder="Örn: utkuobuz" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} /></div>
            <div className="col-span-2"><label className="block text-xs font-bold text-slate-700 mb-1">E-Posta Adresi</label><input type="email" required placeholder="E-Posta Adresi" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Giriş Şifresi</label><input type="password" required placeholder="••••••••" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Telefon Numarası</label><input required placeholder="0555..." className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
          </div>

          <div className="flex gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner">
            <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Enlem (Lat)</label><input type="number" step="any" required className="w-full border border-slate-300 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-brand-orange/20 font-mono text-xs" value={formData.lat} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})} /></div>
            <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Boylam (Lng)</label><input type="number" step="any" required className="w-full border border-slate-300 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-brand-orange/20 font-mono text-xs" value={formData.lng} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value)})} /></div>
          </div>
          
          {/* 🚀 FORM: YENİ İL, İLÇE VE ADRES KUTULARI EKLENDİ */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex-1"><label className="block text-xs font-bold text-slate-700 mb-1">İl (Şehir)</label><input placeholder="Örn: Ankara" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
            <div className="flex-1"><label className="block text-xs font-bold text-slate-700 mb-1">İlçe</label><input placeholder="Örn: Çankaya" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} /></div>
            <div className="col-span-2"><label className="block text-xs font-bold text-slate-700 mb-1">Açık Adres</label><textarea rows={2} placeholder="Saha personelinin tam adresi..." className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Ekip Lideri (Opsiyonel)</label>
            <select className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 outline-none focus:ring-2 focus:ring-brand-orange/20" value={formData.teamLeader} onChange={e => setFormData({...formData, teamLeader: e.target.value})}>
              <option value="">Seçiniz (Atanmamış)</option>
              {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Bağlı Olacağı Projeler</label>
            <div className="w-full border border-slate-300 rounded-xl p-3 bg-slate-50 max-h-40 overflow-y-auto space-y-2.5 shadow-inner">
              {projects.map((proj) => (
                <label key={proj.id} className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-slate-700">
                  <input type="checkbox" className="w-4 h-4 rounded text-brand-orange border-slate-300" checked={selectedProjectIds.includes(proj.id)} onChange={() => setSelectedProjectIds(prev => prev.includes(proj.id) ? prev.filter(id => id !== proj.id) : [...prev, proj.id])} />
                  <span>{proj.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div><label className="block text-xs font-bold text-slate-700 mb-1">Araç Plakası (Opsiyonel)</label><input placeholder="Araç Plakası" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value})} /></div>

          <div className="flex justify-end gap-6 items-center pt-6 border-t mt-6">
            <button type="button" onClick={() => setIsFormOpen(false)} className="text-rose-500 font-bold hover:underline">İptal</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-md transition">{isSubmitting ? '...' : '✓ Kaydet'}</button>
          </div>
        </form>
      </div>

      {/* EDİTLENEBİLİR GELİŞMİŞ MERKEZ MODAL */}
      {isDetailModalOpen && selectedTeam && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <h2 className="text-base font-bold text-brand-navy">👤 Ekip Personel Kartı {isEditingModal && '› Düzenleme Modu'}</h2>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl transition-colors">×</button>
            </div>

            <div className="flex border-b border-slate-200 bg-slate-100/50 px-6 pt-2 shrink-0">
              <button disabled={isEditingModal} onClick={() => setActiveTab('details')} className={`px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px ${activeTab === 'details' ? 'border-brand-orange text-brand-orange bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Ekip Bilgileri</button>
              <button disabled={isEditingModal} onClick={() => setActiveTab('jobs')} className={`px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px ${activeTab === 'jobs' ? 'border-brand-orange text-brand-orange bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Atanmış İşler</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar text-xs">
              {activeTab === 'details' && (
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div className="bg-emerald-50 text-emerald-800 px-4 py-2 rounded-lg font-bold text-sm mb-4">👷 Personel: {selectedTeam.name}</div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Adı Soyadı</label>
                      <input required={isEditingModal} disabled={!isEditingModal} className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`} value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Kullanıcı Adı</label>
                      <input required={isEditingModal} disabled={!isEditingModal} className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`} value={editFormData.username} onChange={e => setEditFormData({...editFormData, username: e.target.value})} />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">E-Posta Adresi</label>
                      <input type="email" required={isEditingModal} disabled={!isEditingModal} className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`} value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Giriş Şifresi</label>
                      <input type="password" disabled={!isEditingModal} placeholder={isEditingModal ? "Değişmeyecekse boş bırakın" : "••••••••"} className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-400'}`} value={editFormData.password} onChange={e => setEditFormData({...editFormData, password: e.target.value})} />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Telefon Numarası</label>
                      <input required={isEditingModal} disabled={!isEditingModal} className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`} value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Ekip Lideri</label>
                      {isEditingModal ? (
                        <select className="w-full border border-blue-400 rounded-lg p-2.5 bg-white text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-100" value={editFormData.teamLeader} onChange={e => setEditFormData({...editFormData, teamLeader: e.target.value})}>
                          <option value="">Atanmamış</option>
                          {teams.filter(t => t.id !== selectedTeam.id).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                      ) : (
                        <input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-lg p-2.5 cursor-not-allowed" value={selectedTeam.teamLeader || 'Atanmamış'} />
                      )}
                    </div>

                    {/* 🚀 MODAL: YENİ İL, İLÇE VE ADRES KUTULARI EKLENDİ */}
                    <div className="col-span-2 flex gap-4">
                      <div className="flex-1">
                        <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider mt-1">İl (Şehir)</label>
                        <input disabled={!isEditingModal} className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`} value={editFormData.city} onChange={e => setEditFormData({...editFormData, city: e.target.value})} />
                      </div>
                      <div className="flex-1">
                        <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider mt-1">İlçe</label>
                        <input disabled={!isEditingModal} className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`} value={editFormData.district} onChange={e => setEditFormData({...editFormData, district: e.target.value})} />
                      </div>
                    </div>

                    <div className="col-span-2">
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider mt-1">Açık Adres</label>
                      {isEditingModal ? (
                        <textarea rows={2} className="w-full border border-blue-400 rounded-lg p-2.5 bg-white text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-100" value={editFormData.address} onChange={e => setEditFormData({...editFormData, address: e.target.value})} />
                      ) : (
                        <textarea disabled rows={2} className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-lg p-2.5 cursor-not-allowed resize-none" value={selectedTeam.address || '-'} />
                      )}
                    </div>

                    <div className="col-span-2 flex gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner mt-1">
                      <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Kayıtlı Enlem (Lat)</label><input type="number" step="any" required={isEditingModal} disabled={!isEditingModal} className={`w-full border rounded-lg p-2 font-semibold outline-none font-mono text-xs ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-600'}`} value={editFormData.lat} onChange={e => setEditFormData({...editFormData, lat: parseFloat(e.target.value)})} /></div>
                      <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Kayıtlı Boylam (Lng)</label><input type="number" step="any" required={isEditingModal} disabled={!isEditingModal} className={`w-full border rounded-lg p-2 font-semibold outline-none font-mono text-xs ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-600'}`} value={editFormData.lng} onChange={e => setEditFormData({...editFormData, lng: parseFloat(e.target.value)})} /></div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider mt-1">Araç Plakası</label>
                      <input disabled={!isEditingModal} className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`} value={editFormData.plate} onChange={e => setEditFormData({...editFormData, plate: e.target.value})} />
                    </div>

                    <div className="col-span-2">
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider mt-1">Bağlı Olduğu Projeler (Çoklu Seçim)</label>
                      {isEditingModal ? (
                        <div className="w-full border border-blue-400 rounded-xl p-3 bg-white max-h-36 overflow-y-auto space-y-2 shadow-inner">
                          {projects.map((proj) => (
                            <label key={proj.id} className="flex items-center gap-3 cursor-pointer text-xs font-semibold">
                              <input type="checkbox" className="w-4 h-4 rounded text-brand-orange" checked={editProjectIds.includes(proj.id)} onChange={() => setEditProjectIds(prev => prev.includes(proj.id) ? prev.filter(id => id !== proj.id) : [...prev, proj.id])} />
                              <span>{proj.name}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <textarea disabled rows={2} className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-lg p-2.5 cursor-not-allowed resize-none" value={selectedTeam.project} />
                      )}
                    </div>
                  </div>

                  {isEditingModal && (
                    <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-100">
                      <button type="button" onClick={() => setIsEditingModal(false)} className="bg-slate-400 text-white font-bold px-4 py-2 rounded-xl hover:bg-slate-500 transition">Vazgeç</button>
                      <button type="submit" disabled={isSubmitting} className="bg-emerald-600 text-white font-bold px-5 py-2 rounded-xl hover:bg-emerald-700 shadow transition">{isSubmitting ? '...' : 'Değişiklikleri Kaydet'}</button>
                    </div>
                  )}
                </form>
              )}

              {activeTab === 'jobs' && (
                <div className="space-y-3">
                  {assignedJobs.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 font-medium">📭 Bu ekip üyesine henüz atanmış bir iş emri bulunmuyor.</div>
                  ) : (
                    assignedJobs.map((job) => (
                      <div key={job.id} className="border border-slate-200 bg-slate-50 rounded-xl p-3 flex justify-between items-center shadow-sm">
                        <div className="space-y-1">
                          <h4 className="font-bold text-brand-navy text-sm">{job.customerName}</h4>
                          <p className="text-slate-500 text-[11px] font-medium">Özet: {job.title} | Tip: <span className="font-bold">{job.type}</span></p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold bg-white border border-slate-200 rounded px-1.5 py-0.5">{job.status}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between shrink-0">
              <div>
                {!isEditingModal && activeTab === 'details' && (
                  <button onClick={() => setIsEditingModal(true)} className="bg-blue-600 text-white font-bold px-5 py-2 rounded-xl hover:bg-blue-700 shadow transition">✏️ Ekibi Düzenle</button>
                )}
              </div>
              <button disabled={isSubmitting} onClick={() => setIsDetailModalOpen(false)} className="bg-slate-700 text-white font-bold px-6 py-2 rounded-xl hover:bg-slate-800 transition shadow">Kapat</button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}