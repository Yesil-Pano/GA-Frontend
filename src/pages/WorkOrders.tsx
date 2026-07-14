// src/pages/WorkOrders.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../services/api';

interface WorkOrderData {
  id: string;
  title: string;
  customerName: string;
  priority: string;
  status: string;
  type: string;
  category: string;
  description: string;
  mobileDescription: string;
  address: string;
  startDate: string;
  endDate: string;
  position: [number, number];
  operationUserId?: string | null;
  operationUserName: string;
  openedByUserId?: string | null;
  openedByUserName: string;
  assignedToUserId?: string | null;
  assignedToUserName: string;
  fieldNote?: string | null;
  fieldNoteAddedAt?: string | null;
  isPeriodic?: boolean;
  recurrenceInterval?: string;
}

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return '';
  return value.replace(' ', 'T').slice(0, 16);
};

/** datetime-local için bugünün yerel tarihi (YYYY-MM-DDTHH:mm) */
const todayDateTimeLocal = (hour: number, minute = 0) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
};

interface OrderPhoto {
  id: string;
  fileName: string;
  url: string;
  category: 'ISG' | 'OPERASYON' | 'DIGER';
}

interface StationLookup {
  id: string;
  name: string;
  address?: string;
  city?: string;
  district?: string | null;
  cityId?: string | null;
  districtId?: string | null;
  ownerCompany?: string | null;
  tenantId?: string;
  latitude: number;
  longitude: number;
}

interface ProjectLookup {
  id: string;
  name: string;
  tenantId: string;
}

interface LookupData {
  personnel: { id: string; fullName: string }[];
  types: string[];
  categories: string[];
  stations: StationLookup[];
  projects: ProjectLookup[];
}

