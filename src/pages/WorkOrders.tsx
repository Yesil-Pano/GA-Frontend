// src/pages/WorkOrders.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { trIncludes } from '../utils/trSearch';
import { getPartnerByKey, resolvePartnerKey } from '../utils/partners';
import { durationMinutes, formatTurkeyDateTime, toTurkeyDateTimeLocal } from '../utils/dateTime';

interface WorkOrderData {
  id: string;
  title: string;
  customerName: string;
  tenantId?: string;
  priority: string;
  status: string;
  type: string;
  category: string;
  description: string;
  mobileDescription: string;
  address: string;
  startDate: string;
  endDate: string;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
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
  const token = localStorage.getItem('token');
  let isSuperAdmin = false;
  if (token) {
    try {
      const payload = JSON.parse(window.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      isSuperAdmin = payload.email === 'admin@theobuz.com';
    } catch {
      /* ignore */
    }
  }

  const [filter, setFilter] = useState('Tümü');
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<WorkOrderData[]>([]);
  
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
  const [lightbox, setLightbox] = useState<{
    photos: OrderPhoto[];
    index: number;
    title: string;
  } | null>(null);
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

  const { setFocusedMarkerPosition, refreshMapData, partnerKey } = useOutletContext<{
    setFocusedMarkerPosition: (pos: [number, number] | null) => void;
    refreshMapData: () => Promise<void>;
    partnerKey?: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const filteredOrders = orders
    .filter(order => {
      if (filter === 'Tümü') return true;
      if (filter === 'Atanmamış') return !order.assignedToUserName || order.assignedToUserName === '' || order.assignedToUserName === 'Atanmamış';
      if (filter === 'Tamamlanan') return order.status === 'Tamamlandı';
      if (filter === 'İptal Edilen') return order.status === 'İptal Edildi';
      return order.status === filter;
    })
    .filter(order => searchTerm === '' || trIncludes(order.title, searchTerm) || trIncludes(order.customerName, searchTerm));

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

  const revokePhotoUrls = () => {
    photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    photoUrlsRef.current = [];
  };

  const loadOrderPhotos = useCallback(async (workOrderId: string) => {
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
  }, []);

  const openDetailModal = useCallback((order: WorkOrderData) => {
    setSelectedOrder(order);
    setAssignUserId(order.assignedToUserId || '');
    setIsEditingDetail(false);
    setEditFormData({
      title: order.title || '',
      customerName: order.customerName || '',
      priority: order.priority || 'Orta',
      type: order.type || 'Arıza',
      category: order.category || 'Arıza Bildirimi',
      startDate: toTurkeyDateTimeLocal(order.startDate),
      endDate: toTurkeyDateTimeLocal(order.endDate),
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
    void loadOrderPhotos(order.id);
  }, [loadOrderPhotos]);

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
        operationUserId?: string | null;
        operationUserName?: string;
        openedByUserId?: string | null;
        openedByUserName?: string;
      }>(`/workorders/${selectedOrder.id}/assign`, {
        assignedToUserId: assignUserId || null,
      });

      const updated: WorkOrderData = {
        ...selectedOrder,
        assignedToUserId: data.assignedToUserId,
        assignedToUserName: data.assignedToUserName,
        operationUserId: data.operationUserId ?? selectedOrder.operationUserId,
        operationUserName: data.operationUserName ?? selectedOrder.operationUserName,
        openedByUserId: data.openedByUserId ?? selectedOrder.openedByUserId,
        openedByUserName: data.openedByUserName ?? selectedOrder.openedByUserName,
      };
      setSelectedOrder(updated);
      setEditFormData((prev) => ({
        ...prev,
        assignedToUserId: data.assignedToUserId || '',
        operationUserId: data.operationUserId || prev.operationUserId,
        openedByUserId: data.openedByUserId || prev.openedByUserId,
      }));
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
      alert(data.message || 'Atama güncellendi.');
    } catch (error) {
      console.error('Atama başarısız:', error);
      alert('Personel ataması yapılamadı.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedOrders.length === 0) return;
    if (!window.confirm(`${selectedOrders.length} iş emri onaylansın (Tamamlandı) mı?`)) return;
    try {
      await api.post('/workorders/bulk-approve', { ids: selectedOrders });
      setSelectedOrders([]);
      const res = await api.get('/workorders');
      setOrders(res.data);
      await refreshMapData();
      alert('Seçili iş emirleri onaylandı.');
    } catch (error) {
      console.error(error);
      alert('Toplu onay başarısız.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOrders.length === 0) return;
    if (!window.confirm(`${selectedOrders.length} iş emri silinsin mi?`)) return;
    try {
      await api.post('/workorders/bulk-delete', { ids: selectedOrders });
      setSelectedOrders([]);
      const res = await api.get('/workorders');
      setOrders(res.data);
      await refreshMapData();
      alert('Seçili iş emirleri silindi.');
    } catch (error) {
      console.error(error);
      alert('Toplu silme başarısız.');
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm('Bu fotoğraf silinsin mi?')) return;
    try {
      await api.delete(`/photos/${photoId}`);
      setOrderPhotos((prev) => prev.filter((p) => p.id !== photoId));
      if (lightbox && lightbox.photos[lightbox.index]?.id === photoId) {
        const nextPhotos = lightbox.photos.filter((p) => p.id !== photoId);
        if (nextPhotos.length === 0) setLightbox(null);
        else setLightbox({
          photos: nextPhotos,
          index: Math.min(lightbox.index, nextPhotos.length - 1),
          title: lightbox.title,
        });
      }
    } catch (error) {
      console.error(error);
      alert('Fotoğraf silinemedi.');
    }
  };

  useEffect(() => () => revokePhotoUrls(), []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightbox(null);
        return;
      }
      if (e.key === 'ArrowRight') {
        setLightbox((prev) =>
          prev
            ? { ...prev, index: (prev.index + 1) % prev.photos.length }
            : prev
        );
      }
      if (e.key === 'ArrowLeft') {
        setLightbox((prev) =>
          prev
            ? {
                ...prev,
                index: (prev.index - 1 + prev.photos.length) % prev.photos.length,
              }
            : prev
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

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

        }
      } catch (error) {
        console.error("Veri yükleme hatası:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadInitialData();
    return () => { isMounted = false; };
  }, [partnerKey]);

  // Bildirimden ?open=id ile gelindiğinde detayı aç (setState effect içinde senkron olmasın)
  const pendingOpenId = searchParams.get('open');
  const handledOpenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingOpenId || orders.length === 0) return;
    if (handledOpenRef.current === pendingOpenId) return;
    const found = orders.find((o) => o.id === pendingOpenId);
    if (!found) return;

    handledOpenRef.current = pendingOpenId;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      openDetailModal(found);
      setSearchParams({}, { replace: true });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [pendingOpenId, orders, openDetailModal, setSearchParams]);

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
        </div>
      </div>

      {selectedOrders.length > 0 && (
        <div className="bg-brand-navy text-white px-5 py-3 rounded-xl mb-4 flex justify-between items-center shadow-md">
          <span className="font-bold text-sm">{selectedOrders.length} iş emri seçildi</span>
          <div className="flex gap-3">
            <button type="button" onClick={handleBulkApprove} className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg text-xs font-bold transition-colors">✓ Toplu Onayla</button>
            <button type="button" onClick={handleBulkDelete} className="bg-rose-500 hover:bg-rose-600 px-4 py-2 rounded-lg text-xs font-bold transition-colors">🗑 Toplu Sil</button>
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
          filteredOrders.map((order) => {
            const pk = resolvePartnerKey({ tenantId: order.tenantId, name: order.customerName });
            const partner = pk ? getPartnerByKey(pk) : null;
            return (
            <div key={order.id} onClick={() => order.position && setFocusedMarkerPosition([...order.position])} className={`cursor-pointer bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative flex items-center gap-4 transition-all hover:border-brand-orange hover:shadow-md ${order.priority === 'Acil' ? 'border-l-4 border-l-rose-600' : ''}`}>
              <input type="checkbox" className="w-5 h-5 cursor-pointer accent-brand-orange shrink-0" checked={selectedOrders.includes(order.id)} onChange={(e) => { e.stopPropagation(); handleSelectOne(order.id); }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-base font-bold text-brand-navy truncate">Nokta Adı: {order.customerName || order.title}</h3>
                  {partnerKey === 'all' && partner && partner.key !== 'all' && (
                    <span className="shrink-0 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: partner.color }}>
                      {partner.name}
                    </span>
                  )}
                </div>
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
            );
          })
        )}
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
                  type={isEditingDetail && isSuperAdmin ? 'datetime-local' : 'text'}
                  disabled={!(isEditingDetail && isSuperAdmin)}
                  className={`w-full border rounded-lg p-2.5 font-medium outline-none ${isEditingDetail && isSuperAdmin ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`}
                  value={isEditingDetail && isSuperAdmin ? editFormData.startDate : (formatTurkeyDateTime(selectedOrder.startDate) || '—')}
                  onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                  title={!isSuperAdmin ? 'Planlanan tarihler yalnızca Süper Admin tarafından değiştirilebilir' : undefined}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Planlanan Bitiş</label>
                <input
                  type={isEditingDetail && isSuperAdmin ? 'datetime-local' : 'text'}
                  disabled={!(isEditingDetail && isSuperAdmin)}
                  className={`w-full border rounded-lg p-2.5 font-medium outline-none ${isEditingDetail && isSuperAdmin ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`}
                  value={isEditingDetail && isSuperAdmin ? editFormData.endDate : (formatTurkeyDateTime(selectedOrder.endDate) || '—')}
                  onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                  title={!isSuperAdmin ? 'Planlanan tarihler yalnızca Süper Admin tarafından değiştirilebilir' : undefined}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Gerçek Başlangıç</label>
                <input
                  disabled
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed"
                  value={formatTurkeyDateTime(selectedOrder.startedAt) || '—'}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">
                  {selectedOrder.cancelledAt || selectedOrder.status === 'İptal' || selectedOrder.status === 'İptal Edildi'
                    ? 'İptal Tarihi'
                    : 'Bitiş Tarihi'}
                </label>
                <input
                  disabled
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed"
                  value={
                    selectedOrder.cancelledAt || selectedOrder.status === 'İptal' || selectedOrder.status === 'İptal Edildi'
                      ? (formatTurkeyDateTime(selectedOrder.cancelledAt) || '—')
                      : (formatTurkeyDateTime(selectedOrder.completedAt) || '—')
                  }
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Süre (dk)</label>
                <input
                  disabled
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed"
                  value={durationMinutes(selectedOrder.startedAt, selectedOrder.completedAt) ?? '—'}
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
                    category === 'OPERASYON' ? 'Operasyoncu Fotoğrafları' :
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
                          {photos.map((photo, photoIndex) => (
                            <div
                              key={photo.id}
                              className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 hover:border-brand-orange transition"
                            >
                              <button
                                type="button"
                                className="block w-full text-left"
                                title={photo.fileName}
                                onClick={() => setLightbox({ photos, index: photoIndex, title })}
                              >
                                <img src={photo.url} alt={photo.fileName} className="w-full h-28 object-cover group-hover:opacity-90 transition" />
                                <p className="text-[10px] text-slate-500 px-2 py-1 truncate font-semibold">{photo.fileName}</p>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePhoto(photo.id)}
                                className="absolute top-1.5 right-1.5 bg-rose-600/90 hover:bg-rose-700 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow"
                              >
                                Sil
                              </button>
                            </div>
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

      {lightbox && lightbox.photos.length > 0 && (
        <div
          className="fixed inset-0 z-80 bg-slate-950/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between text-white mb-3 gap-3">
              <p className="text-sm font-bold truncate">
                {lightbox.title} · {lightbox.index + 1}/{lightbox.photos.length} · {lightbox.photos[lightbox.index].fileName}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold"
                  onClick={() => handleDeletePhoto(lightbox.photos[lightbox.index].id)}
                >
                  Sil
                </button>
                <button type="button" className="text-2xl font-bold px-2" onClick={() => setLightbox(null)}>×</button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-white text-3xl font-bold px-3 py-8 hover:bg-white/10 rounded-xl"
                onClick={() =>
                  setLightbox((prev) =>
                    prev
                      ? { ...prev, index: (prev.index - 1 + prev.photos.length) % prev.photos.length }
                      : prev
                  )
                }
              >
                ‹
              </button>
              <img
                src={lightbox.photos[lightbox.index].url}
                alt={lightbox.photos[lightbox.index].fileName}
                className="max-h-[75vh] w-full object-contain rounded-xl bg-black/40"
              />
              <button
                type="button"
                className="text-white text-3xl font-bold px-3 py-8 hover:bg-white/10 rounded-xl"
                onClick={() =>
                  setLightbox((prev) =>
                    prev ? { ...prev, index: (prev.index + 1) % prev.photos.length } : prev
                  )
                }
              >
                ›
              </button>
            </div>
            <p className="text-center text-slate-300 text-xs mt-3 font-semibold">
              Gezinmek için ← → ok tuşları · Esc ile kapat
            </p>
          </div>
        </div>
      )}

    </div>
  );
}