export default function WorkOrders() {
  const [filter, setFilter] = useState('Tümü');
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<WorkOrderData[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [lookups, setLookups] = useState<LookupData>({ 
    personnel: [], 
    types: ['Arıza', 'Bakım', 'Kurulum', 'Keşif', 'Saha Operasyonu'], 
    categories: ['Arıza Bildirimi', 'Periyodik Bakım', 'Devreye Alma', 'Altyapı İncelemesi'],
    stations: [],
    projects: [],
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrderData | null>(null);
  const [orderPhotos, setOrderPhotos] = useState<OrderPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const photoUrlsRef = useRef<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [assignUserId, setAssignUserId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    customerName: '',
    priority: 'Orta',
    type: 'Arıza',
    category: 'Arıza Bildirimi',
    startDate: '',
    endDate: '',
    lat: 0,
    lng: 0,
    description: '',
    mobileDescription: '',
    address: '',
    operationUserId: '',
    openedByUserId: '',
    assignedToUserId: '',
    isPeriodic: false,
    recurrenceInterval: 'Haftalik',
  });

  const [formData, setFormData] = useState({
    title: '', customerName: '', description: '', mobileDescription: '', address: '',
    priority: 'Orta', workType: 'Arıza', workCategory: 'Arıza Bildirimi',
    startDate: todayDateTimeLocal(9), endDate: todayDateTimeLocal(18), lat: 39.92, lng: 32.85,
    operationUserId: '', openedByUserId: '', assignedToUserId: '',
    isPeriodic: false, recurrenceInterval: 'None',
    projectId: '', stationId: '', cityId: '', districtId: '',
  });

  const { setFocusedMarkerPosition, refreshMapData } = useOutletContext<{
    setFocusedMarkerPosition: (pos: [number, number] | null) => void;
    refreshMapData: () => Promise<void>;
  }>();

  const filteredOrders = orders
    .filter(order => {
      if (filter === 'Tümü') return true;
      if (filter === 'Atanmamış') return !order.assignedToUserName || order.assignedToUserName === '' || order.assignedToUserName === 'Atanmamış';
      if (filter === 'Tamamlanan') return order.status === 'Tamamlandı';
      if (filter === 'İptal Edilen') return order.status === 'İptal Edildi';
      return order.status === filter;
    })
    .filter(order => searchTerm === '' || order.title.toLowerCase().includes(searchTerm.toLowerCase()) || order.customerName.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedOrders([]); 
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id)); 
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedOrders.includes(id)) setSelectedOrders(prev => prev.filter(orderId => orderId !== id));
    else setSelectedOrders(prev => [...prev, id]);
  };

  const fetchOrders = async () => {
    try {
      const response = await api.get('/workorders');
      setOrders(response.data);
    } catch (error) {
      console.error("Veriler çekilemedi:", error);
    }
  };

  const revokePhotoUrls = () => {
    photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    photoUrlsRef.current = [];
  };

  const loadOrderPhotos = async (workOrderId: string) => {
    setLoadingPhotos(true);
    revokePhotoUrls();
    setOrderPhotos([]);
    try {
      const { data } = await api.get<Array<{ id: string; fileName: string; description?: string | null }>>(`/photos/WorkOrder/${workOrderId}`);
      const loaded = await Promise.all(
        data.map(async (photo) => {
          const res = await api.get(`/photos/${photo.id}/image`, { responseType: 'blob' });
          const url = URL.createObjectURL(res.data);
          photoUrlsRef.current.push(url);
          const categoryValue = (photo.description ?? '').trim().toUpperCase();
          const category: OrderPhoto['category'] =
            categoryValue === 'ISG' ? 'ISG' : categoryValue === 'OPERASYON' ? 'OPERASYON' : 'DIGER';
          return {
            id: photo.id,
            fileName: photo.fileName,
            url,
            category,
          };
        }),
      );
      setOrderPhotos(loaded);
    } catch (error) {
      console.error('Fotoğraflar yüklenemedi:', error);
      setOrderPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const openDetailModal = (order: WorkOrderData) => {
    setSelectedOrder(order);
    setAssignUserId(order.assignedToUserId || '');
    setIsEditingDetail(false);
    setEditFormData({
      title: order.title || '',
      customerName: order.customerName || '',
      priority: order.priority || 'Orta',
      type: order.type || 'Arıza',
      category: order.category || 'Arıza Bildirimi',
      startDate: toDateTimeLocal(order.startDate),
      endDate: toDateTimeLocal(order.endDate),
      lat: order.position?.[0] ?? 0,
      lng: order.position?.[1] ?? 0,
      description: order.description || '',
      mobileDescription: order.mobileDescription || '',
      address: order.address || '',
      operationUserId: order.operationUserId || '',
      openedByUserId: order.openedByUserId || '',
      assignedToUserId: order.assignedToUserId || '',
      isPeriodic: !!order.isPeriodic,
      recurrenceInterval: order.recurrenceInterval && order.recurrenceInterval !== 'None'
        ? order.recurrenceInterval
        : 'Haftalik',
    });
    setIsDetailModalOpen(true);
    loadOrderPhotos(order.id);
  };

  const closeDetailModal = () => {
    revokePhotoUrls();
    setOrderPhotos([]);
    setIsDetailModalOpen(false);
    setSelectedOrder(null);
    setAssignUserId('');
    setIsEditingDetail(false);
  };

  const handleSaveDetail = async () => {
    if (!selectedOrder) return;
    if (!editFormData.title.trim()) {
      alert('Başlık zorunludur.');
      return;
    }
    setIsSavingDetail(true);
    try {
      const { data } = await api.put(`/workorders/${selectedOrder.id}`, {
        title: editFormData.title,
        customerName: editFormData.customerName,
        description: editFormData.description,
        mobileDescription: editFormData.mobileDescription,
        address: editFormData.address,
        priority: editFormData.priority,
        type: editFormData.type,
        category: editFormData.category,
        startDate: new Date(editFormData.startDate).toISOString(),
        endDate: new Date(editFormData.endDate).toISOString(),
        latitude: Number(editFormData.lat),
        longitude: Number(editFormData.lng),
        operationUserId: editFormData.operationUserId || null,
        openedByUserId: editFormData.openedByUserId || null,
        assignedToUserId: editFormData.assignedToUserId || null,
        isPeriodic: editFormData.isPeriodic,
        recurrenceInterval: editFormData.isPeriodic ? editFormData.recurrenceInterval : 'None',
      });

      const updated: WorkOrderData = {
        ...selectedOrder,
        title: data.title,
        customerName: data.customerName,
        description: data.description,
        mobileDescription: data.mobileDescription,
        address: data.address,
        priority: data.priority,
        type: data.type,
        category: data.category,
        startDate: data.startDate,
        endDate: data.endDate,
        position: data.position,
        operationUserId: data.operationUserId,
        operationUserName: data.operationUserName,
        openedByUserId: data.openedByUserId,
        openedByUserName: data.openedByUserName,
        assignedToUserId: data.assignedToUserId,
        assignedToUserName: data.assignedToUserName,
        isPeriodic: data.isPeriodic,
        recurrenceInterval: data.recurrenceInterval,
      };

      setSelectedOrder(updated);
      setAssignUserId(updated.assignedToUserId || '');
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
      setIsEditingDetail(false);
      await refreshMapData();
      if (updated.position) {
        setFocusedMarkerPosition([...updated.position]);
      }
      alert(data.message || 'İş emri güncellendi.');
    } catch (error) {
      console.error('Güncelleme başarısız:', error);
      alert('İş emri kaydedilemedi.');
    } finally {
      setIsSavingDetail(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedOrder) return;
    setIsAssigning(true);
    try {
      const { data } = await api.put<{
        message: string;
        assignedToUserId: string | null;
        assignedToUserName: string;
      }>(`/workorders/${selectedOrder.id}/assign`, {
        assignedToUserId: assignUserId || null,
      });

      const updated: WorkOrderData = {
        ...selectedOrder,
        assignedToUserId: data.assignedToUserId,
        assignedToUserName: data.assignedToUserName,
      };
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
      alert(data.message || 'Atama güncellendi.');
    } catch (error) {
      console.error('Atama başarısız:', error);
      alert('Personel ataması yapılamadı.');
    } finally {
      setIsAssigning(false);
    }
  };

  const filteredStationsForForm = lookups.stations.filter((station) => {
    if (!formData.projectId) return true;
    const project = lookups.projects.find((p) => p.id === formData.projectId);
    if (!project) return true;

    const tokens = project.name
      .split(/[\s\-/]+/)
      .map((t) => t.toLowerCase())
      .filter((t) => t.length >= 3);

    const tenantMatch = station.tenantId === project.tenantId;
    if (!tokens.length) return tenantMatch;

    const owner = (station.ownerCompany || '').toLowerCase();
    const name = (station.name || '').toLowerCase();
    const ownershipMatch = tokens.some((token) => owner.includes(token) || name.includes(token));
    return ownershipMatch || tenantMatch;
  });

  const handleStationSelect = (stationId: string) => {
    const station = lookups.stations.find((s) => s.id === stationId);
    if (!station) {
      setFormData((prev) => ({ ...prev, stationId: '', cityId: '', districtId: '' }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      stationId,
      customerName: station.name,
      address: station.address || prev.address,
      lat: station.latitude,
      lng: station.longitude,
      title: prev.title || `${station.name} iş emri`,
      cityId: station.cityId || '',
      districtId: station.districtId || '',
    }));
  };

  useEffect(() => () => revokePhotoUrls(), []);

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const [ordersRes, lookupsRes] = await Promise.all([
          api.get('/workorders'),
          api.get('/workorders/lookups')
        ]);
        
        if (isMounted) {
          setOrders(ordersRes.data);
          
          const backendData = lookupsRes.data || {};
          const mappedPersonnel = backendData.teams
            ? backendData.teams.map((t: { id: string; name: string }) => ({ id: t.id, fullName: t.name }))
            : [];
          const mappedStations: StationLookup[] = (backendData.stations || []).map(
            (s: {
              id: string;
              name: string;
              address?: string;
              city?: string;
              district?: string | null;
              cityId?: string | null;
              districtId?: string | null;
              ownerCompany?: string | null;
              tenantId?: string;
              latitude: number;
              longitude: number;
            }) => ({
              id: s.id,
              name: s.name,
              address: s.address,
              city: s.city,
              district: s.district,
              cityId: s.cityId,
              districtId: s.districtId,
              ownerCompany: s.ownerCompany,
              tenantId: s.tenantId,
              latitude: s.latitude,
              longitude: s.longitude,
            }),
          );
          const mappedProjects: ProjectLookup[] = (backendData.projects || []).map(
            (p: { id: string; name: string; tenantId: string }) => ({
              id: p.id,
              name: p.name,
              tenantId: p.tenantId,
            }),
          );

          setLookups({
            personnel: mappedPersonnel,
            types: ['Arıza', 'Bakım', 'Kurulum', 'Keşif', 'Saha Operasyonu'],
            categories: ['Arıza Bildirimi', 'Periyodik Bakım', 'Devreye Alma', 'Altyapı İncelemesi'],
            stations: mappedStations,
            projects: mappedProjects,
          });

          if (mappedPersonnel.length > 0) {
            setFormData(prev => ({
              ...prev,
              operationUserId: mappedPersonnel[0].id,
              openedByUserId: mappedPersonnel[0].id,
              assignedToUserId: '',
            }));
          }
        }
      } catch (error) {
        console.error("Veri yükleme hatası:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadInitialData();
    return () => { isMounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // 🚀 ZIRH: BÜTÜN EKSİK ALANLAR API'YE EKLENDİ
      await api.post('/workorders', {
        title: formData.title, 
        customerName: formData.customerName, 
        description: formData.description,
        mobileDescription: formData.mobileDescription, 
        address: formData.address, 
        priority: formData.priority,
        type: formData.workType, 
        category: formData.workCategory,
        startDate: new Date(formData.startDate).toISOString(), 
        endDate: new Date(formData.endDate).toISOString(),
        latitude: Number(formData.lat), 
        longitude: Number(formData.lng),
        operationUserId: formData.operationUserId || null, 
        openedByUserId: formData.openedByUserId || null, 
        assignedToUserId: formData.assignedToUserId || null,
        isPeriodic: formData.isPeriodic, 
        recurrenceInterval: formData.recurrenceInterval,
        stationId: formData.stationId || null,
        cityId: formData.cityId || null,
        districtId: formData.districtId || null,
      });
      setIsFormOpen(false);
      await fetchOrders();
      await refreshMapData();
      setFocusedMarkerPosition([Number(formData.lat), Number(formData.lng)]);
    } catch (error) {
      console.error("Kayıt hatası:", error);
      alert("İş emri kaydedilemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 bg-slate-50 relative overflow-hidden min-w-0">
      
      <h1 className="text-2xl font-extrabold text-brand-navy mb-4">İş Emirleri</h1>

      <div className="w-full min-w-0 bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4 space-y-3 overflow-hidden">
        <input
          type="text"
          placeholder="İş emri veya nokta ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full min-w-0 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
        />
        <div className="flex gap-2 items-center min-w-0">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="min-w-0 flex-1 border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-orange bg-slate-50 cursor-pointer"
          >
            <option value="Tümü">Tüm İşler</option>
            <option value="Bekliyor">Bekliyor</option>
            <option value="Devam Ediyor">Devam Ediyor</option>
            <option value="Tamamlanan">Tamamlanan</option>
            <option value="İptal Edilen">İptal Edilen</option>
            <option value="Atanmamış">Atanmamış İşler</option>
          </select>
          <button
            onClick={() => {
              setFormData((prev) => ({
                ...prev,
                startDate: todayDateTimeLocal(9),
                endDate: todayDateTimeLocal(18),
              }));
              setIsFormOpen(true);
            }}
            className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors shadow-sm whitespace-nowrap text-sm"
          >
            + İş Emri Ekle
          </button>
        </div>
      </div>

      {selectedOrders.length > 0 && (
        <div className="bg-brand-navy text-white px-5 py-3 rounded-xl mb-4 flex justify-between items-center shadow-md">
          <span className="font-bold text-sm">{selectedOrders.length} iş emri seçildi</span>
          <div className="flex gap-3">
            <button className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg text-xs font-bold transition-colors">✓ Toplu Onayla</button>
            <button className="bg-rose-500 hover:bg-rose-600 px-4 py-2 rounded-lg text-xs font-bold transition-colors">🗑 Toplu Sil</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-3 px-2">
        <input type="checkbox" className="w-5 h-5 cursor-pointer accent-brand-orange" checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0} onChange={handleSelectAll} />
        <span className="text-sm font-bold text-slate-600">Tümünü Seç</span>
      </div>
      
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 pb-4 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center pt-20 space-y-3">
            <svg className="animate-spin h-8 w-7 text-brand-orange" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span className="text-xs font-bold text-slate-400 tracking-wide animate-pulse">İş Emirleri Yükleniyor...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <p className='text-sm text-slate-500 text-center mt-10'>Aranan kriterde iş emri bulunamadı.</p>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.id} onClick={() => order.position && setFocusedMarkerPosition([...order.position])} className={`cursor-pointer bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative flex items-center gap-4 transition-all hover:border-brand-orange hover:shadow-md ${order.priority === 'Acil' ? 'border-l-4 border-l-rose-600' : ''}`}>
              <input type="checkbox" className="w-5 h-5 cursor-pointer accent-brand-orange shrink-0" checked={selectedOrders.includes(order.id)} onChange={(e) => { e.stopPropagation(); handleSelectOne(order.id); }} />
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-brand-navy mb-2 truncate">Nokta Adı: {order.customerName || order.title}</h3>
                <div className="flex flex-col gap-1.5 text-xs mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-500 font-medium shrink-0 w-18">İş Tipi</span>
                    <span className="text-slate-800 font-bold truncate">{order.type || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-500 font-medium shrink-0 w-18">Öncelik</span>
                    <span className={`font-bold truncate ${order.priority === 'Acil' ? 'text-rose-600' : 'text-slate-700'}`}>{order.priority || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-500 font-medium shrink-0 w-18">Durum</span>
                    <span className="font-bold text-blue-600 truncate">{order.status || '-'}</span>
                  </div>
                </div>
                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button onClick={(e) => { e.stopPropagation(); openDetailModal(order); }} className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition shadow-sm">🔎 Detayları Gör</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={`fixed top-20 right-0 bottom-0 bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.15)] border-l border-slate-200 transition-transform duration-300 z-40 flex flex-col ${isFormOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: '450px' }}>
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2"><span className="text-emerald-600 font-bold">Formu</span><span className="text-slate-400">›</span><span className="font-bold text-brand-navy text-sm truncate max-w-50">{formData.customerName || 'Yeni İş Emri'}</span></div>
          <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl px-2">×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-sm pb-10">
          <div className="space-y-3 bg-amber-50/60 p-4 rounded-xl border border-amber-100">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Nokta / Proje Seçimi</h4>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Proje (nokta filtresi)</label>
              <select
                className="w-full border border-slate-300 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-brand-orange"
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value, stationId: '' })}
              >
                <option value="">Tüm projeler / noktalar</option>
                {lookups.projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Saha Noktası *</label>
              <select
                required
                className="w-full border border-slate-300 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-brand-orange"
                value={formData.stationId}
                onChange={(e) => handleStationSelect(e.target.value)}
              >
                <option value="">Nokta seçiniz...</option>
                {filteredStationsForForm.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.city ? ` · ${s.city}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                Nokta seçince müşteri adı, adres ve koordinat otomatik dolar.
              </p>
            </div>
          </div>

          <div><label className="block text-xs font-bold text-slate-700 mb-1">İş Tipi</label><select className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:ring-2 focus:ring-brand-orange outline-none" value={formData.workType} onChange={e => setFormData({...formData, workType: e.target.value})}>{lookups.types.map((t, idx) => <option key={idx} value={t}>{t}</option>)}</select></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">İş Kategorisi</label><select className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:ring-2 focus:ring-brand-orange outline-none" value={formData.workCategory} onChange={e => setFormData({...formData, workCategory: e.target.value})}>{lookups.categories.map((c, idx) => <option key={idx} value={c}>{c}</option>)}</select></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">İş Öncelik Tipi</label><select className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:ring-2 focus:ring-brand-orange outline-none" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}><option>Düşük</option><option>Orta</option><option>Acil</option></select></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">Başlık / İş Özeti</label><input required className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand-orange outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">Müşteri / Pano Adı</label><input required className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand-orange outline-none" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} /></div>
          
          <div className="flex gap-4">
            <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Planlanan Başlangıç</label><input type="datetime-local" className="w-full border border-slate-300 rounded-lg p-2.5" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} /></div>
            <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Planlanan Bitiş</label><input type="datetime-local" className="w-full border border-slate-300 rounded-lg p-2.5" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} /></div>
          </div>
          <div className="flex gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Enlem (Lat)</label><input type="number" step="any" required className="w-full border border-slate-300 rounded-lg p-2 bg-white" value={formData.lat} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})} /></div>
            <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Boylam (Lng)</label><input type="number" step="any" required className="w-full border border-slate-300 rounded-lg p-2 bg-white" value={formData.lng} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value)})} /></div>
          </div>
          <div><label className="block text-xs font-bold text-slate-600 mb-1">Genel Açıklama</label><textarea className="w-full border border-slate-300 rounded-lg p-2.5" rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-600 mb-1">Mühendis Açıklaması</label><textarea className="w-full border border-slate-300 rounded-lg p-2.5" rows={2} value={formData.mobileDescription} onChange={e => setFormData({...formData, mobileDescription: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-600 mb-1">Tam Açık Adres</label><textarea required className="w-full border border-slate-300 rounded-lg p-2.5" rows={2} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
          
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 space-y-3">
            <label className="flex items-center gap-2 font-bold text-emerald-800 text-xs cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500" checked={formData.isPeriodic} onChange={e => setFormData({...formData, isPeriodic: e.target.checked})} />
              <span>Bu Bir Periyodik İş Emridir (Otomatik Tekrarlansın)</span>
            </label>
            {formData.isPeriodic && (
              <div>
                <label className="block text-[11px] font-bold text-emerald-700 mb-1">Tekrarlanma Döngüsü Sıklığı</label>
                <select className="w-full border border-emerald-200 rounded-lg p-2 bg-white text-xs font-semibold text-slate-700" value={formData.recurrenceInterval} onChange={e => setFormData({...formData, recurrenceInterval: e.target.value})}>
                  <option value="Haftalik">Her Hafta Otomatik Açılsın</option>
                  <option value="Aylik">Her Ay Otomatik Açılsın</option>
                  <option value="Yillik">Her Yıl Otomatik Açılsın</option>
                </select>
                <p className="text-[10px] text-emerald-700/80 mt-1 font-medium">
                  Periyodik kayıt Planning sayfasında listelenir. Sonraki plan tarihinde sistem otomatik olarak yeni iş emri üretir (arka plan job, ~15 dk).
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Operasyon Atamaları</h4>
            <div><label className="block text-[11px] font-bold text-slate-600 mb-1">Operasyon Sorumlusu</label><select className="w-full border border-slate-300 rounded-lg p-2 bg-white" value={formData.operationUserId} onChange={e => setFormData({...formData, operationUserId: e.target.value})}>{lookups.personnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></div>
            <div><label className="block text-[11px] font-bold text-slate-600 mb-1">İş Açan Yetkili</label><select className="w-full border border-slate-300 rounded-lg p-2 bg-white" value={formData.openedByUserId} onChange={e => setFormData({...formData, openedByUserId: e.target.value})}>{lookups.personnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">İş Atanan Sahacı</label>
              <select className="w-full border border-slate-300 rounded-lg p-2 bg-white" value={formData.assignedToUserId} onChange={e => setFormData({...formData, assignedToUserId: e.target.value})}>
                <option value="">Atanmamış</option>
                {lookups.personnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
              </select>
            </div>
          </div>
          
          <div className="flex gap-3 pt-4 border-t">
            <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 border border-slate-300 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-50 transition">İptal</button>
            <button type="submit" disabled={isSubmitting} className={`flex-1 flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl shadow-md transition ${isSubmitting ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {isSubmitting ? (
                <><svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Kaydediliyor...</span></>
              ) : (<span>✓ Kaydet</span>)}
            </button>
          </div>
        </form>
      </div>

      {isDetailModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-brand-navy">
                  İş Emri Detay Kartı {isEditingDetail ? '› Düzenleme Modu' : ''}
                </h2>
              </div>
              <button onClick={closeDetailModal} className="text-slate-400 hover:text-rose-600 font-bold text-2xl p-1 transition-colors">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-x-6 gap-y-4 custom-scrollbar text-xs">
              <div className="col-span-2">
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Nokta Adı</label>
                <input
                  disabled={!isEditingDetail}
                  className={`w-full border rounded-lg p-2.5 font-bold text-sm outline-none ${isEditingDetail ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100 text-blue-800' : 'bg-blue-50 border-blue-100 text-blue-800 cursor-not-allowed'}`}
                  value={isEditingDetail ? editFormData.customerName : selectedOrder.customerName}
                  onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">İş Başlığı / Özeti</label>
                <input
                  disabled={!isEditingDetail}
                  className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingDetail ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`}
                  value={isEditingDetail ? editFormData.title : selectedOrder.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">İş Öncelik Tipi</label>
                {isEditingDetail ? (
                  <select
                    className="w-full border border-blue-400 rounded-lg p-2.5 font-bold bg-white outline-none focus:ring-2 focus:ring-blue-100"
                    value={editFormData.priority}
                    onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                  >
                    <option>Düşük</option>
                    <option>Orta</option>
                    <option>Acil</option>
                  </select>
                ) : (
                  <input disabled className={`w-full bg-slate-50 border border-slate-200 font-bold rounded-lg p-2.5 cursor-not-allowed ${selectedOrder.priority === 'Acil' ? 'text-rose-600' : 'text-slate-700'}`} value={selectedOrder.priority} />
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">İş Tipi</label>
                {isEditingDetail ? (
                  <select
                    className="w-full border border-blue-400 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-100"
                    value={editFormData.type}
                    onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                  >
                    {lookups.types.map((t) => <option key={t}>{t}</option>)}
                  </select>
                ) : (
                  <input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed" value={selectedOrder.type} />
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">İş Kategorisi</label>
                {isEditingDetail ? (
                  <select
                    className="w-full border border-blue-400 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-100"
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  >
                    {lookups.categories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                ) : (
                  <input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed" value={selectedOrder.category} />
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Planlanan Başlangıç</label>
                <input
                  type={isEditingDetail ? 'datetime-local' : 'text'}
                  disabled={!isEditingDetail}
                  className={`w-full border rounded-lg p-2.5 font-medium outline-none ${isEditingDetail ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`}
                  value={isEditingDetail ? editFormData.startDate : (selectedOrder.startDate || '')}
                  onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Planlanan Bitiş</label>
                <input
                  type={isEditingDetail ? 'datetime-local' : 'text'}
                  disabled={!isEditingDetail}
                  className={`w-full border rounded-lg p-2.5 font-medium outline-none ${isEditingDetail ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`}
                  value={isEditingDetail ? editFormData.endDate : (selectedOrder.endDate || '')}
                  onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Koordinat (Enlem - Lat)</label>
                <input
                  type="number"
                  step="any"
                  disabled={!isEditingDetail}
                  className={`w-full border rounded-lg p-2.5 font-mono outline-none ${isEditingDetail ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-600'}`}
                  value={isEditingDetail ? editFormData.lat : (selectedOrder.position?.[0] || '')}
                  onChange={(e) => setEditFormData({ ...editFormData, lat: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Koordinat (Boylam - Lng)</label>
                <input
                  type="number"
                  step="any"
                  disabled={!isEditingDetail}
                  className={`w-full border rounded-lg p-2.5 font-mono outline-none ${isEditingDetail ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-600'}`}
                  value={isEditingDetail ? editFormData.lng : (selectedOrder.position?.[1] || '')}
                  onChange={(e) => setEditFormData({ ...editFormData, lng: parseFloat(e.target.value) })}
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Genel Açıklama</label>
                <textarea
                  disabled={!isEditingDetail}
                  rows={2}
                  className={`w-full border rounded-lg p-2.5 font-medium outline-none resize-none ${isEditingDetail ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`}
                  value={isEditingDetail ? editFormData.description : (selectedOrder.description || 'Açıklama girilmemiş.')}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Mühendis Açıklaması</label>
                <textarea
                  disabled={!isEditingDetail}
                  rows={2}
                  className={`w-full border rounded-lg p-2.5 font-medium outline-none resize-none ${isEditingDetail ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`}
                  value={isEditingDetail ? editFormData.mobileDescription : (selectedOrder.mobileDescription || 'Mühendis açıklaması girilmemiş.')}
                  onChange={(e) => setEditFormData({ ...editFormData, mobileDescription: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Tam Açık Adres</label>
                <textarea
                  disabled={!isEditingDetail}
                  rows={2}
                  className={`w-full border rounded-lg p-2.5 font-medium outline-none resize-none ${isEditingDetail ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`}
                  value={isEditingDetail ? editFormData.address : (selectedOrder.address || 'Adres girilmemiş.')}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                />
              </div>

              {isEditingDetail ? (
                <>
                  <div className="col-span-2 space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Operasyon Atamaları</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Operasyon Sorumlusu</label>
                        <select className="w-full border border-blue-300 rounded-lg p-2 bg-white" value={editFormData.operationUserId} onChange={(e) => setEditFormData({ ...editFormData, operationUserId: e.target.value })}>
                          <option value="">-</option>
                          {lookups.personnel.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">İş Açan Yetkili</label>
                        <select className="w-full border border-blue-300 rounded-lg p-2 bg-white" value={editFormData.openedByUserId} onChange={(e) => setEditFormData({ ...editFormData, openedByUserId: e.target.value })}>
                          <option value="">-</option>
                          {lookups.personnel.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">İş Atanan Sahacı</label>
                        <select className="w-full border border-blue-300 rounded-lg p-2 bg-white" value={editFormData.assignedToUserId} onChange={(e) => setEditFormData({ ...editFormData, assignedToUserId: e.target.value })}>
                          <option value="">Atanmamış</option>
                          {lookups.personnel.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 p-4 bg-emerald-50 rounded-xl border border-emerald-100 space-y-3">
                    <label className="flex items-center gap-2 font-bold text-emerald-800 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                        checked={editFormData.isPeriodic}
                        onChange={(e) => setEditFormData({ ...editFormData, isPeriodic: e.target.checked })}
                      />
                      <span>Bu Bir Periyodik İş Emridir (Otomatik Tekrarlansın)</span>
                    </label>
                    {editFormData.isPeriodic && (
                      <select
                        className="w-full border border-emerald-200 rounded-lg p-2 bg-white text-xs font-semibold text-slate-700"
                        value={editFormData.recurrenceInterval}
                        onChange={(e) => setEditFormData({ ...editFormData, recurrenceInterval: e.target.value })}
                      >
                        <option value="Haftalik">Her Hafta Otomatik Açılsın</option>
                        <option value="Aylik">Her Ay Otomatik Açılsın</option>
                        <option value="Yillik">Her Yıl Otomatik Açılsın</option>
                      </select>
                    )}
                  </div>
                </>
              ) : (
                <div className="col-span-2 grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
                  <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Operasyon Sorumlusu</label><div className="font-bold text-slate-700 truncate">{selectedOrder.operationUserName}</div></div>
                  <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">İş Açan Yetkili</label><div className="font-bold text-slate-700 truncate">{selectedOrder.openedByUserName}</div></div>
                  <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mevcut Atama</label><div className="font-bold text-blue-600 bg-blue-50/50 border border-blue-100 rounded px-2 py-0.5 inline-block max-w-full truncate">👷 {selectedOrder.assignedToUserName || 'Sahacı Atanmamış'}</div></div>
                </div>
              )}

              {!isEditingDetail && (
                <div className="col-span-2 bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-3">
                  <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider">Sahacı Ata / Değiştir</label>
                  <div className="flex gap-2 items-center">
                    <select
                      className="flex-1 border border-emerald-200 rounded-lg p-2.5 bg-white text-sm font-semibold"
                      value={assignUserId}
                      onChange={(e) => setAssignUserId(e.target.value)}
                    >
                      <option value="">Atanmamış</option>
                      {lookups.personnel.map((p) => (
                        <option key={p.id} value={p.id}>{p.fullName}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAssign}
                      disabled={isAssigning}
                      className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap"
                    >
                      {isAssigning ? 'Kaydediliyor...' : 'Atamayı Kaydet'}
                    </button>
                  </div>
                </div>
              )}

              <div className="col-span-2 mt-2">
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Saha Notu (Tamamlama / İptal)</label>
                <textarea
                  disabled
                  rows={3}
                  className="w-full bg-amber-50/50 border border-amber-100 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed resize-none whitespace-pre-wrap"
                  value={selectedOrder.fieldNote?.trim() || 'Saha notu girilmemiş.'}
                />
                {selectedOrder.fieldNoteAddedAt && (
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold">Eklenme: {selectedOrder.fieldNoteAddedAt}</p>
                )}
              </div>

              <div className="col-span-2 space-y-4">
                {(['ISG', 'OPERASYON', 'DIGER'] as const).map((category) => {
                  const photos = orderPhotos.filter((p) => p.category === category);
                  if (loadingPhotos) return null;
                  if (category === 'DIGER' && photos.length === 0) return null;
                  const title =
                    category === 'ISG' ? 'İSG Fotoğrafları' :
                    category === 'OPERASYON' ? 'Operasyon Fotoğrafları' :
                    'Diğer Fotoğraflar';
                  return (
                    <div key={category}>
                      <label className="block font-bold text-slate-500 mb-2 uppercase tracking-wider">
                        {title} ({photos.length})
                      </label>
                      {photos.length === 0 ? (
                        <p className="text-xs text-slate-400 italic bg-slate-50 border border-slate-100 rounded-lg p-3">
                          Bu kategoride fotoğraf yok.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {photos.map((photo) => (
                            <a
                              key={photo.id}
                              href={photo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group block rounded-xl overflow-hidden border border-slate-200 bg-slate-50 hover:border-brand-orange transition"
                              title={photo.fileName}
                            >
                              <img src={photo.url} alt={photo.fileName} className="w-full h-28 object-cover group-hover:opacity-90 transition" />
                              <p className="text-[10px] text-slate-500 px-2 py-1 truncate font-semibold">{photo.fileName}</p>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {loadingPhotos && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-bold py-4">
                    <svg className="animate-spin h-4 w-4 text-brand-orange" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Fotoğraflar yükleniyor...
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              {isEditingDetail ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditingDetail(false)}
                    className="border border-slate-300 text-slate-600 font-bold px-5 py-2 rounded-xl hover:bg-white transition"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDetail}
                    disabled={isSavingDetail}
                    className="bg-emerald-600 text-white font-bold px-5 py-2 rounded-xl hover:bg-emerald-700 shadow transition disabled:opacity-60"
                  >
                    {isSavingDetail ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditingDetail(true)}
                    className="bg-blue-600 text-white font-bold px-5 py-2 rounded-xl hover:bg-blue-700 shadow transition"
                  >
                    ✏️ Düzenle
                  </button>
                  <button onClick={closeDetailModal} className="bg-slate-700 text-white font-bold px-6 py-2 rounded-xl hover:bg-slate-800 transition shadow">Kapat</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}